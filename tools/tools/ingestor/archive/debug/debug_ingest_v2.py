import cloudscraper
import requests

PROXY = "http://uyDM6Wxe-country-mix-city-mix-residential:YVmInyco@rotating.livaproxy.com:1080"
PROXIES = {"http": PROXY, "https": PROXY}
URL = "https://irecommend.ru/content/tochilka-dlya-nozhei-vsego-za-84-rublya-idealnaya-pomoshchnitsa-na-kukhne-udachnoe-priobrete"

HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1"
}

def test_request(name, session):
    print(f"Testing {name}...")
    session.headers.update(HEADERS)
    session.proxies = PROXIES
    try:
        resp = session.get(URL, timeout=15)
        print(f"Status: {resp.status_code}")
        print(f"Body Preview: {resp.text[:200]}")
        if resp.status_code == 200:
            print("SUCCESS")
        else:
            print("BLOCKED")
    except Exception as e:
        print(f"ERROR: {e}")

print("\n--- TEST 3: Native Cloudscraper + Headers ---")
scraper = cloudscraper.create_scraper(browser={'browser': 'chrome','platform': 'windows','desktop': True})
test_request("Correct Headers", scraper)
