
import datetime
import hashlib
import hmac
import os
from urllib.parse import urlparse

import requests

access_key = os.getenv("R2_ACCESS_KEY_ID")
secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
endpoint = os.getenv("R2_ENDPOINT")
bucket = os.getenv("R2_BUCKET")
region = os.getenv("R2_REGION", "auto")

def sign(key, msg):
    return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()

def getSignatureKey(key, dateStamp, regionName, serviceName):
    kDate = sign(('AWS4' + key).encode('utf-8'), dateStamp)
    kRegion = sign(kDate, regionName)
    kService = sign(kRegion, serviceName)
    kSigning = sign(kService, 'aws4_request')
    return kSigning

def test_manual_request():
    if not all([access_key, secret_key, endpoint, bucket, region]):
        raise ValueError("Missing R2 credentials in environment variables.")

    parsed = urlparse(endpoint if endpoint.startswith("http") else f"https://{endpoint}")
    host = parsed.netloc

    method = 'GET'
    service = 's3'
    request_parameters = 'list-type=2'
    
    t = datetime.datetime.utcnow()
    amz_date = t.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = t.strftime('%Y%m%d')

    canonical_uri = f'/{bucket}'
    canonical_querystring = request_parameters
    canonical_headers = f'host:{host}\nx-amz-date:{amz_date}\n'
    signed_headers = 'host;x-amz-date'
    payload_hash = hashlib.sha256(''.encode('utf-8')).hexdigest()
    canonical_request = method + '\n' + canonical_uri + '\n' + canonical_querystring + '\n' + canonical_headers + '\n' + signed_headers + '\n' + payload_hash
    
    algorithm = 'AWS4-HMAC-SHA256'
    credential_scope = date_stamp + '/' + region + '/' + service + '/' + 'aws4_request'
    string_to_sign = algorithm + '\n' + amz_date + '\n' + credential_scope + '\n' + hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()
    
    signing_key = getSignatureKey(secret_key, date_stamp, region, service)
    signature = hmac.new(signing_key, (string_to_sign).encode('utf-8'), hashlib.sha256).hexdigest()
    
    authorization_header = algorithm + ' ' + 'Credential=' + access_key + '/' + credential_scope + ', ' + 'SignedHeaders=' + signed_headers + ', ' + 'Signature=' + signature
    headers = {'x-amz-date':amz_date, 'Authorization':authorization_header}
    
    url = f'https://{host}/{bucket}?{request_parameters}'
    
    print(f"Manual request to {url}...")
    try:
        r = requests.get(url, headers=headers, timeout=15)
        print(f"Response Code: {r.status_code}")
        print(f"Response Body: {r.text[:200]}")
    except Exception as e:
        print(f"Manual request failed: {e}")

if __name__ == "__main__":
    test_manual_request()
