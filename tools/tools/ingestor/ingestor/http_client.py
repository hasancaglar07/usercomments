import logging
import time
import random
import threading
from typing import Optional
from urllib.parse import urlparse

import cloudscraper
import requests

from .utils.backoff import backoff_delay, sleep_with_backoff


class HttpClient:
    def __init__(self, timeout_seconds: int, max_retries: int, user_agent: str, logger: logging.Logger, proxy: Optional[str] = None):
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.logger = logger
        self._lock = threading.Lock()
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
            self.session.proxies = {
                "http": proxy,
                "https": proxy,
            }
            self.logger.info("Using proxy: %s", proxy)

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
                
                # Check for Proxy Failure
                if self.session.proxies and ("ProxyError" in str(exc) or "407" in str(exc) or "Tunnel connection failed" in str(exc)):
                    self.logger.warning("Proxy failed (%s). Switching to DIRECT connection for fallback.", exc)
                    with self._lock:
                        self.session.proxies = {} # Disable proxy for this session
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
                host = urlparse(url).netloc
                wait_time = self._retry_delay(attempt, response)
                self.logger.warning(
                    "Bot protection triggered (%d). Clearing session and waiting %.1fs...", 
                    response.status_code, wait_time
                )
                # Hard reset session to drop any bot-flags
                with self._lock:
                    self.session.cookies.clear()
                time.sleep(wait_time)
                continue

            # Successful request - simulate "reading time"
            time.sleep(random.uniform(2, 5))
            return response
        if last_exc:
            raise last_exc
        raise RuntimeError("HTTP request failed without exception")
