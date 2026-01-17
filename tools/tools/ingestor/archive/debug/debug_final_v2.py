from curl_cffi import requests
import time

PROXY = "http://uyDM6Wxe-country-ru-city-other-residential:YVmInyco@rotating.livaproxy.com:1080"
PROXIES = {"http": PROXY, "https": PROXY}
CURSED_URL = "https://irecommend.ru/content/tochilka-dlya-nozhei-vsego-za-84-rublya-idealnaya-pomoshchnitsa-na-kukhne-udachnoe-priobrete"

def try_variant(name, impersonate, headers):
    print(f"\n--- Trying {name} ---")
    try:
        session = requests.Session(impersonate=impersonate)
        session.proxies = PROXIES
        # Warmup
        session.get("https://irecommend.ru/", timeout=10)
        
        resp = session.get(CURSED_URL, headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print("SUCCESS!")
            return True
        else:
            print("Failed.")
    except Exception as e:
        print(f"Error: {e}")
    return False

# Variant 1: Edge Browser
try_variant("Edge Browser", "edge101", {"Referer": "https://irecommend.ru/"})

# Variant 2: Safari
try_variant("Safari", "safari15_3", {"Referer": "https://irecommend.ru/"})

# Variant 3: No Referer
try_variant("No Referer", "chrome120", {})

# Variant 4: Mobile User Agent (impersonate chrome but add mobile header)
# curl_cffi doesn't easily do mobile impersonation yet without custom config, 
# but let's try standard chrome with mobile UA string override
