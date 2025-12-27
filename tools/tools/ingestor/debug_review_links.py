import os
from dotenv import load_dotenv
load_dotenv()

from ingestor.http_client import HttpClient
from bs4 import BeautifulSoup
import logging
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

http = HttpClient(
    timeout_seconds=30,
    max_retries=3,
    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    logger=logger,
)

# Test a category page to find individual review links
test_url = "https://irecommend.ru/catalog/list/41"  # Automobiles category
response = http.get(test_url)
soup = BeautifulSoup(response.text, "lxml")

print("=== Looking for individual review links ===")

# Current selectors
current_selectors = [
    ".ProductTizer .extract a",
    ".reviewTitle a",
    "a.reviewTextSnippet",
    "a.review-title",
]

for sel in current_selectors:
    els = soup.select(sel)
    print(f"{sel}: {len(els)} found")
    for el in els[:2]:
        print(f"  - {el.get('href', '')[:60]}")

# Try different selectors to find real reviews
print("\n=== Testing alternative selectors ===")

alternative_selectors = [
    "a[href*='/content/'][href*='-n']",  # Links with -n suffix (individual reviews)
    ".item-title a",
    ".review-item a",
    "a.read-more",
    "a.more-link",
    "a[href*='/content/']",
    ".list-item a[href*='/content/']",
    ".views-row a[href*='/content/']",
]

for sel in alternative_selectors:
    els = soup.select(sel)
    if els:
        print(f"\n[OK] {sel}: {len(els)} found")
        for el in els[:3]:
            href = el.get('href', '')
            text = el.get_text(strip=True)[:30]
            print(f"    - {text}: {href[:50]}")
