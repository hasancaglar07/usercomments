import logging
import time
import random
import threading
from typing import Optional
from urllib.parse import urlparse

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


class HttpClient:
    def __init__(self, timeout_seconds: int, max_retries: int, user_agent: str, logger: logging.Logger, proxy: Optional[str] = None):
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.logger = logger
        self._lock = threading.Lock()
        self._proxy = proxy  # Store proxy for selective use
        
        # Create session with curl_cffi (mimics Chrome TLS)
        # We use a persistent session to maintain cookies/handshakes
        self.session = cffi_requests.Session(impersonate="chrome120")
        self._warmup()
        
        if proxy:
            self.logger.info("Selective proxy configured: %s (only for: %s)", proxy, ", ".join(PROXY_DOMAINS))

    def _warmup(self):
        """Warm up the session by visiting the homepage. 
        This establishes the necessary TLS session tickets and initial cookies (ssu, etc.)
        that are often required for deep links to work."""
        try:
            # We only warm up irecommend for now as it's the strict one
            self.session.get(
                "https://irecommend.ru/", 
                timeout=15, 
                proxies={"http": self._proxy, "https": self._proxy} if self._proxy else None,
                headers={
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
                }
            )
        except Exception:
            pass # Warmup failure shouldn't block, next request will try

    # Removed USER_AGENTS list to rely on cloudscraper's consistent native headers


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

    def get(self, url: str, allow_redirects: bool = True) -> cffi_requests.Response:
        last_exc: Optional[Exception] = None
        
        # Selective proxy: only use proxy for specific domains
        use_proxy = self._proxy and _needs_proxy(url)
        
        for attempt in range(self.max_retries + 1):
            try:
                with self._lock:
                    # Apply proxy only for specific domains
                    proxies = None
                    if use_proxy:
                        proxies = {"http": self._proxy, "https": self._proxy}
                    
                    # Ensure Referer is set for deep links (basic heuristic)
                    headers = {}
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
                if attempt >= self.max_retries:
                    time.sleep(random.uniform(10, 20)) 
                    break
                
                # Check for Proxy Failure (only relevant when using proxy)
                if use_proxy and ("ProxyError" in str(exc) or "407" in str(exc) or "Tunnel connection failed" in str(exc)):
                    self.logger.warning("Proxy failed (%s). Switching to DIRECT connection for fallback.", exc)
                    use_proxy = False  # Disable proxy for remaining attempts
                    time.sleep(1)
                    continue

                host = urlparse(url).netloc
                self.logger.warning(
                    "Connection error (attempt %d): %s", attempt + 1, exc
                )
                sleep_with_backoff(attempt, base=5.0)
                continue

            if response.status_code in (403, 429, 521, 520, 503):
                if attempt >= self.max_retries:
                    raise requests.HTTPError(
                        f"HTTP {response.status_code} for {url}", response=response
                    )
                
                # ROTATING PROXY STRATEGY: Create new session = new IP from rotating proxy
                self.logger.warning(
                    "Bot protection triggered (%d). Rotating to new IP (new session)...", 
                    response.status_code
                )
                
                with self._lock:
                    # Create completely new session = rotating proxy gives new IP
                    # Reset to chrome120 to match intended fingerprint
                    self.session = cffi_requests.Session(impersonate="chrome120")
                    self._warmup()
                
                # Short delay before retry with new IP
                time.sleep(random.uniform(2, 4))
                continue

            # Successful request - simulate "reading time"
            time.sleep(random.uniform(2, 5))
            return response
        if last_exc:
            raise last_exc
        raise RuntimeError("HTTP request failed without exception")
