import logging
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from ..config import Config
from ..http_client import HttpClient
from .selectors import SUBCATEGORY_LINK_SELECTORS


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


def _extract_page_title(soup: BeautifulSoup) -> Optional[str]:
    title = soup.find("h1")
    if title and title.get_text(strip=True):
        return title.get_text(strip=True)
    if soup.title and soup.title.get_text(strip=True):
        return soup.title.get_text(strip=True)
    return None


def _discover_subcategories_from_html(
    html: str,
    base_url: str,
    category_url: str,
    logger: logging.Logger,
) -> List[Dict[str, Optional[str]]]:
    soup = BeautifulSoup(html, "lxml")
    seen = set()
    results: List[Dict[str, Optional[str]]] = []
    category_path = urlparse(category_url).path.rstrip("/")

    for selector in SUBCATEGORY_LINK_SELECTORS:
        for link in soup.select(selector):
            href = link.get("href")
            url = _normalize_url(base_url, href)
            if not url:
                continue
            parsed = urlparse(url)
            if not parsed.path.startswith("/catalog/"):
                continue
            if parsed.path.rstrip("/") == category_path:
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
                    "parent_url": category_url,
                }
            )

    logger.info("Subcategories discovered for %s: %s", category_url, len(results))
    return results


def discover_subcategories(
    http: HttpClient,
    config: Config,
    categories: List[Dict[str, Optional[str]]],
    logger: logging.Logger,
) -> List[Dict[str, Optional[str]]]:
    seen: set[str] = set()
    results: List[Dict[str, Optional[str]]] = []
    for category in categories:
        category_url = category.get("source_url")
        if not category_url:
            continue
        try:
            html = http.get(category_url).text
        except Exception as exc:
            logger.warning("Subcategory scan failed %s: %s", category_url, exc)
            continue
        items = _discover_subcategories_from_html(html, config.source_base_url, category_url, logger)
        for item in items:
            url = item.get("source_url")
            if not url or url in seen:
                continue
            seen.add(url)
            results.append(item)
    logger.info("Total subcategories discovered: %s", len(results))
    return results


def parse_category_name(html: str) -> Optional[str]:
    soup = BeautifulSoup(html, "lxml")
    return _extract_page_title(soup)
