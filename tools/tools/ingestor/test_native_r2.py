import logging
import os

import boto3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("R2_S3_Check")


def test_s3_api():
    endpoint = os.getenv("R2_ENDPOINT")
    region = os.getenv("R2_REGION", "auto")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket_name = os.getenv("R2_BUCKET")

    if not all([endpoint, region, access_key, secret_key, bucket_name]):
        raise ValueError("Missing R2 credentials in environment variables.")

    logger.info("R2 S3 API check started...")

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )

    try:
        s3.list_objects_v2(Bucket=bucket_name, MaxKeys=1)
        logger.info("SUCCESS: R2 S3 API access confirmed.")
    except Exception as exc:
        logger.error("ERROR: %s", exc)


if __name__ == "__main__":
    test_s3_api()
