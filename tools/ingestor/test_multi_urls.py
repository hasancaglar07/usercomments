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

# Test actual source URLs from our database
test_urls = [
    "https://irecommend.ru/content/elektricheskii-chainik-korting-kwk-0902-g",
    "https://irecommend.ru/content/toyota-corolla-2011",
    "https://irecommend.ru/content/mercedes-benz-w124-1991",
]

base_url = "https://irecommend.ru"

for url in test_urls:
    print(f"\n{'='*60}")
    print(f"Testing: {url}")
    
    response = http.get(url)
    if response.status_code == 200:
        detail = parse_review_detail(response.text, url, base_url, logger)
        print(f"Title: {detail.title[:50] if detail.title else 'None'}...")
        print(f"Content length: {len(detail.content_html)} chars")
        print(f"Product Image: {'Yes' if detail.product_image_url else 'No'}")
        print(f"Image URLs: {len(detail.image_urls)}")
        for img in detail.image_urls[:3]:
            print(f"  - {img[:70]}...")
    else:
        print(f"Failed to fetch: {response.status_code}")
