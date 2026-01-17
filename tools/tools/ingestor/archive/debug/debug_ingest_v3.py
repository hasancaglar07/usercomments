import cloudscraper
import requests

URL = "https://irecommend.ru/content/tochilka-dlya-nozhei-vsego-za-84-rublya-idealnaya-pomoshchnitsa-na-kukhne-udachnoe-priobrete"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
}

print("\n--- TEST 4: DIRECT CONNECTION (No Proxy) ---")
try:
    scraper = cloudscraper.create_scraper(browser={'browser': 'chrome','platform': 'windows','desktop': True})
    scraper.headers.update(HEADERS)
    resp = scraper.get(URL, timeout=15)
    print(f"Status: {resp.status_code}")
    print(f"Body Preview (500 chars): {resp.text[:500]}")
except Exception as e:
    print(f"ERROR: {e}")
