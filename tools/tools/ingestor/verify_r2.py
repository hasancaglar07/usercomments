import os
import boto3
from dotenv import load_dotenv

def test_upload():
    load_dotenv()
    endpoint = os.getenv("R2_ENDPOINT")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket_name = os.getenv("R2_BUCKET")
    
    print(f"Testing upload to {bucket_name}...")
    
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto"
    )
    
    try:
        test_content = b"Cloudflare R2 Test Upload"
        test_key = "test_upload_verify.txt"
        
        s3.put_object(Bucket=bucket_name, Key=test_key, Body=test_content)
        print(f"Successfully uploaded {test_key}")
        
        # Verify
        response = s3.get_object(Bucket=bucket_name, Key=test_key)
        content = response['Body'].read()
        if content == test_content:
            print("Verification successful: Content matches.")
        else:
            print("Verification failed: Content mismatch.")
            
        # Optional: delete test file
        s3.delete_object(Bucket=bucket_name, Key=test_key)
        print("Test file deleted.")
        
    except Exception as e:
        print(f"Upload test failed with error: {e}")

if __name__ == "__main__":
    test_upload()
