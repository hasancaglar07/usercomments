from curl_cffi import requests

# Proxy string provided by user
PROXY = "http://uyDM6Wxe-country-ru-city-other-residential:YVmInyco@rotating.livaproxy.com:1080"
URL = "https://irecommend.ru/content/tochilka-dlya-nozhei-vsego-za-84-rublya-idealnaya-pomoshchnitsa-na-kukhne-udachnoe-priobrete"

print(f"Testing with curl_cffi...")
print(f"Proxy: {PROXY}")

try:
    # impersonate="chrome120" mimics a real Chrome browser's TLS handshake
    response = requests.get(
        URL,
        proxies={"http": PROXY, "https": PROXY},
        impersonate="chrome120",
        timeout=30
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Body Preview: {response.text[:200]}")
    
    if response.status_code == 200:
        print("SUCCESS: Connected successfully!")
    else:
        print("FAILED: Still blocked or other error.")

except Exception as e:
    print(f"ERROR: {e}")
