import os
from dotenv import load_dotenv
load_dotenv()

from ingestor.http_client import HttpClient
from bs4 import BeautifulSoup
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

http = HttpClient(
    timeout_seconds=30,
    max_retries=3,
    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    logger=logger,
)

# Test URL
test_url = "https://irecommend.ru/content/toyota-corolla-2011"
response = http.get(test_url)
soup = BeautifulSoup(response.text, "lxml")

# Current selectors from selectors.py
REVIEW_IMAGE_SELECTORS = [
    "div.reviewText a.photo.pswp_item",
    "div.reviewText a[href*='/imagecache/copyright1/']",
    "div[itemprop='reviewBody'] img",
    "div.reviewText img",
    "div.review-body img",
    "article img",
]

print("=== Testing REVIEW_IMAGE_SELECTORS ===")
for selector in REVIEW_IMAGE_SELECTORS:
    nodes = soup.select(selector)
    print(f"\n{selector}: {len(nodes)} found")
    for node in nodes[:3]:
        if node.name == "a":
            print(f"  LINK: {node.get('href', '')[:80]}")
        else:
            src = node.get("data-src") or node.get("src")
            print(f"  IMG: {src[:80] if src else 'No src'}")

# Let's look at actual HTML structure
print("\n\n=== Looking at actual page structure ===")

# Check for div.reviewText
review_text = soup.select_one("div.reviewText")
if review_text:
    print("Found div.reviewText!")
    print(f"  Children: {[c.name for c in review_text.children if hasattr(c, 'name')][:10]}")
else:
    print("div.reviewText NOT FOUND")

# Check for div.body-desc (common on irecommend)
body_desc = soup.select("div.body-desc")
print(f"\nFound {len(body_desc)} div.body-desc elements")

# Check for div.description
descriptions = soup.select("div.description")
print(f"Found {len(descriptions)} div.description elements")

# Look for any image containers
print("\n=== Searching for image galleries ===")
gallery_selectors = [
    ".field-slideshow",
    ".photo-gallery", 
    ".image-gallery",
    "a.photo",
    "a.pswp_item",
    "a[data-lightbox]",
    ".item-list-photos",
]
for sel in gallery_selectors:
    els = soup.select(sel)
    if els:
        print(f"[OK] {sel}: {len(els)} found")
        for el in els[:2]:
            print(f"    - {el.get('href', el.get('class', ''))[:60]}")
