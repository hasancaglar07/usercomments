import logging
import re
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
    REVIEW_PROS_SELECTORS,
    REVIEW_CONS_SELECTORS,
)


from pydantic import BaseModel, Field, validator

class ReviewDetail(BaseModel):
    source_url: str
    source_slug: str
    title: str
    content_html: str
    rating: Optional[float] = None
    rating_count: Optional[int] = 0
    like_up: Optional[int] = 0
    like_down: Optional[int] = 0
    published_at: Optional[str] = None
    category_url: Optional[str] = None
    subcategory_url: Optional[str] = None
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None
    product_name: Optional[str] = None
    product_source_url: Optional[str] = None
    excerpt: str = ""

    product_image_url: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list)
    pros: List[str] = Field(default_factory=list)
    cons: List[str] = Field(default_factory=list)

    @validator("content_html", pre=True, always=True)
    def content_not_empty(cls, v):
        return v or ""



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
    cleaned = ""
    for selector in REVIEW_CONTENT_SELECTORS:
        node = soup.select_one(selector)
        if not node:
            continue
        raw_html = "".join(str(child) for child in node.contents)
        cleaned = clean_html(raw_html)
        if cleaned:
            return cleaned
    return cleaned



def _extract_image_urls(soup: BeautifulSoup, base_url: str) -> List[str]:
    urls = []
    
    # Try to find the main review container first to avoid picking up avatars from comments
    content_node = None
    for selector in REVIEW_CONTENT_SELECTORS:
        content_node = soup.select_one(selector)
        if content_node:
            break
            
    search_node = content_node or soup
    
    # Blacklist patterns for URLs we definitely don't want (avatars, icons, etc)
    # Be careful not to block '/user-images/' which is where IRecommend stores review photos!
    blacklist = {
        "avatar", "profile", "icon", "social", "logo", "pixel", "counter", 
        "1x1", "placeholder", "default", "anonymous", "gravatar", "facebook", 
        "twitter", "instagram", "vk.com", "yandex", "google", "mail.ru"
    }

    for selector in REVIEW_IMAGE_SELECTORS:
        for node in search_node.select(selector):
            if node.name == "a":
                src = node.get("href")
            else:
                src = node.get("data-src") or node.get("data-original") or node.get("src")
            
            if not src:
                continue
            
            # Skip data URIs/placeholders
            if src.startswith("data:"):
                continue

            src_lower = src.lower()
            if any(token in src_lower for token in blacklist):
                # Extra check: if it contains 'user-images', it's likely a real review photo
                if "user-images" not in src_lower:
                    continue
                
            if src.startswith("//"):
                src = f"https:{src}"
            elif not src.startswith("http"):
                src = urljoin(base_url, src)
            
            # IRecommend specific: main photos usually contain '/sites/default/files/' 
            if "irecommend.ru" in base_url:
                # If it's a known user-images path, it's definitely a good one
                if "user-images" in src_lower or "/sites/default/files/" in src:
                    pass
                else:
                    # Generic CDN path, check more strictly
                    if "avatar" in src_lower or "profile" in src_lower:
                        continue

            urls.append(src)
            
    return list(dict.fromkeys(urls))



def _extract_list(soup: BeautifulSoup, selectors: List[str], exclude_prefix: Optional[str] = None) -> List[str]:
    for selector in selectors:
        node = soup.select_one(selector)
        if not node:
            continue
        # IRecommend often has a title like 'Достоинства' or 'Недостатки'
        text = node.get_text("\n", strip=True)
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        if exclude_prefix and lines and lines[0].lower().startswith(exclude_prefix.lower()):
            lines = lines[1:]
        if lines:
            return lines
    return []


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

    # PRODUCT URL EXTRACTION
    # Try to find the canonical product link.
    # Method 1: Last breadcrumb link usually points to product if it's not a category
    product_source_url = None
    crumbs = []
    for selector in BREADCRUMB_SELECTORS:
        nodes = soup.select(selector)
        for node in nodes:
            href = node.get("href")
            if href:
                crumbs.append(href)
        if crumbs:
            break
    
    if crumbs:
        # Filter out common non-product links
        potential_products = [
            c for c in crumbs 
            if "/content/" in c 
            and c != source_url 
            and "reviews" not in c
        ]
        if potential_products:
            # The last one is usually the most specific (the product)
            candidate = potential_products[-1]
            if candidate.startswith("//"):
                candidate = f"https:{candidate}"
            elif not candidate.startswith("http"):
                candidate = urljoin(base_url, candidate)
            product_source_url = candidate

    # Method 2: Fallback to looking for a link wrapping the H1 or main title? 
    # (Not strictly reliable, Method 1 is better for structured sites like IRecommend)

    # Basic excerpt generation
    excerpt_soup = BeautifulSoup(content_html or "", "lxml")
    excerpt = normalize_whitespace(excerpt_soup.get_text())[:300]

    pros = _extract_list(soup, REVIEW_PROS_SELECTORS, exclude_prefix="Достоинства")
    cons = _extract_list(soup, REVIEW_CONS_SELECTORS, exclude_prefix="Недостатки")

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
        product_source_url=product_source_url,
        excerpt=excerpt,
        product_image_url=product_image_url,
        image_urls=image_urls,
        pros=pros,
        cons=cons,
    )

