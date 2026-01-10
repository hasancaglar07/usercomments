import cloudscraper
import requests
from requests.exceptions import RequestException

PROXY = "http://uyDM6Wxe-country-mix-city-mix-residential:YVmInyco@rotating.livaproxy.com:1080"
PROXIES = {"http": PROXY, "https": PROXY}
URL = "https://irecommend.ru/content/tochilka-dlya-nozhei-vsego-za-84-rublya-idealnaya-pomoshchnitsa-na-kukhne-udachnoe-priobrete"

def test_request(name, session, headers=None):
    print(f"Testing {name}...")
    if headers:
        session.headers.update(headers)
    
    # Force proxy
    session.proxies = PROXIES
    
    try:
        resp = session.get(URL, timeout=15)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print("SUCCESS")
        else:
            print("BLOCKED")
    except Exception as e:
        print(f"ERROR: {e}")

# 1. Current Logic (Bad)
# Chrome/Windows fingerprint + Linux UA
print("\n--- TEST 1: Current Logic (Fingerprint Mismatch) ---")
scraper1 = cloudscraper.create_scraper(browser={'browser': 'chrome','platform': 'windows','desktop': True})
bad_ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
test_request("Current Logic", scraper1, {"User-Agent": bad_ua})

# 2. Proposed Logic (Good)
# Let cloudscraper decide
print("\n--- TEST 2: Proposed Logic (Native Cloudscraper) ---")
scraper2 = cloudscraper.create_scraper(browser={'browser': 'chrome','platform': 'windows','desktop': True})
test_request("Native Cloudscraper", scraper2)
