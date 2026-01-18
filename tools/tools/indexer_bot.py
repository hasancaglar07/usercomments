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
    if depth > 2: return [] # Sonsuz dongu onlemi
    
    urls = [] # LISTE kullaniyoruz (Duplicate'lere izin ver)
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
                    urls.extend(fetch_sitemap_urls_recursive(loc.text, depth+1))

        elif root.tag.endswith('urlset'):
            children = root.findall(tag_url, ns)
            log(f"  > {len(children)} URL bulundu: {sitemap_url}")
            
            # Eger 0 URL bulunduysa icerige bakalim, belki yanlis parse ediyoruz
            if len(children) == 0:
                log(f"  UYARI: URL bulunamadı. İçerik özeti: {response.text[:200]}")
                try:
                    # XML'i string olarak regex ile tarayalim (en garantisi)
                    import re
                    links = re.findall(r'<loc>(.*?)</loc>', response.text)
                    if links:
                        log(f"  > Regex yöntemiyle {len(links)} URL kurtarıldı.")
                        for link in links:
                            urls.append(link.strip())
                except Exception as rex:
                     log(f"  Regex hatası: {rex}")
            
            for url in children:
                # Namespace'li veya namespac'siz loc arayimi
                loc = url.find(tag_loc, ns)
                if loc is None:
                     loc = url.find('loc')
                
                if loc is not None and loc.text:
                    urls.append(loc.text)
        else:
            log(f"  > Format anlaşılamadı: {root.tag}")
                    
    except Exception as e:
        log(f"Alt sitemap hatası: {e}")
        
    return urls

def fetch_sitemap_urls(sitemap_url):
    """Sitemap ve alt sitemapleri tarar."""
    urls = []
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
                urls.extend(found)
                
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
    """Google Indexing API'sine URL'leri tek tek gönderir (Çoklu Key Desteği)."""
    if not urls:
        return

    print("\n--- Google Indexing API Gönderimi ---")
    
    # 1. Anahtar dosyalarini bul
    key_files = []
    
    # Once keys klasorune bak
    keys_dir = os.path.join(BASE_DIR, "keys")
    if os.path.exists(keys_dir):
        import glob
        found_keys = glob.glob(os.path.join(keys_dir, "*.json"))
        if found_keys:
            key_files.extend(found_keys)
            log(f"Keys klasöründe {len(found_keys)} adet anahtar bulundu.")
    
    # Eger keys klasorumde bulamazsak veya bos ise eski yontemi dene
    if not key_files:
        if os.path.exists(GOOGLE_KEY_FILE):
            key_files.append(GOOGLE_KEY_FILE)
            log(f"Tekil anahtar dosyası kullanılacak: {GOOGLE_KEY_FILE}")
        else:
            log(f"HATA: Google JSON anahtar dosyası bulunamadı! (Aranan: {keys_dir} veya {GOOGLE_KEY_FILE})")
            return

    remaining_urls = list(urls)
    success_urls = set()
    total_initial = len(urls)
    
    # Her bir anahtar dosyasini sirayla dene
    for k_idx, key_file in enumerate(key_files):
        if not remaining_urls:
            break
            
        filename = os.path.basename(key_file)
        log(f"Anahtar ile oturum açılıyor ({k_idx+1}/{len(key_files)}): {filename}")
        
        try:
            credentials = service_account.Credentials.from_service_account_file(
                key_file, scopes=SCOPES
            )
            service = build("indexing", "v3", credentials=credentials)
        except Exception as e:
            log(f"  X Bu anahtar dosyarında hata var, geçiliyor: {e}")
            continue

        # Bu anahtarla kalan URL'leri deneyelim
        # Kopyası üzerinde dönüyoruz ki orijinal listeden silme yapabilelim
        batch_urls = list(remaining_urls)
        quota_exceeded = False
        
        for i, url in enumerate(batch_urls):
            content = {
                "url": url,
                "type": "URL_UPDATED"
            }
            
            try:
                service.urlNotifications().publish(body=content).execute()
                log(f"[Kalan: {len(remaining_urls)-1}] ✓ Google'a iletildi ({filename}): {url}")
                success_urls.add(url)
                remaining_urls.remove(url)
                
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "Quota exceeded" in err_str:
                    log(f"  ! KOTA DOLDU ({filename}). Diğer anahtara geçiliyor...")
                    quota_exceeded = True
                    break # Bu anahtar bitti, donguden cik (diger anahtara gec)
                elif "403" in err_str or "Permission denied" in err_str:
                    log(f"  ! YETKİ HATASI ({filename}). Bu anahtarın yetkisi yok. Geçiliyor...")
                    quota_exceeded = True # Aslinda yetki hatasi ama bu anahtari yakmamak/zaman kaybetmemek icin geciyoruz
                    break
                else:
                    log(f"  X Hata ({url}): {e}")
                    # URL hataliysa listeden cikartalim tekrar denenmesin (400 Bad Request vb)
                    remaining_urls.remove(url)
        
        if not remaining_urls:
            log("Tüm URL'ler başarıyla işlendi.")
            break
            
    if success_urls:
        save_history(HISTORY_GOOGLE, success_urls)
    
    if remaining_urls:
        log(f"UYARI: {len(remaining_urls)} URL gönderilemedi (Tüm kotalar dolmuş veya hata alınmış olabilir).")

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
    parser = argparse.ArgumentParser(description="Multi-Search Engine Indexer (Google + IndexNow) - PERSISTENT QUEUE MODE")
    parser.add_argument('--force', action='store_true', help='Tüm URLleri tekrar gönder (Artık varsayılan olarak açık)')
    parser.add_argument('--manual', nargs='*', help='Otomatik çekmek yerine elle URL gir')
    parser.add_argument('--loop-interval', type=int, default=0, help='Döngüler arası bekleme süresi (saniye). Varsayılan: 0 (Hemen başla)')
    
    args = parser.parse_args()
    
    print("!!! PERSISTENT QUEUE MODE AKTIF !!!")
    print("!!! BOT KAPATILSA BİLE KALDIĞI YERDEN DEVAM EDER !!!")
    
    # Kuyruk dosya yolu
    QUEUE_FILE = os.path.join(BASE_DIR, "queue.json")
    
    def load_queue():
        if os.path.exists(QUEUE_FILE):
            try:
                with open(QUEUE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return []
        return []

    def save_queue(q):
        try:
            with open(QUEUE_FILE, 'w', encoding='utf-8') as f:
                json.dump(q, f, indent=2)
        except Exception as e:
            log(f"Kuyruk dosyasını kaydederken hata: {e}")

    migrate_legacy_history() 

    # Sonsuz dongu
    loop_count = 0
    while True:
        loop_count += 1
        
        # 1. Kuyrugu Yukle
        queue = load_queue()
        
        # 2. Kuyruk Boss veya Manual Giris ise Doldur
        if not queue:
            log(f"\n=======================================================")
            log(f"             YENI DONGU: KUYRUK DOLUMU (TUR #{loop_count})")
            log(f"=======================================================")
            
            target_urls = []
            if args.manual:
                target_urls.extend(args.manual)
                log(f"Manuel olarak {len(target_urls)} URL girildi.")
            else:
                log("Sitemap taraması yapılıyor (Duplicate'ler dahil, Filtresiz)...")
                found_urls_set = fetch_sitemap_urls(SITEMAP_URL)
                target_urls = list(found_urls_set)
                
                # TERS SIRALAMA (Newest First stratejisi icin basit varsayim)
                # Genelde sitemapler append edildigi icin son eklenenler sondadir.
                target_urls.reverse()
                
                log(f"Sitemap taraması bitti. {len(target_urls)} URL kuyruğa eklenecek.")

            if not target_urls:
                log("Hiç URL bulunamadı. Bir sonraki kontrol bekleniyor...")
                time.sleep(60) # Kisa bekleme
                continue
                
            queue = target_urls
            save_queue(queue) # Diske yaz
        else:
            log(f"\n=======================================================")
            log(f"             DEVAM EDILIYOR: {len(queue)} URL KALDI (TUR #{loop_count})")
            log(f"=======================================================")

        # 3. Kuyruktan Batch Isleme (Persistency icin kucuk batchler)
        BATCH_SIZE = 50 
        # Cok buyuk yaparsak ve bot kapanirsa o batch yanar. 50 ideal.
        
        while queue:
            # Batch al
            current_batch = queue[:BATCH_SIZE]
            remaining_queue = queue[BATCH_SIZE:]
            
            log(f"\n>> {len(queue)} URL kaldı. {len(current_batch)} tanesi işleniyor...")
            
            # IndexNow Gonder
            submit_indexnow(current_batch)
            
            # Google Gonder
            submit_google(current_batch)
            
            # Ping (Her batch sonrasi yapmayalim, cok spam olur. Sadece queue bitince yapabiliriz veya aralarda)
            # Ama kullanici cok agresif istedi, her batchte degil ama her 10 batchte bir olabilir.
            # Simdilik sadece dongu sonunda yapalim veya cok onemliyse burayi acalim.
            
            # Kuyrugu guncelle ve kaydet
            queue = remaining_queue
            save_queue(queue)
            
            # Hizli dongu icin minik sleep (CPU relax)
            time.sleep(0.5)
        
        # Kuyruk bitti
        log("KUYRUK TÜKENDİ. TÜM LİNKLER İŞLENDİ.")
        
        # Ping at (Tur bitimi)
        ping_sitemaps(SITEMAP_URL)
        
        # Kullanici loop intervali
        if args.loop_interval > 0:
            log(f"{args.loop_interval} saniye bekleniyor...")
            time.sleep(args.loop_interval)
        else:
            log("Bekleme süresi 0, hemen yeni sitemap taraması yapılacak...")
            time.sleep(1)
