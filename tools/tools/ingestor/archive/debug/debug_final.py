from curl_cffi import requests
from bs4 import BeautifulSoup
import time
import random

PROXY = "http://uyDM6Wxe-country-ru-city-other-residential:YVmInyco@rotating.livaproxy.com:1080"
PROXIES = {"http": PROXY, "https": PROXY}
CURSED_URL = "https://irecommend.ru/content/tochilka-dlya-nozhei-vsego-za-84-rublya-idealnaya-pomoshchnitsa-na-kukhne-udachnoe-priobrete"

session = requests.Session(impersonate="chrome120")
session.proxies = PROXIES

print("--- STEP 1: Homepage (Warmup) ---")
try:
    resp = session.get("https://irecommend.ru/", timeout=30)
    print(f"Status: {resp.status_code}")
    if resp.status_code != 200:
        print("Homepage failed! Proxy/System issue.")
        exit()
    print("Homepage Success. Cookies captured.")
except Exception as e:
    print(f"Homepage Error: {e}")
    exit()

time.sleep(3)

print("\n--- STEP 2: Random Review (System Health Check) ---")
try:
    soup = BeautifulSoup(resp.text, "html.parser")
    # Grab a fresh link from the stream
    links = [a['href'] for a in soup.find_all('a', href=True) if '/content/' in a['href'] and 'page=' not in a['href']]
    
    if links:
        target = "https://irecommend.ru" + random.choice(links)
        print(f"Attempting Random Link: {target}")
        resp_rand = session.get(target, headers={"Referer": "https://irecommend.ru/"}, timeout=30)
        print(f"Status: {resp_rand.status_code}")
        if resp_rand.status_code == 200:
            print("System Health: GREEN (Can access reviews)")
        else:
            print("System Health: RED (Cannot access reviews)")
    else:
        print("Could not find links on homepage.")
except Exception as e:
    print(f"Random Link Error: {e}")

time.sleep(3)

print("\n--- STEP 3: The 'Cursed' URL ---")
try:
    print(f"Attempting: {CURSED_URL}")
    resp_cursed = session.get(CURSED_URL, headers={"Referer": "https://irecommend.ru/"}, timeout=30)
    print(f"Status: {resp_cursed.status_code}")
    if resp_cursed.status_code == 200:
        print("Success! It worked this time.")
    else:
        print("Failure. This specific URL is persisting in 403.")
        print("Recommendation: Skip this item.")
except Exception as e:
    print(f"Cursed Link Error: {e}")
