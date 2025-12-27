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

# Get category page and find all review links
test_url = "https://irecommend.ru/catalog/list/41"
response = http.get(test_url)
soup = BeautifulSoup(response.text, "lxml")

# Find links with -n suffix (individual reviews)
links = soup.select("a[href*='/content/'][href*='-n']")
print(f"Found {len(links)} individual review links\n")

# Get first 5 unique full URLs
seen = set()
test_urls = []
for link in links:
    href = link.get('href', '')
    if href.startswith('/'):
        full_url = f"https://irecommend.ru{href}"
    else:
        full_url = href
    if full_url not in seen and '-n' in full_url:
        seen.add(full_url)
        test_urls.append(full_url)
        if len(test_urls) >= 3:
            break

print("URLs to test:")
for u in test_urls:
    print(f"  {u}")

print("\n=== Testing these URLs ===")
from ingestor.crawl.review_detail_parser import parse_review_detail
import time

for url in test_urls:
    print(f"\nTesting: {url}")
    try:
        response = http.get(url)
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            detail = parse_review_detail(response.text, url, "https://irecommend.ru", logger)
            print(f"  Content: {len(detail.content_html)} chars")
            print(f"  Images: {len(detail.image_urls)}")
            print(f"  Product Image: {'Yes' if detail.product_image_url else 'No'}")
    except Exception as e:
        print(f"  Error: {e}")
    time.sleep(2)
