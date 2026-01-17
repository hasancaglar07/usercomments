import cloudscraper
import requests

# Trying to force RU country in proxy string
PROXY_RU = "http://uyDM6Wxe-country-ru-city-mix-residential:YVmInyco@rotating.livaproxy.com:1080"
PROXIES = {"http": PROXY_RU, "https": PROXY_RU}
URL = "https://irecommend.ru/content/tochilka-dlya-nozhei-vsego-za-84-rublya-idealnaya-pomoshchnitsa-na-kukhne-udachnoe-priobrete"

print(f"Testing Proxy: {PROXY_RU}")

def test_request(name, session):
    print(f"Testing {name}...")
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

scraper = cloudscraper.create_scraper(browser={'browser': 'chrome','platform': 'windows','desktop': True})
test_request("RU Proxy", scraper)
