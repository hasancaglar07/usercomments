import logging
import time
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
        self.session = cloudscraper.create_scraper(
            browser={
                'browser': 'firefox',
                'platform': 'linux',
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

    def _retry_delay(self, attempt: int, response: Optional[requests.Response] = None) -> float:
        if response is not None:
            retry_after = response.headers.get("Retry-After")
            if retry_after:
                try:
                    return max(0.0, float(retry_after))
                except ValueError:
                    pass
        return backoff_delay(attempt)

    def get(self, url: str, allow_redirects: bool = True) -> requests.Response:
        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                response = self.session.get(
                    url,
                    timeout=self.timeout_seconds,
                    allow_redirects=allow_redirects,
                )
            except Exception as exc:
                last_exc = exc
                if attempt >= self.max_retries:
                    break
                host = urlparse(url).netloc
                self.logger.warning(
                    "HTTP retry %s/%s for %s (%s)", attempt + 1, self.max_retries, host, exc
                )
                sleep_with_backoff(attempt)
                continue

            if response.status_code in (403, 429):
                if attempt >= self.max_retries:
                    raise requests.HTTPError(
                        f"HTTP {response.status_code} for {url}", response=response
                    )
                host = urlparse(url).netloc
                wait_time = self._retry_delay(attempt, response)
                self.logger.warning(
                    "HTTP %s for %s, retrying in %.1fs", response.status_code, host, wait_time
                )
                time.sleep(wait_time)
                continue

            if response.status_code >= 500:
                if attempt >= self.max_retries:
                    raise requests.HTTPError(
                        f"HTTP {response.status_code} for {url}", response=response
                    )
                host = urlparse(url).netloc
                wait_time = self._retry_delay(attempt, response)
                self.logger.warning(
                    "HTTP %s for %s, retrying in %.1fs", response.status_code, host, wait_time
                )
                time.sleep(wait_time)
                continue

            return response
        if last_exc:
            raise last_exc
        raise RuntimeError("HTTP request failed without exception")
