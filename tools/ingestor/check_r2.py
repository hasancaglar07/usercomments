
import os
import boto3
from dotenv import load_dotenv


def check_r2():
    load_dotenv()
    endpoint = os.environ.get("R2_ENDPOINT")
    region = os.environ.get("R2_REGION", "auto")
    key_id = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    bucket_name = os.environ.get("R2_BUCKET")

    if not all([endpoint, region, key_id, secret_key, bucket_name]):
        print("Missing R2 credentials in .env")
        return

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key_id,
        aws_secret_access_key=secret_key,
        region_name=region,
    )

    try:
        s3.head_bucket(Bucket=bucket_name)
        print(f"R2 Bucket '{bucket_name}' is accessible!")
    except Exception as e:
        print(f"R2 Error: {e}")


if __name__ == "__main__":
    check_r2()
