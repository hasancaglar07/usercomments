import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

# Test direct image fetch
from ingestor.http_client import HttpClient
from ingestor.media.image_fetch import fetch_image
from ingestor.media.image_process import process_image
from ingestor.media.r2_upload import R2Uploader
from ingestor.utils.hashing import sha1_bytes
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

http = HttpClient(
    timeout_seconds=30,
    max_retries=3,
    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    logger=logger,
)

# Test fetching an image
test_url = "https://cdn-irec.r-99.com/sites/default/files/imagecache/300o/product-images/1179622/V05SvPhAco3dsdzA5R7Pw.jpg"
print(f"\n=== Testing image fetch from: {test_url} ===")

raw = fetch_image(http, test_url, logger)
if raw:
    print(f"SUCCESS: Fetched {len(raw)} bytes")
    
    # Test processing
    processed = process_image(raw, 0, 800, 85, "userreview.net")
    if processed:
        print(f"SUCCESS: Processed to {len(processed)} bytes")
        
        # Test R2 upload
        uploader = R2Uploader(
            endpoint=os.getenv("R2_ENDPOINT"),
            region=os.getenv("R2_REGION"),
            access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
            secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
            bucket=os.getenv("R2_BUCKET"),
            public_base_url=os.getenv("R2_PUBLIC_BASE_URL"),
            logger=logger,
        )
        
        test_key = f"public/test/{sha1_bytes(processed)}.webp"
        print(f"\n=== Uploading to R2: {test_key} ===")
        
        try:
            public_url = uploader.upload_bytes(test_key, processed)
            print(f"SUCCESS: Uploaded to {public_url}")
            
            # Test if URL is accessible
            print(f"\n=== Testing if URL is accessible ===")
            resp = http.get(public_url)
            print(f"Response status: {resp.status_code}")
            if resp.status_code == 200:
                print("SUCCESS: Image is publicly accessible!")
            else:
                print(f"FAIL: Image not accessible, status {resp.status_code}")
        except Exception as e:
            print(f"FAIL: R2 upload error: {e}")
    else:
        print("FAIL: Image processing failed")
else:
    print("FAIL: Could not fetch image")
