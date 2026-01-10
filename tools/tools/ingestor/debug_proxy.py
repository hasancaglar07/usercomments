import cloudscraper
import requests
import time
import random

PROXY = "http://uyDM6Wxe-country-mix-city-mix-residential:YVmInyco@rotating.livaproxy.com:1080"
PROXIES = {"http": PROXY, "https": PROXY}

def get_ip():
    try:
        # Create a new scraper each time to simulate a new session
        scraper = cloudscraper.create_scraper()
        resp = scraper.get("https://api.ipify.org?format=json", proxies=PROXIES, timeout=10)
        return resp.json().get("ip")
    except Exception as e:
        return f"Error: {e}"

print(f"Testing proxy: {PROXY}")
print("-" * 50)

ips = set()
for i in range(1, 6):
    ip = get_ip()
    print(f"Attempt {i}: IP {ip}")
    ips.add(ip)
    time.sleep(1)

print("-" * 50)
print(f"Unique IPs: {len(ips)}/5")
if len(ips) > 1:
    print("SUCCESS: Rotation is working.")
else:
    print("FAILURE: IP is sticky.")
