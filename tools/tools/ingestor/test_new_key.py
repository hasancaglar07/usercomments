
import logging
import os

import boto3
from botocore.config import Config as BotoConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("R2_NewKey_Test")

def test_new_key():
    endpoint = os.getenv("R2_ENDPOINT")
    region = os.getenv("R2_REGION", "auto")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket_name = os.getenv("R2_BUCKET")

    if not all([endpoint, region, access_key, secret_key, bucket_name]):
        raise ValueError("Missing R2 credentials in environment variables.")

    logger.info("Connecting with new API key...")

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=BotoConfig(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            connect_timeout=10,
            read_timeout=10,
            proxies={}
        )
    )

    try:
        logger.info("Listing bucket...")
        s3.list_objects_v2(Bucket=bucket_name, MaxKeys=1)
        logger.info("SUCCESS: Access granted with new key.")
        
        logger.info("Uploading test object (new_key_test.txt)...")
        s3.put_object(Bucket=bucket_name, Key="new_key_test.txt", Body=b"New Key Success")
        logger.info("UPLOAD COMPLETE.")
        
    except Exception as e:
        logger.error(f"ERROR: {e}")

if __name__ == "__main__":
    test_new_key()
