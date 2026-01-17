from curl_cffi import requests
import time

PROXY = "http://uyDM6Wxe-country-ru-city-other-residential:YVmInyco@rotating.livaproxy.com:1080"
PROXIES = {"http": PROXY, "https": PROXY}
URL = "https://irecommend.ru/content/tochilka-dlya-nozhei-vsego-za-84-rublya-idealnaya-pomoshchnitsa-na-kukhne-udachnoe-priobrete"

print(f"Testing Session Warming...")
try:
    session = requests.Session()
    session.proxies = PROXIES
    session.impersonate = "chrome120"
    
    # 1. Warm up on Homepage
    print("1. Visiting Homepage...")
    resp1 = session.get(
        "https://irecommend.ru/", 
        timeout=30
    )
    print(f"   Status: {resp1.status_code}")
    print(f"   Cookies: {session.cookies.get_dict()}")
    
    time.sleep(2)
    
    # 2. Visit Deep Link
    print("2. Visiting Deep Link...")
    headers = {
        "Referer": "https://irecommend.ru/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
    }
    
    resp2 = session.get(
        URL, 
        headers=headers,
        timeout=30
    )
    
    print(f"   Status: {resp2.status_code}")
    if resp2.status_code == 200:
        print("SUCCESS: Deep link opened with session!")
        print(f"   Title: {resp2.text.split('<title>')[1].split('</title>')[0] if '<title>' in resp2.text else 'No Title'}")
    else:
        print("FAILED: 403 on deep link even with session.")

except Exception as e:
    print(f"Error: {e}")
