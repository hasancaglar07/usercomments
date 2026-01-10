from curl_cffi import requests

PROXY = "http://uyDM6Wxe-country-ru-city-other-residential:YVmInyco@rotating.livaproxy.com:1080"
PROXIES = {"http": PROXY, "https": PROXY}

def check(url, name):
    print(f"\n--- Checking {name} ({url}) ---")
    try:
        resp = requests.get(url, proxies=PROXIES, impersonate="chrome120", timeout=20)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            if "json" in resp.headers.get("Content-Type", ""):
                 print(f"Data: {resp.json()}")
            else:
                 print(f"Title: {resp.text.split('<title>')[1].split('</title>')[0] if '<title>' in resp.text else 'No Title'}")
    except Exception as e:
        print(f"Error: {e}")

# 1. IP Check
check("http://ip-api.com/json", "IP Metadata")

# 2. Control (Russian Site)
check("https://ya.ru", "Yandex (Control)")

# 3. Target Main Page
check("https://irecommend.ru/", "Target Homepage")
