import logging
import time
import random
import threading
import uuid
from typing import Optional, List, Dict
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import cloudscraper
from curl_cffi import requests as cffi_requests
import requests

from .utils.backoff import backoff_delay, sleep_with_backoff


# Domains that need proxy (Russian content sources that may block direct access)
# All other domains (Groq, Supabase, R2, etc.) will connect directly to save bandwidth
PROXY_DOMAINS = [
    "irecommend.ru",
    "cdn-irec.r-99.com",
    "r-99.com",
]

BLOCK_STATUS_CODES = (403, 429, 503, 520, 521)
# For rotating proxies (like Livaproxy), each new session = new IP
PROXY_COOLDOWN_SECONDS = 5
MAX_BLOCK_RETRIES = 12  # More retries since each retry = new IP

# Browser impersonation options for TLS fingerprint rotation
# Using different Chrome/Firefox versions helps bypass fingerprint blocking
BROWSER_IMPERSONATIONS = [
    "chrome120",
    "chrome119", 
    "chrome116",
    "chrome110",
    "chrome107",
    "chrome104",
    "chrome101",
    "chrome100",
    "chrome99",
    "safari15_5",
    "safari15_3",
    "edge101",
    "edge99",
]

# User-Agent rotation list - matches browser impersonations
USER_AGENTS = [
    # Chrome Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    # Chrome Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    # Firefox Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    # Safari Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
    # Edge Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
]


def _needs_proxy(url: str) -> bool:
    """Check if URL domain requires proxy connection."""
    try:
        host = urlparse(url).netloc.lower()
        for domain in PROXY_DOMAINS:
            if host == domain or host.endswith("." + domain):
                return True
        return False
    except:
        return False


def _redact_proxy(proxy: Optional[str]) -> str:
    if not proxy:
        return "none"
    try:
        parsed = urlparse(proxy)
        if not parsed.scheme or not parsed.hostname:
            return "***"
        netloc = parsed.hostname
        if parsed.port:
            netloc = f"{netloc}:{parsed.port}"
        if parsed.username or parsed.password:
            netloc = f"***@{netloc}"
        return urlunparse((parsed.scheme, netloc, "", "", "", ""))
    except Exception:
        return "***"


class HttpClient:
    def __init__(
        self,
        timeout_seconds: int,
        max_retries: int,
        user_agent: str,
        logger: logging.Logger,
        proxy: Optional[str] = None,
        proxy_pool: Optional[List[str]] = None,
    ):
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.logger = logger
        self._lock = threading.Lock()
        self._base_user_agent = user_agent
        self._current_user_agent = random.choice(USER_AGENTS)
        self._proxy_pool = self._normalize_proxy_pool(proxy, proxy_pool)
        self._proxy_index = 0
        self._proxy_cooldown_until: Dict[str, float] = {}
        self._proxy = self._proxy_pool[0] if self._proxy_pool else None
        self._session_id = uuid.uuid4().hex[:12]  # Unique session ID for proxy
        self._force_raw_proxy = False

        self._default_headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "User-Agent": self._current_user_agent,
        }

        # Create session with curl_cffi (mimics browser TLS)
        self._current_impersonation = random.choice(BROWSER_IMPERSONATIONS)
        self.session = cffi_requests.Session(impersonate=self._current_impersonation)
        self._scraper = self._build_scraper()
        self._warmup()
        self.logger.info("Initial browser impersonation: %s", self._current_impersonation)

        if self._proxy_pool:
            if len(self._proxy_pool) > 1:
                self.logger.info("Proxy pool size: %d", len(self._proxy_pool))
            if self._proxy:
                self.logger.info(
                    "Selective proxy configured: %s (only for: %s)",
                    _redact_proxy(self._proxy),
                    ", ".join(PROXY_DOMAINS),
                )

    def _normalize_proxy_pool(self, proxy: Optional[str], proxy_pool: Optional[List[str]]) -> List[str]:
        merged: List[str] = []
        if proxy_pool:
            merged.extend([p for p in proxy_pool if p])
        if proxy:
            if proxy not in merged:
                merged.insert(0, proxy)
        return merged

    def _build_scraper(self) -> "cloudscraper.CloudScraper":
        scraper = cloudscraper.create_scraper()
        scraper.headers.update({"User-Agent": self._current_user_agent})
        return scraper
    
    def _get_proxy_with_session_id(self, base_proxy: Optional[str]) -> Optional[str]:
        """Add session ID to proxy URL for guaranteed new IP from rotating proxy.
        
        Livaproxy format: http://user-session-XXXX:pass@host:port
        This ensures each session gets a unique IP address.
        """
        if not base_proxy:
            return None
        if self._force_raw_proxy:
            return base_proxy
        
        try:
            # Parse proxy URL: http://user:pass@host:port
            parsed = urlparse(base_proxy)
            if not parsed.username:
                return base_proxy
            if "session-" in parsed.username:
                return base_proxy
            
            # Add session ID to username: user-session-abc123
            new_username = f"{parsed.username}-session-{self._session_id}"
            
            # Reconstruct proxy URL
            if parsed.password:
                netloc = f"{new_username}:{parsed.password}@{parsed.hostname}"
            else:
                netloc = f"{new_username}@{parsed.hostname}"
            
            if parsed.port:
                netloc += f":{parsed.port}"
            
            new_proxy = urlunparse((
                parsed.scheme,
                netloc,
                parsed.path,
                parsed.params,
                parsed.query,
                parsed.fragment
            ))
            return new_proxy
        except Exception:
            return base_proxy  # Return original if parsing fails

    def _warmup(self, proxy: Optional[str] = None):
        """Warm up the session by visiting the homepage. 
        This establishes the necessary TLS session tickets and initial cookies (ssu, etc.)
        that are often required for deep links to work."""
        try:
            # We only warm up irecommend for now as it's the strict one
            active_proxy = proxy or self._proxy
            proxy_with_session = self._get_proxy_with_session_id(active_proxy) if active_proxy else None
            self.session.get(
                "https://irecommend.ru/", 
                timeout=15, 
                proxies={"http": proxy_with_session, "https": proxy_with_session} if proxy_with_session else None,
                headers=self._default_headers,
            )
        except Exception:
            pass # Warmup failure shouldn't block, next request will try


    def _mark_proxy_bad(self, proxy: Optional[str], reason: str) -> None:
        if not proxy:
            return
        self._proxy_cooldown_until[proxy] = time.time() + PROXY_COOLDOWN_SECONDS
        self.logger.warning("Proxy cooldown %ds for %s (%s)", PROXY_COOLDOWN_SECONDS, _redact_proxy(proxy), reason)

    def _rotate_proxy(self, reason: str) -> Optional[str]:
        if not self._proxy_pool:
            self._proxy = None
            return None
        previous = self._proxy
        now = time.time()
        for _ in range(len(self._proxy_pool)):
            self._proxy_index = (self._proxy_index + 1) % len(self._proxy_pool)
            candidate = self._proxy_pool[self._proxy_index]
            if self._proxy_cooldown_until.get(candidate, 0) <= now:
                self._proxy = candidate
                break
        if self._proxy != previous:
            self.logger.info(
                "Proxy rotated: %s -> %s (%s)",
                _redact_proxy(previous),
                _redact_proxy(self._proxy),
                reason,
            )
        return self._proxy

    def _current_proxy(self) -> Optional[str]:
        if not self._proxy_pool:
            return None
        now = time.time()
        if self._proxy and self._proxy_cooldown_until.get(self._proxy, 0) <= now:
            return self._proxy
        return self._rotate_proxy("cooldown")

    def _reset_sessions(self, reason: str, proxy: Optional[str]) -> None:
        # Rotate browser impersonation to avoid TLS fingerprint blocking
        old_impersonation = getattr(self, '_current_impersonation', 'chrome120')
        self._current_impersonation = random.choice(BROWSER_IMPERSONATIONS)
        
        # Rotate User-Agent
        old_ua = self._current_user_agent[:30] + "..."
        self._current_user_agent = random.choice(USER_AGENTS)
        
        # Generate new session ID for guaranteed new IP from rotating proxy
        old_session_id = self._session_id
        self._session_id = uuid.uuid4().hex[:12]
        
        # Update headers with new User-Agent
        self._default_headers["User-Agent"] = self._current_user_agent
        
        self.logger.info(
            "Resetting sessions (%s) - Browser: %s -> %s, Session: %s -> %s", 
            reason, old_impersonation, self._current_impersonation,
            old_session_id, self._session_id
        )
        
        self.session = cffi_requests.Session(impersonate=self._current_impersonation)
        self._scraper = self._build_scraper()
        self._warmup(proxy=proxy)

    def _retry_delay(self, attempt: int, response: Optional[requests.Response] = None) -> float:
        if response is not None:
            retry_after = response.headers.get("Retry-After")
            if retry_after:
                try:
                    return max(0.0, float(retry_after))
                except ValueError:
                    pass
        # Even more aggressive backoff for Cloudflare 521/403
        return backoff_delay(attempt, base=10.0, max_delay=120.0)

    def _scraper_get(
        self,
        url: str,
        allow_redirects: bool,
        proxies: Optional[Dict[str, str]],
        headers: Dict[str, str],
    ) -> Optional[requests.Response]:
        try:
            merged_headers = dict(self._default_headers)
            merged_headers.update(headers)
            if self._user_agent:
                merged_headers["User-Agent"] = self._user_agent
            return self._scraper.get(
                url,
                timeout=self.timeout_seconds,
                allow_redirects=allow_redirects,
                proxies=proxies,
                headers=merged_headers,
            )
        except Exception as exc:
            self.logger.warning("Cloudscraper fallback failed for %s: %s", url, exc)
            return None

    def get(self, url: str, allow_redirects: bool = True) -> cffi_requests.Response:
        last_exc: Optional[Exception] = None
        block_retries = 0  # Separate counter for bot protection retries
        
        # For rotating proxies, we use more retries since each session = new IP
        effective_max_retries = max(self.max_retries, MAX_BLOCK_RETRIES) if _needs_proxy(url) else self.max_retries
        
        for attempt in range(effective_max_retries + 1):
            selected_proxy = None
            if _needs_proxy(url):
                selected_proxy = self._current_proxy()
                # For rotating proxy, don't skip even if in cooldown - just reset session
                if not selected_proxy and self._proxy_pool:
                    # Clear cooldowns and reset
                    self._proxy_cooldown_until.clear()
                    selected_proxy = self._proxy_pool[0]
                    self._proxy = selected_proxy
            
            try:
                with self._lock:
                    # Apply proxy with session ID for guaranteed new IP
                    proxies = None
                    if selected_proxy:
                        proxy_with_session = self._get_proxy_with_session_id(selected_proxy)
                        proxies = {"http": proxy_with_session, "https": proxy_with_session}
                    
                    # Ensure Referer is set for deep links (basic heuristic)
                    headers = dict(self._default_headers)
                    if "irecommend.ru" in url and url != "https://irecommend.ru/":
                        headers["Referer"] = "https://irecommend.ru/"

                    response = self.session.get(
                        url,
                        timeout=self.timeout_seconds,
                        allow_redirects=allow_redirects,
                        proxies=proxies,
                        headers=headers
                    )
            except Exception as exc:
                last_exc = exc
                if attempt >= effective_max_retries:
                    time.sleep(random.uniform(10, 20)) 
                    break
                
                # Check for Proxy Failure (only relevant when using proxy)
                if selected_proxy and ("407" in str(exc) or "Proxy Authentication Required" in str(exc)):
                    if not self._force_raw_proxy:
                        self._force_raw_proxy = True
                        self.logger.warning(
                            "Proxy auth failed; retrying without session suffix. (%s)",
                            _redact_proxy(selected_proxy),
                        )
                        time.sleep(random.uniform(1, 2))
                        continue
                    raise RuntimeError("Proxy authentication failed (407). Check CONTENT_PROXY credentials.")
                if selected_proxy and ("ProxyError" in str(exc) or "Tunnel connection failed" in str(exc)):
                    self.logger.warning("Proxy connection failed (%s). Creating new session for new IP...", exc)
                    # For rotating proxy: new session = new IP, no need to mark as bad
                    self._reset_sessions("proxy_error", proxy=selected_proxy)
                    time.sleep(random.uniform(3, 6))
                    continue

                self.logger.warning(
                    "Connection error (attempt %d): %s", attempt + 1, exc
                )
                sleep_with_backoff(attempt, base=5.0)
                continue

            if response.status_code in BLOCK_STATUS_CODES:
                block_retries += 1
                
                # Try cloudscraper fallback
                fallback = self._scraper_get(url, allow_redirects, proxies, headers)
                if fallback and fallback.status_code not in BLOCK_STATUS_CODES:
                    time.sleep(random.uniform(2, 4))
                    return fallback
                
                if attempt >= effective_max_retries:
                    raise requests.HTTPError(
                        f"HTTP {response.status_code} for {url}", response=response
                    )
                
                # ROTATING PROXY STRATEGY: Create new session = new IP from rotating proxy
                # Livaproxy and similar services give a new IP for each new connection/session
                self.logger.warning(
                    "Bot protection triggered (%d). Attempt %d/%d - Creating new session for new IP...", 
                    response.status_code, block_retries, MAX_BLOCK_RETRIES
                )
                
                with self._lock:
                    # Create completely new session = rotating proxy gives new IP
                    self._reset_sessions(f"blocked_{response.status_code}", proxy=selected_proxy)
                
                # Progressive delay: longer waits for repeated blocks
                # This helps avoid rate limiting and gives time for IP to "cool down"
                delay = random.uniform(5, 10) * (1 + block_retries * 0.5)
                self.logger.info("Waiting %.1fs before retry with new IP...", delay)
                time.sleep(delay)
                continue

            # Successful request - simulate "reading time"
            time.sleep(random.uniform(2, 5))
            return response
        
        if last_exc:
            raise last_exc
        raise RuntimeError("HTTP request failed without exception")
