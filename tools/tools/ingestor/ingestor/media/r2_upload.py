import logging
from typing import Optional

import boto3


from botocore.config import Config as BotoConfig


class R2Uploader:
    def __init__(
        self,
        endpoint: str,
        region: str,
        access_key_id: str,
        secret_access_key: str,
        bucket: str,
        public_base_url: str,
        logger: logging.Logger,
    ) -> None:
        self.bucket = bucket
        self.public_base_url = public_base_url.rstrip("/")
        self.logger = logger
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=BotoConfig(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                connect_timeout=15,
                read_timeout=15
            )
        )


    def upload_bytes(self, key: str, data: bytes, content_type: str = "image/webp") -> str:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            CacheControl="public, max-age=31536000",
        )
        url = f"{self.public_base_url}/{key}"
        self.logger.info("Uploaded image %s", url)
        return url

    def build_key(self, review_id: Optional[str], source_slug: str, filename: str) -> str:
        base = review_id if review_id else source_slug
        return f"public/reviews/{base}/{filename}"
