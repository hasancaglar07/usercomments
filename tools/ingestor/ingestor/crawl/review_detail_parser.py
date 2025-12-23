import logging
import re
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Tuple
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from ..utils.text_clean import clean_html, normalize_whitespace
from .selectors import (
    BREADCRUMB_SELECTORS,
    REVIEW_CONTENT_SELECTORS,
    REVIEW_IMAGE_SELECTORS,
    REVIEW_LIKES_DOWN_SELECTORS,
    REVIEW_LIKES_UP_SELECTORS,
    REVIEW_PUBLISHED_SELECTORS,
    REVIEW_RATING_COUNT_SELECTORS,
    REVIEW_RATING_SELECTORS,
    REVIEW_TITLE_SELECTORS,
    PRODUCT_IMAGE_SELECTORS,
)


@dataclass
class ReviewDetail:
    source_url: str
    source_slug: str
    title: str
    content_html: str
    rating: Optional[float]
    rating_count: Optional[int]
    like_up: Optional[int]
    like_down: Optional[int]
    published_at: Optional[str]
    category_url: Optional[str]
    subcategory_url: Optional[str]
    category_name: Optional[str]
    subcategory_name: Optional[str]
    product_name: Optional[str]
    excerpt: str

    product_image_url: Optional[str]
    image_urls: List[str]
    pros: List[str] = None
    cons: List[str] = None



_MONTHS_RU = {
    "\u044f\u043d\u0432\u0430\u0440\u044f": 1,
    "\u0444\u0435\u0432\u0440\u0430\u043b\u044f": 2,
    "\u043c\u0430\u0440\u0442\u0430": 3,
    "\u0430\u043f\u0440\u0435\u043b\u044f": 4,
    "\u043c\u0430\u044f": 5,
    "\u0438\u044e\u043d\u044f": 6,
    "\u0438\u044e\u043b\u044f": 7,
    "\u0430\u0432\u0433\u0443\u0441\u0442\u0430": 8,
    "\u0441\u0435\u043d\u0442\u044f\u0431\u0440\u044f": 9,
    "\u043e\u043a\u0442\u044f\u0431\u0440\u044f": 10,
    "\u043d\u043e\u044f\u0431\u0440\u044f": 11,
    "\u0434\u0435\u043a\u0430\u0431\u0440\u044f": 12,
}


def _extract_text(soup: BeautifulSoup, selectors: List[str]) -> Optional[str]:
    for selector in selectors:
        node = soup.select_one(selector)
        if not node:
            continue
        if node.name == "meta":
            value = node.get("content")
        elif node.name == "time":
            value = node.get("datetime") or node.get_text(strip=True)
        else:
            value = node.get_text(strip=True)
        if value:
            return value
    return None


def _extract_number(text: Optional[str]) -> Optional[float]:
    if not text:
        return None
    match = re.search(r"\d+[\.,]?\d*", text)
    if not match:
        return None
    value = match.group(0).replace(",", ".")
    try:
        return float(value)
    except ValueError:
        return None


def _extract_int(text: Optional[str]) -> Optional[int]:
    if not text:
        return None
    match = re.search(r"\d+", text)
    if not match:
        return None
    try:
        return int(match.group(0))
    except ValueError:
        return None


def _parse_date(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    text = text.strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S%z", "%d.%m.%Y", "%d.%m.%Y %H:%M"):
        try:
            return datetime.strptime(text, fmt).isoformat()
        except ValueError:
            continue
    match = re.search(r"(\d{1,2})\s+([\u0430-\u044f\u0410-\u042f]+)\s+(\d{4})", text)
    if match:
        day = int(match.group(1))
        month_name = match.group(2).lower()
        year = int(match.group(3))
        month = _MONTHS_RU.get(month_name)
        if month:
            try:
                return datetime(year, month, day).isoformat()
            except ValueError:
                return None
    return None


def _extract_breadcrumbs(soup: BeautifulSoup) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    crumbs = []
    for selector in BREADCRUMB_SELECTORS:
        nodes = soup.select(selector)
        for node in nodes:
            href = node.get("href")
            text = node.get_text(strip=True)
            if href:
                crumbs.append((href, text))
        if crumbs:
            break
    


    category_url = None
    subcategory_url = None
    category_name = None
    subcategory_name = None

    filtered = [(href, text) for href, text in crumbs if "/catalog" in href]
    # Exclude root catalog link: /catalog/list/1 or /catalog
    filtered = [f for f in filtered if f[0].rstrip('/') not in ('/catalog', '/catalog/list/1')]

    # Assign from end to beginning to get most specific first
    if len(filtered) >= 2:
        subcategory_url, subcategory_name = filtered[-1]
        category_url, category_name = filtered[-2]
    elif len(filtered) == 1:
        category_url, category_name = filtered[0]
    
    # Product name is usually in H1
    product_name = None
    h1 = soup.select_one("h1")
    if h1:
        # Strip suffix like " — отзыв", " -- отзыв"
        # Includes em-dash (—) and regular dash
        text = h1.get_text(strip=True)
        text = re.sub(r"\s*[-—]+\s*\u043e\u0442\u0437\u044b\u0432\s*$", "", text, flags=re.I)
        product_name = text

    return category_url, subcategory_url, category_name, subcategory_name, product_name


def _extract_content_html(soup: BeautifulSoup) -> str:
    for selector in REVIEW_CONTENT_SELECTORS:
        node = soup.select_one(selector)
        if not node:
            continue
        raw_html = "".join(str(child) for child in node.contents)
        cleaned = clean_html(raw_html)
        if cleaned:
            return cleaned
    if not cleaned:
        logger.debug("No content found in %s with selectors. HTML start: %s", soup.title.string if soup.title else "No Title", str(soup)[:500])
    return cleaned or ""



def _extract_image_urls(soup: BeautifulSoup, base_url: str) -> List[str]:
    urls = []
    for selector in REVIEW_IMAGE_SELECTORS:
        for node in soup.select(selector):
            if node.name == "a":
                src = node.get("href")
            else:
                src = node.get("data-src") or node.get("data-original") or node.get("src")
            
            if not src:
                continue
            if src.startswith("//"):
                src = f"https:{src}"
            elif not src.startswith("http"):
                src = urljoin(base_url, src)
            urls.append(src)
        if urls:
            break
    return list(dict.fromkeys(urls))



def parse_review_detail(html: str, source_url: str, base_url: str, logger: logging.Logger) -> ReviewDetail:
    soup = BeautifulSoup(html, "lxml")
    title = _extract_text(soup, REVIEW_TITLE_SELECTORS) or ""
    content_html = _extract_content_html(soup)
    rating = _extract_number(_extract_text(soup, REVIEW_RATING_SELECTORS))
    rating_count = _extract_int(_extract_text(soup, REVIEW_RATING_COUNT_SELECTORS))
    like_up = _extract_int(_extract_text(soup, REVIEW_LIKES_UP_SELECTORS))
    like_down = _extract_int(_extract_text(soup, REVIEW_LIKES_DOWN_SELECTORS))
    published_at = _parse_date(_extract_text(soup, REVIEW_PUBLISHED_SELECTORS))

    cat_url, sub_url, cat_name, sub_name, prod_name = _extract_breadcrumbs(soup)

    image_urls = _extract_image_urls(soup, base_url)
    
    product_image_url = None
    for sel in PRODUCT_IMAGE_SELECTORS:
        node = soup.select_one(sel)
        if node and node.get("src"):
            product_image_url = node.get("src")
            break
            
    if product_image_url:
        if product_image_url.startswith("//"):
            product_image_url = f"https:{product_image_url}"
        elif not product_image_url.startswith("http"):
            product_image_url = urljoin(base_url, product_image_url)

    parsed = urlparse(source_url)
    source_slug = parsed.path.rstrip("/").split("/")[-1]

    # Basic excerpt generation
    excerpt_soup = BeautifulSoup(content_html or "", "lxml")
    excerpt = normalize_whitespace(excerpt_soup.get_text())[:300]


    return ReviewDetail(
        source_url=source_url,
        source_slug=source_slug,
        title=normalize_whitespace(title),
        content_html=content_html or "",
        rating=rating,
        rating_count=rating_count or 0,
        like_up=like_up or 0,
        like_down=like_down or 0,
        published_at=published_at,
        category_url=cat_url,
        subcategory_url=sub_url,
        category_name=cat_name,
        subcategory_name=sub_name,
        product_name=prod_name,
        excerpt=excerpt,
        product_image_url=product_image_url,
        image_urls=image_urls,
        pros=[],
        cons=[],
    )


