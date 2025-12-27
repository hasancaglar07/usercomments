
import logging
import os

import boto3
from botocore.config import Config as BotoConfig
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("R2_VirtualHost")

def test_virtual_host():
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket_name = os.getenv("R2_BUCKET")
    endpoint = os.getenv("R2_ENDPOINT")
    region = os.getenv("R2_REGION", "auto")

    if not all([access_key, secret_key, bucket_name, endpoint, region]):
        raise ValueError("Missing R2 credentials in environment variables.")

    logger.info("VIRTUAL HOSTING (bucket in subdomain) started...")

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        verify=False,
        config=BotoConfig(
            signature_version="s3v4",
            s3={"addressing_style": "virtual"},
            connect_timeout=20,
            read_timeout=20
        )
    )

    try:
        logger.info("Listing bucket...")
        s3.list_objects_v2(Bucket=bucket_name, MaxKeys=1)
        logger.info("SUCCESS!")
    except Exception as e:
        logger.error(f"ERROR: {e}")

if __name__ == "__main__":
    test_virtual_host()
