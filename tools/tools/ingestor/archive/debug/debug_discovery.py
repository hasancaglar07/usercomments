from curl_cffi import requests
from bs4 import BeautifulSoup
import time
import random

PROXY = "http://uyDM6Wxe-country-ru-city-other-residential:YVmInyco@rotating.livaproxy.com:1080"
PROXIES = {"http": PROXY, "https": PROXY}

print(f"Testing Discovery Flow...")
try:
    session = requests.Session()
    session.proxies = PROXIES
    session.impersonate = "chrome120"
    
    # 1. Homepage
    print("1. Visiting Homepage...")
    resp1 = session.get("https://irecommend.ru/", timeout=30)
    print(f"   Status: {resp1.status_code}")
    
    if resp1.status_code != 200:
        print("   Failed to load homepage.")
        exit()
        
    # 2. Extract Links
    soup = BeautifulSoup(resp1.text, "html.parser")
    # Finding review links (usually in .stream-item or similar, looking for /content/...)
    links = [a['href'] for a in soup.find_all('a', href=True) if '/content/' in a['href']]
    
    # Filter only clean internal links
    clean_links = [l for l in links if l.startswith('/content/') and 'page=' not in l and '#' not in l]
    
    if not clean_links:
        print("   No review links found on homepage!")
        exit()
        
    target_path = random.choice(clean_links)
    target_url = f"https://irecommend.ru{target_path}"
    print(f"   Found target: {target_url}")
    
    time.sleep(3)
    
    # 3. Visit Target
    print("3. Visiting Target (simulating click)...")
    # Important: Do NOT override headers manually to let curl_cffi handle Chrome footprint
    # JUST add Referer
    resp2 = session.get(
        target_url, 
        headers={"Referer": "https://irecommend.ru/"},
        timeout=30
    )
    
    print(f"   Status: {resp2.status_code}")
    if resp2.status_code == 200:
        print("SUCCESS: Dynamic navigation worked!")
        print(f"   Title: {resp2.text.split('<title>')[1].split('</title>')[0] if '<title>' in resp2.text else 'No Title'}")
    else:
        print("FAILED: 403 on dynamic link.")

except Exception as e:
    print(f"Error: {e}")
