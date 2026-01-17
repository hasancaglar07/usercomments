import cloudscraper
import requests

# New proxy provided by user
PROXY_NEW = "http://uyDM6Wxe-country-ru-city-other-residential:YVmInyco@rotating.livaproxy.com:1080"
PROXIES = {"http": PROXY_NEW, "https": PROXY_NEW}
URL = "https://irecommend.ru/content/tochilka-dlya-nozhei-vsego-za-84-rublya-idealnaya-pomoshchnitsa-na-kukhne-udachnoe-priobrete"

print(f"Testing Proxy: {PROXY_NEW}")

def test_request(name, session):
    print(f"Testing {name}...")
    session.proxies = PROXIES
    try:
        # Using native cloudscraper (simulating the fix I applied to http_client.py)
        resp = session.get(URL, timeout=15)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print("SUCCESS")
        else:
            print("BLOCKED")
    except Exception as e:
        print(f"ERROR: {e}")

scraper = cloudscraper.create_scraper(browser={'browser': 'chrome','platform': 'windows','desktop': True})
test_request("New RU Proxy + Native Headers", scraper)
