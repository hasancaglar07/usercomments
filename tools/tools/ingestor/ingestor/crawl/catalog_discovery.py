import logging
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .selectors import CATALOG_LINK_SELECTORS


def _normalize_url(base_url: str, href: str) -> Optional[str]:
    if not href:
        return None
    full = urljoin(base_url, href)
    parsed = urlparse(full)
    if not parsed.scheme.startswith("http"):
        return None
    return parsed._replace(fragment="").geturl()


def _extract_source_key(url: str) -> Optional[str]:
    parsed = urlparse(url)
    match = re.search(r"(\d+)", parsed.path)
    if match:
        return match.group(1)
    query_match = re.search(r"id=(\d+)", parsed.query)
    if query_match:
        return query_match.group(1)
    return None


def discover_catalog_categories(
    html: str,
    base_url: str,
    logger: logging.Logger,
) -> List[Dict[str, Optional[str]]]:
    soup = BeautifulSoup(html, "lxml")
    seen = set()
    results: List[Dict[str, Optional[str]]] = []

    for selector in CATALOG_LINK_SELECTORS:
        for link in soup.select(selector):
            href = link.get("href")
            url = _normalize_url(base_url, href)
            if not url:
                continue
            parsed = urlparse(url)
            if not parsed.path.startswith("/catalog/"):
                continue
            if url in seen:
                continue
            seen.add(url)
            name = link.get_text(strip=True) or None
            results.append(
                {
                    "source_url": url,
                    "name": name,
                    "source_key": _extract_source_key(url),
                    "parent_url": None,
                }
            )

    logger.info("Catalog categories discovered: %s", len(results))
    return results
