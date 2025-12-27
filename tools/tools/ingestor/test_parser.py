import os
from dotenv import load_dotenv
load_dotenv()

from ingestor.http_client import HttpClient
from ingestor.crawl.review_detail_parser import parse_review_detail
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

http = HttpClient(
    timeout_seconds=30,
    max_retries=3,
    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    logger=logger,
)

# Test a known source URL
test_url = "https://irecommend.ru/content/svyato-uspenskii-kafedralnyi-sobor-vladimir-rossiya"
base_url = "https://irecommend.ru"

print(f"=== Fetching and parsing: {test_url} ===")
response = http.get(test_url)
print(f"Status: {response.status_code}")

if response.status_code == 200:
    detail = parse_review_detail(response.text, test_url, base_url, logger)
    print(f"\nTitle: {detail.title}")
    print(f"Product Name: {detail.product_name}")
    print(f"Product Image URL: {detail.product_image_url}")
    print(f"\nImage URLs ({len(detail.image_urls)} found):")
    for i, url in enumerate(detail.image_urls[:5]):
        print(f"  {i+1}. {url[:80]}...")
    if len(detail.image_urls) > 5:
        print(f"  ... and {len(detail.image_urls) - 5} more")
else:
    print("Failed to fetch page")
