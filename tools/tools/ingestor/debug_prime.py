from curl_cffi import requests
import time

PROXY = "http://uyDM6Wxe-country-ru-city-other-residential:YVmInyco@rotating.livaproxy.com:1080"
PROXIES = {"http": PROXY, "https": PROXY}
URL = "https://irecommend.ru/content/tochilka-dlya-nozhei-vsego-za-84-rublya-idealnaya-pomoshchnitsa-na-kukhne-udachnoe-priobrete"

print(f"Testing Priming Strategy...")
try:
    session = requests.Session()
    session.proxies = PROXIES
    session.impersonate = "chrome120"
    
    # 1. Prime on Homepage
    print("1. Priming: Visiting Homepage...")
    resp1 = session.get("https://irecommend.ru/", timeout=30)
    print(f"   Status: {resp1.status_code}")
    
    time.sleep(3)
    
    # 2. Visit Specific Deep Link
    print("2. Visiting Target Deep Link...")
    resp2 = session.get(
        URL, 
        headers={"Referer": "https://irecommend.ru/"},
        timeout=30
    )
    
    print(f"   Status: {resp2.status_code}")
    if resp2.status_code == 200:
        print("SUCCESS: Priming worked!")
    else:
        print("FAILED: 403 even after priming.")

except Exception as e:
    print(f"Error: {e}")
