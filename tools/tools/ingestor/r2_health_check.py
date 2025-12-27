
import os
import boto3
from botocore.config import Config as BotoConfig
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("R2_Health")


def test_r2_connection():
    load_dotenv()

    endpoint = os.getenv("R2_ENDPOINT")
    region = os.getenv("R2_REGION", "auto")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket_name = os.getenv("R2_BUCKET")

    logger.info(f"Testing connection to: {endpoint} in region {region}")
    logger.info(f"Using Bucket: {bucket_name}")

    if not all([endpoint, region, access_key, secret_key, bucket_name]):
        logger.error("Eksik .env değişkenleri var! Lütfen R2_* değişkenlerini kontrol edin.")
        return

    # S3 Client oluştur (Proxy kullanarak engeli aş)
    proxy = os.getenv("HTTP_PROXY") or os.getenv("HTTPS_PROXY")
    s3_config = BotoConfig(connect_timeout=15, read_timeout=15, retries={'max_attempts': 0})
    if proxy:
        logger.info(f"Using proxy for health check: {proxy}")
        s3_config.proxies = {'http': proxy, 'https': proxy}

    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=s3_config
    )


    try:
        # 1. Bucket listeleme testi (İzin kontrolü)
        logger.info("1. Adım: Bucket listeleniyor...")
        s3.list_objects_v2(Bucket=bucket_name, MaxKeys=1)
        logger.info("   BAŞARILI: Bucket içeriğine erişilebiliyor.")

        # 2. Küçük bir dosya yükleme testi
        logger.info("2. Adım: Test dosyası yükleniyor...")
        s3.put_object(
            Bucket=bucket_name, 
            Key="health_test.txt", 
            Body=b"R2 Health Check Success",
            ContentType="text/plain"
        )
        logger.info("   BAŞARILI: Yazma izni doğrulandı.")

        print("\n--- SONUÇ: R2 AYARLARINIZ DOĞRU! ---")
        print("Eğer buna rağmen web sayfasından yükleyemiyorsanız sorun %100 CORS ayarlarındadır.")

    except Exception as e:
        logger.error(f"\n--- HATA OLUŞTU ---")
        logger.error(f"Hata detayı: {e}")
        print("\nİpucu: Eğer 'ConnectTimeoutError' alıyorsak sunucuya erişilemiyor (Firewall/ISP engeli).")
        print("Eğer 'SignatureDoesNotMatch' alıyorsak Key/Secret yanlıştır.")
        print("Eğer 'AccessDenied' alıyorsak Bucket izinleri yetersizdir.")

if __name__ == "__main__":
    test_r2_connection()
