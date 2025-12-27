import requests
import json
import argparse
import sys
import os
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Konfigürasyon
HOST = "userreview.net"
KEY = "b59490923cf34772b03f94c9f516f0c0"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow"
SITEMAP_URL = f"https://{HOST}/sitemap.xml"

# Yollar
# Yollar
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HISTORY_INDEXNOW = os.path.join(BASE_DIR, "submitted_indexnow.json")
HISTORY_GOOGLE = os.path.join(BASE_DIR, "submitted_google.json")
LEGACY_HISTORY = os.path.join(BASE_DIR, "submitted_urls.json")
# Google JSON dosyasının tam yolu
GOOGLE_KEY_FILE = r"C:\Users\ihsan\Desktop\review\apps\web\public\acikliyorum-87f375f7fde3.json"
# Baidu Token (Eger varsa buraya yazin veya environment variable'dan alin)
BAIDU_TOKEN = "" # Buraya Baidu tokeninizi ekleyebilirsiniz (orn: "xYzAbCdE")
BAIDU_ENDPOINT = f"http://data.zz.baidu.com/urls?site=https://{HOST}&token={BAIDU_TOKEN}"

SCOPES = ["https://www.googleapis.com/auth/indexing"]

def log(message):
    """Zaman damgali log yazdirir."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")
# ... imports ...

def submit_baidu(urls):
    """Baidu API'sine URL listesi gönderir."""
    if not urls:
        return
        
    if not BAIDU_TOKEN:
        log("Baidu Token tanımlı değil, atlanıyor.")
        return

    print("\n--- Baidu Gönderimi ---")
    urls_list = list(urls)
    # Baidu toplu gonderimi sever, tek seferde gonderelim (body text/plain)
    try:
        payload = "\n".join(urls_list)
        response = requests.post(
            BAIDU_ENDPOINT, 
            data=payload, 
            headers={"Content-Type": "text/plain"},
            timeout=30
        )
        
        if response.status_code == 200:
            res_json = response.json()
            success_count = res_json.get('success', 0)
            remain = res_json.get('remain', 0)
            log(f"✓ BAŞARILI: {success_count} URL Baidu'ya iletildi. (Kalan kota: {remain})")
        else:
            log(f"X Baidu hatası: {response.status_code} - {response.text}")
            
    except Exception as e:
        log(f"Baidu hata: {e}")

# ... existing code ...

def migrate_legacy_history():
    """Eski tekli gecmis dosyasini IndexNow gecmisine tasir."""
    if os.path.exists(LEGACY_HISTORY) and not os.path.exists(HISTORY_INDEXNOW):
        log("Eski geçmiş dosyası bulundu, IndexNow geçmişine taşınıyor...")
        try:
            with open(LEGACY_HISTORY, 'r', encoding='utf-8') as f:
                data = json.load(f)
            with open(HISTORY_INDEXNOW, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            log("Taşıma başarılı.")
        except Exception as e:
            log(f"Taşıma hatası: {e}")

def load_history(file_path):
    """Belirtilen gecmis dosyasini okur."""
    if not os.path.exists(file_path):
        return set()
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return set(data)
    except Exception as e:
        log(f"HATA: Geçmiş okunamadı ({file_path}): {e}")
        return set()

def save_history(file_path, new_urls):
    """Gecmis dosyasini gunceller."""
    current_urls = load_history(file_path)
    current_urls.update(new_urls)
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(list(current_urls), f, indent=2)
    except Exception as e:
        log(f"HATA: Kayıt yapılamadı ({file_path}): {e}")

def fetch_sitemap_urls_recursive(sitemap_url, depth=0):
    if depth > 2: return set() # Sonsuz dongu onlemi
    
    urls = set()
    try:
        log(f"Alt Sitemap taranıyor: {sitemap_url}")
        headers = {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(sitemap_url, headers=headers, timeout=45)
        
        if response.status_code != 200:
            log(f"Alt sitemap erişilemedi ({response.status_code}): {sitemap_url}")
            return urls
            
        root = ET.fromstring(response.content)
        
        # Debug: Kok etiketi gorelim
        log(f"  XML Root: {root.tag}")
        
        # Guclu Namespace tespiti
        ns = {}
        if '}' in root.tag:
            ns_url = root.tag.split('}')[0].strip('{')
            ns = {'s': ns_url}
            tag_sitemap = 's:sitemap'
            tag_url = 's:url'
            tag_loc = 's:loc'
        else:
            tag_sitemap = 'sitemap'
            tag_url = 'url'
            tag_loc = 'loc'
            
        if root.tag.endswith('sitemapindex'):
            children = root.findall(tag_sitemap, ns)
            log(f"  > Index bulundu, {len(children)} alt sitemap içeriyor.")
            for sitemap in children:
                loc = sitemap.find(tag_loc, ns)
                if loc is not None and loc.text:
                    urls.update(fetch_sitemap_urls_recursive(loc.text, depth+1))

        elif root.tag.endswith('urlset'):
            children = root.findall(tag_url, ns)
            log(f"  > {len(children)} URL bulundu: {sitemap_url}")
            
            # Eger 0 URL bulunduysa icerige bakalim, belki yanlis parse ediyoruz
            if len(children) == 0:
                log(f"  UYARI: URL bulunamadı. İçerik özeti: {response.text[:200]}")
                # Namespace olmadan deneyelim (bazen parser sasirabilir)
                # Duzeltme: invalid predicate hatasini onlemek icin namespace temizleyip bakalim
                try:
                    # XML'i string olarak regex ile tarayalim (en garantisi)
                    import re
                    links = re.findall(r'<loc>(.*?)</loc>', response.text)
                    if links:
                        log(f"  > Regex yöntemiyle {len(links)} URL kurtarıldı.")
                        for link in links:
                            urls.add(link.strip())
                except Exception as rex:
                     log(f"  Regex hatası: {rex}")
            
            for url in children:
                # Namespace'li veya namespac'siz loc arayimi
                loc = url.find(tag_loc, ns)
                if loc is None:
                     loc = url.find('loc')
                
                if loc is not None and loc.text:
                    urls.add(loc.text)
        else:
            log(f"  > Format anlaşılamadı: {root.tag}")
                    
    except Exception as e:
        log(f"Alt sitemap hatası: {e}")
        
    return urls

def fetch_sitemap_urls(sitemap_url):
    """Sitemap ve alt sitemapleri tarar."""
    urls = set()
    try:
        # Ana sitemap deneme
        urls = fetch_sitemap_urls_recursive(sitemap_url, depth=0)
    except Exception as e:
        log(f"Ana sitemap genel hatası: {e}")
    
    # Eger ana sitemap bos donerse veya hata verirse fallback listesine bakalim
    if not urls:
        # Ana sitemap yanit vermezse, sitenin kullandigi gercek desenleri deneyelim
        fallback_sitemaps = [
            f"https://{HOST}/sitemap-tr.xml",
            f"https://{HOST}/sitemap-en.xml",
            f"https://{HOST}/sitemap-de.xml",
            f"https://{HOST}/sitemap-es.xml",
            f"https://{HOST}/sitemap-products-tr.xml",
            f"https://{HOST}/sitemap-products-en.xml",
            f"https://{HOST}/sitemap-products-de.xml",
            f"https://{HOST}/sitemap-products-es.xml"
        ]
        for fallback in fallback_sitemaps:
            found = fetch_sitemap_urls_recursive(fallback)
            if found:
                urls.update(found)
                
    return urls

def submit_indexnow(urls):
    """IndexNow API'sine URL listesi gönderir."""
    if not urls:
        return

    print("\n--- IndexNow Gönderimi ---")
    chunk_size = 500
    url_list = list(urls)
    
    count = 0
    for i in range(0, len(url_list), chunk_size):
        chunk = url_list[i:i + chunk_size]
        payload = {
            "host": HOST,
            "key": KEY,
            "keyLocation": KEY_LOCATION,
            "urlList": chunk
        }

        try:
            log(f"Paket gönderiliyor ({len(chunk)} URL)...")
            response = requests.post(INDEXNOW_ENDPOINT, json=payload, headers={"Content-Type": "application/json; charset=utf-8"})
            
            if response.status_code in [200, 202]:
                log(f"✓ BAŞARILI: {len(chunk)} URL IndexNow'a iletildi.")
                count += len(chunk)
            else:
                log(f"X HATA: {response.status_code} - {response.reason}")
                
        except Exception as e:
            log(f"IndexNow hata: {e}")
    if count > 0:
        save_history(HISTORY_INDEXNOW, urls)

def submit_google(urls):
    """Google Indexing API'sine URL'leri tek tek gönderir."""
    if not urls:
        return

    print("\n--- Google Indexing API Gönderimi ---")
    
    if not os.path.exists(GOOGLE_KEY_FILE):
        log(f"HATA: Google JSON anahtar dosyası bulunamadı: {GOOGLE_KEY_FILE}")
        return
    else:
        log(f"Google anahtar dosyası: {GOOGLE_KEY_FILE}")

    try:
        credentials = service_account.Credentials.from_service_account_file(
            GOOGLE_KEY_FILE, scopes=SCOPES
        )
        service = build("indexing", "v3", credentials=credentials)
        log("Google API bağlantısı sağlandı.")
        
        count = 0
        total = len(urls)
        success_urls = set()
        
        for url in urls:
            count += 1
            content = {
                "url": url,
                "type": "URL_UPDATED"
            }
            
            try:
                service.urlNotifications().publish(body=content).execute()
                log(f"[{count}/{total}] ✓ Google'a iletildi: {url}")
                success_urls.add(url)
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "Quota exceeded" in err_str:
                    log("UYARI: Google API günlük kotası doldu (429/Quota). Bugünlük durduruluyor.")
                    break
                else:
                    log(f"[{count}/{total}] X Hata ({url}): {e}")
        
        if success_urls:
            save_history(HISTORY_GOOGLE, success_urls)
                    
    except Exception as e:
        log(f"Google API genel hatası: {e}")

def ping_sitemaps(sitemap_url):
    """Bing ve Yandex'e sitemap ping gönderir."""
    print("\n--- Sitemap Ping (Bing & Yandex) ---")
    
    # Bing Ping
    try:
        # Bing sitemap parametresini sever
        bing_ping = f"https://www.bing.com/ping?sitemap={sitemap_url}"
        res = requests.get(bing_ping, timeout=10)
        if res.status_code == 200:
            log(f"✓ Bing ping başarılı. (Status: 200)")
        else:
            log(f"X Bing ping hatası: {res.status_code} - {res.reason}")
    except Exception as e:
        log(f"X Bing ping başarısız: {e}")

    # Yandex Ping
    try:
        yandex_ping = f"https://webmaster.yandex.com/ping?sitemap={sitemap_url}"
        res = requests.get(yandex_ping, timeout=10)
        if res.status_code == 200:
            log(f"✓ Yandex ping başarılı. (Status: 200)")
        else:
            log(f"X Yandex ping hatası: {res.status_code} - {res.reason}")
    except Exception as e:
        log(f"X Yandex ping başarısız: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Multi-Search Engine Indexer (IndexNow + Google)")
    parser.add_argument('--force', action='store_true', help='Tüm URLleri tekrar gönder')
    parser.add_argument('--manual', nargs='*', help='Otomatik çekmek yerine elle URL gir')
    
    args = parser.parse_args()
    
    log("Bot başlatılıyor...")
    migrate_legacy_history() # Eski gecmisi tasi
    
    target_urls = set()
    
    if args.manual:
        target_urls.update(args.manual)
        log(f"Manuel olarak {len(target_urls)} URL girildi.")
    else:
        log("Sitemap taraması yapılıyor...")
        target_urls = fetch_sitemap_urls(SITEMAP_URL)
        log(f"Sitemap taraması bitti. Toplam {len(target_urls)} URL bulundu.")

    if not target_urls:
        log("Hiç URL bulunamadı. Çıkış yapılıyor.")
        sys.exit(0)

    # 1. IndexNow Filtreleme ve Gönderim
    hist_indexnow = load_history(HISTORY_INDEXNOW)
    to_indexnow = target_urls - hist_indexnow
    
    if args.force:
        to_indexnow = target_urls
        
    if to_indexnow:
        log(f"IndexNow için {len(to_indexnow)} yeni URL bulundu.")
        submit_indexnow(to_indexnow)
    else:
        log("IndexNow için yeni URL yok.")

    # 2. Google Filtreleme ve Gönderim
    hist_google = load_history(HISTORY_GOOGLE)
    to_google = target_urls - hist_google
    
    if args.force:
        to_google = target_urls

    if to_google:
        log(f"Google için {len(to_google)} yeni URL bulundu (Kota dahilinde gönderilecek).")
        submit_google(to_google)
    else:
        log("Google için yeni URL yok.")
    
    # Baidu Gonderimi (Token varsa)
    submit_baidu(target_urls) # Baidu icin hepsini gonderelim, kendi filtresi vardir veya hizli indexlenir

    
    # 3. YENI EKLENTI: Eger yeni link varsa veya zorla yapiliyorsa Ping gonder
    if to_indexnow or to_google or args.force:
        ping_sitemaps(SITEMAP_URL)
    else:
        log("Yeni içerik olmadığı için Sitemap Ping atlanıyor.")

    log("\nBÜTÜN İŞLEMLER TAMAMLANDI.")
