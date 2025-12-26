import logging
from typing import List, Set
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .selectors import REVIEW_LINK_SELECTORS


def _normalize_url(base_url: str, href: str) -> str:
    full = urljoin(base_url, href)
    parsed = urlparse(full)
    return parsed._replace(fragment="").geturl()


def _page_url(base_url: str, page: int, sort_new: bool = False) -> str:
    # If sort_new is requested, append ?new=1
    if sort_new and "new=1" not in base_url and "sort=" not in base_url:
        joiner = "&" if "?" in base_url else "?"
        base_url = f"{base_url}{joiner}new=1"

    if page <= 1:
        return base_url
    joiner = "&" if "?" in base_url else "?"
    return f"{base_url}{joiner}page={page}"


def discover_review_links(html: str, base_url: str, logger: logging.Logger) -> List[str]:
    soup = BeautifulSoup(html, "lxml")
    links: Set[str] = set()
    for selector in REVIEW_LINK_SELECTORS:
        for link in soup.select(selector):
            href = link.get("href")
            if not href:
                continue
            url = _normalize_url(base_url, href)
            parsed = urlparse(url)
            if not parsed.path.startswith("/content/"):
                continue
            links.add(url)
    if links:
        logger.info("Review links discovered: %s", len(links))
    return sorted(links)


def build_page_urls(category_url: str, pages_to_scan: int, sort_new: bool = False) -> List[str]:
    return [_page_url(category_url, page, sort_new) for page in range(1, pages_to_scan + 1)]
