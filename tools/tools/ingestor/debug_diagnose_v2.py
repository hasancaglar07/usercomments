from curl_cffi import requests

PROXY = "http://uyDM6Wxe-country-ru-city-other-residential:YVmInyco@rotating.livaproxy.com:1080"
PROXIES = {"http": PROXY, "https": PROXY}
URL = "https://irecommend.ru/content/tochilka-dlya-nozhei-vsego-za-84-rublya-idealnaya-pomoshchnitsa-na-kukhne-udachnoe-priobrete"

print(f"Testing Deep Link with Referer...")
try:
    # Adding Referer to look like natural navigation
    headers = {
        "Referer": "https://irecommend.ru/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
    }
    
    resp = requests.get(
        URL, 
        proxies=PROXIES, 
        impersonate="chrome120", 
        headers=headers,
        timeout=30
    )
    
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        print("SUCCESS: Deep link opened!")
        print(f"Title: {resp.text.split('<title>')[1].split('</title>')[0]}")
    else:
        print("FAILED: 403 on deep link despite Referer.")

except Exception as e:
    print(f"Error: {e}")
