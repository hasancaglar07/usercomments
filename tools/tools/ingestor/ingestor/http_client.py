import logging
import time
import random
import threading
from typing import Optional
from urllib.parse import urlparse

import cloudscraper
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
        
        # Create session WITHOUT proxy by default
        self.session = cloudscraper.create_scraper(
            browser={
                'browser': 'chrome',
                'platform': 'windows',
                'desktop': True
            }
        )
        if user_agent:
            self.session.headers.update({"User-Agent": user_agent})
        
        if proxy:
            self.logger.info("Selective proxy configured: %s (only for: %s)", proxy, ", ".join(PROXY_DOMAINS))

    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    ]

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

    def get(self, url: str, allow_redirects: bool = True) -> requests.Response:
        last_exc: Optional[Exception] = None
        
        # Selective proxy: only use proxy for specific domains
        use_proxy = self._proxy and _needs_proxy(url)
        
        for attempt in range(self.max_retries + 1):
            try:
                # Rotate User-Agent from a very modern list
                ua = random.choice(self.USER_AGENTS)
                with self._lock:
                    self.session.headers.update({
                        "User-Agent": ua,
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
                        "Sec-Fetch-Dest": "document",
                        "Sec-Fetch-Mode": "navigate",
                        "Sec-Fetch-Site": "none",
                        "Sec-Fetch-User": "?1",
                        "Upgrade-Insecure-Requests": "1"
                    })
                    
                    # Apply proxy only for specific domains
                    if use_proxy:
                        self.session.proxies = {"http": self._proxy, "https": self._proxy}
                    else:
                        self.session.proxies = {}
                    
                    response = self.session.get(
                        url,
                        timeout=self.timeout_seconds,
                        allow_redirects=allow_redirects,
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
                    self.session = cloudscraper.create_scraper(
                        browser={
                            'browser': 'chrome',
                            'platform': 'windows',
                            'desktop': True
                        }
                    )
                
                # Short delay before retry with new IP
                time.sleep(random.uniform(2, 4))
                continue

            # Successful request - simulate "reading time"
            time.sleep(random.uniform(2, 5))
            return response
        if last_exc:
            raise last_exc
        raise RuntimeError("HTTP request failed without exception")
