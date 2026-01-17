"""
🚀 UserReview.net SEO PRO Indexer Bot v5.0
=============================================
PROFESSIONAL MODE - 200+ Doğrulanmış SEO Kaynak

Özellikler:
- ✅ 200+ doğrulanmış SEO kaynağı (Gereksizler temizlendi)
- ✅ Akıllı Heavy/Light ayrımı
- ✅ Light sources: HER ZAMAN gönderilir
- ✅ Heavy sources: Her 5 URL'de 1 gönderilir
- ✅ IndexNow API (Bing/Yandex/Naver/Seznam)
- ✅ Düşük CPU kullanımı
- ✅ Sadece başarılı loglar
"""

import os
import sqlite3
import requests
import time
import random
import xml.etree.ElementTree as ET
import gzip
import csv
import json
from datetime import datetime, timezone, timedelta
import concurrent.futures
from pathlib import Path
import sys

# Verified sources import - 200+ DOĞRULANMIŞ KAYNAK
try:
    from seo_verified_sources import (
        get_all_light_sources, get_all_heavy_sources,
        PING_SERVERS, WEBSUB_HUBS, SITEMAP_PING_URLS,
        LIGHT_COUNT, HEAVY_COUNT, TOTAL_COUNT
    )
    VERIFIED_SOURCES_LOADED = True
    print("✅ Verified sources yüklendi - Profesyonel mod aktif!")
except ImportError:
    VERIFIED_SOURCES_LOADED = False
    print("⚠️ seo_verified_sources.py bulunamadı, dahili kaynaklar kullanılacak")

# Enable ANSI colors
os.system('')

# --- PATHS ---
SCRIPT_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = SCRIPT_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

LOG_FILE = LOG_DIR / "turbo_indexed_urls.log"
CSV_FILE = LOG_DIR / "turbo_indexed_urls.csv"
STATS_FILE = LOG_DIR / "turbo_daily_stats.json"
FAILED_LOG = LOG_DIR / "turbo_failed_urls.log"

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    MAGENTA = '\033[35m'

def log(msg, type="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    if type == "SUCCESS":
        print(f"{Colors.OKGREEN}[{timestamp}] ✓ {msg}{Colors.ENDC}")
    elif type == "WARNING":
        print(f"{Colors.WARNING}[{timestamp}] ! {msg}{Colors.ENDC}")
    elif type == "ERROR":
        print(f"{Colors.FAIL}[{timestamp}] X {msg}{Colors.ENDC}")
    elif type == "HEADER":
        print(f"\n{Colors.HEADER}{Colors.BOLD}━━━ {msg} ━━━{Colors.ENDC}")
    elif type == "TURBO":
        print(f"{Colors.MAGENTA}[{timestamp}] ⚡ {msg}{Colors.ENDC}")
    else:
        print(f"{Colors.OKCYAN}[{timestamp}] i {msg}{Colors.ENDC}")

def log_to_file(url, status, results_detail, elapsed_time, mode):
    """Indexlenen URL'yi dosyaya logla - SADECE başarılılar"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    total_services = len(results_detail)
    success_count = sum(1 for _, code, _, _ in results_detail if code in [200, 201, 202, 301, 302])
    
    # Sadece başarılı gönderimler
    log_lines = [
        f"\n{'='*80}",
        f"[{timestamp}] URL: {url}",
        f"MODE: {mode} | STATUS: {status} | TIME: {elapsed_time}s | SUCCESS: {success_count}/{total_services}",
        f"{'-'*80}",
    ]
    
    for name, code, _, target in results_detail:
        if code in [200, 201, 202, 301, 302]:
            log_lines.append(f"   ✓ {name:<25} : {target}")

    log_lines.append(f"{'='*80}\n")
    
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write("\n".join(log_lines))

def log_failed(url, reason):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(FAILED_LOG, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {url} | Reason: {reason}\n")

def update_daily_stats(urls_indexed, success_count, fail_count, light_count, heavy_count):
    today = datetime.now().strftime("%Y-%m-%d")
    stats = {}
    
    if STATS_FILE.exists():
        try:
            with open(STATS_FILE, "r", encoding="utf-8") as f:
                stats = json.load(f)
        except:
            stats = {}
    
    if today not in stats:
        stats[today] = {"urls_indexed": 0, "success": 0, "fail": 0, "light_triggers": 0, "heavy_triggers": 0}
    
    stats[today]["urls_indexed"] += urls_indexed
    stats[today]["success"] += success_count
    stats[today]["fail"] += fail_count
    stats[today]["light_triggers"] += light_count
    stats[today]["heavy_triggers"] += heavy_count
    
    sorted_dates = sorted(stats.keys(), reverse=True)[:30]
    stats = {date: stats[date] for date in sorted_dates if date in stats}
    
    with open(STATS_FILE, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

# --- CONFIGURATION ---
HOST = "userreview.net"
INDEXNOW_KEY = "b59490923cf34772b03f94c9f516f0c0"
INDEXNOW_LOCATION = f"https://{HOST}/{INDEXNOW_KEY}.txt"
SITEMAP_URL = f"https://{HOST}/sitemap.xml"
DB_FILE = SCRIPT_DIR / "indexing_state_turbo.db"

# PRO MODE SETTINGS - Düşük CPU kullanımı
MAX_URL_WORKERS = 1           # Tek URL işleme
MAX_TRIGGER_WORKERS = 10      # Paralel istek sayısı (CPU dostu)
DELAY_MIN = 5                 # Minimum bekleme
DELAY_MAX = 10                # Maximum bekleme
COOLDOWN_SEC = 12 * 60 * 60   # 12 saat cooldown
HEAVY_TRIGGER_RATIO = 5       # Her 5 URL'de 1 heavy trigger

url_counter = 0

# ═══════════════════════════════════════════════════════════════════════════════
# FALLBACK SOURCES - Eğer verified sources yüklenemezse
# ═══════════════════════════════════════════════════════════════════════════════
FALLBACK_LIGHT_SOURCES = [
    ("IndexNow Bing", "https://www.bing.com/indexnow?url={url}&key=" + INDEXNOW_KEY),
    ("IndexNow Yandex", "https://yandex.com/indexnow?url={url}&key=" + INDEXNOW_KEY),
    ("IndexNow API", "https://api.indexnow.org/indexnow?url={url}&key=" + INDEXNOW_KEY),
    ("Google Rich Results", "https://search.google.com/test/rich-results?url={url}"),
    ("Google PageSpeed", "https://pagespeed.web.dev/report?url={url}"),
    ("Facebook Debugger", "https://developers.facebook.com/tools/debug/?q={url}"),
    ("LinkedIn Inspector", "https://www.linkedin.com/post-inspector/inspect/{url}"),
]

FALLBACK_HEAVY_SOURCES = [
    ("Wayback Machine", "https://web.archive.org/save/{url}"),
    ("Archive.today", "https://archive.today/?run=1&url={url}"),
    ("Seobility", "https://www.seobility.net/en/seocheck/?url={url}"),
]

FALLBACK_PING_SERVERS = [
    "http://rpc.pingomatic.com",
    "http://ping.feedburner.com",
    "http://rpc.twingly.com",
]

# User Agents
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
]

REFERRERS = [
    "https://www.google.com/", "https://www.bing.com/", "https://duckduckgo.com/",
]

# --- DB MANAGER ---
def init_db():
    conn = sqlite3.connect(str(DB_FILE), check_same_thread=False)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS urls (
        url TEXT PRIMARY KEY,
        status TEXT DEFAULT 'PENDING',
        last_crawled_at INTEGER,
        crawl_count INTEGER DEFAULT 0,
        lastmod_ts INTEGER,
        next_crawl_at INTEGER,
        fail_count INTEGER DEFAULT 0,
        priority REAL DEFAULT 0.5,
        url_type TEXT DEFAULT 'content'
    )''')
    conn.commit()
    return conn

def get_pending_urls(conn, limit=3):
    now = int(time.time())
    c = conn.cursor()
    c.execute(
        """SELECT url FROM urls WHERE status='PENDING' 
        AND (next_crawl_at IS NULL OR next_crawl_at <= ?) 
        ORDER BY priority DESC, 
                 (CASE WHEN lastmod_ts IS NOT NULL THEN lastmod_ts ELSE 0 END) DESC,
                 (next_crawl_at IS NOT NULL), next_crawl_at ASC 
        LIMIT ?""",
        (now, limit)
    )
    rows = c.fetchall()
    return [row[0] for row in rows]

def mark_done(conn, url, success=True):
    now = int(time.time())
    next_crawl = now + COOLDOWN_SEC
    c = conn.cursor()
    if success:
        c.execute(
            "UPDATE urls SET status='DONE', last_crawled_at=?, crawl_count=crawl_count+1, next_crawl_at=?, fail_count=0 WHERE url=?",
            (now, next_crawl, url)
        )
    else:
        c.execute("UPDATE urls SET fail_count=fail_count+1 WHERE url=?", (url,))
        c.execute("SELECT fail_count FROM urls WHERE url=?", (url,))
        row = c.fetchone()
        if row and row[0] >= 3:
            c.execute(
                "UPDATE urls SET status='DONE', next_crawl_at=? WHERE url=?",
                (now + COOLDOWN_SEC * 2, url)
            )
    conn.commit()

def unlock_due_urls(conn):
    now = int(time.time())
    c = conn.cursor()
    c.execute(
        "UPDATE urls SET status='PENDING' WHERE status='DONE' AND next_crawl_at IS NOT NULL AND next_crawl_at <= ?",
        (now,)
    )
    conn.commit()

def determine_url_type(url):
    if url.endswith("/") or url.count("/") <= 3:
        return "homepage", 1.0
    elif "/catalog/" in url or "/category/" in url:
        return "category", 0.8
    elif "/products/" in url or "/product/" in url:
        return "product", 0.7
    elif "/content/" in url or "/review/" in url:
        return "review", 0.7
    elif any(x in url for x in ["/privacy", "/terms", "/contact", "/about"]):
        return "static", 0.3
    else:
        return "content", 0.6

def add_or_update_urls(conn, url_entries):
    c = conn.cursor()
    new_count = 0
    updated_count = 0
    for url, lastmod_ts in url_entries.items():
        url_type, priority = determine_url_type(url)
        try:
            c.execute(
                "INSERT INTO urls (url, status, lastmod_ts, priority, url_type) VALUES (?, 'PENDING', ?, ?, ?)",
                (url, lastmod_ts, priority, url_type)
            )
            new_count += 1
        except sqlite3.IntegrityError:
            c.execute("SELECT lastmod_ts FROM urls WHERE url=?", (url,))
            row = c.fetchone()
            stored_lastmod = row[0] if row else None
            if lastmod_ts is not None and (stored_lastmod is None or lastmod_ts > stored_lastmod):
                c.execute(
                    "UPDATE urls SET lastmod_ts=?, status='PENDING', next_crawl_at=NULL, priority=?, url_type=? WHERE url=?",
                    (lastmod_ts, priority, url_type, url)
                )
                updated_count += 1
    conn.commit()
    return new_count, updated_count

def count_stats(conn):
    c = conn.cursor()
    c.execute("SELECT status, COUNT(*) FROM urls GROUP BY status")
    return dict(c.fetchall())

# --- SITEMAP PARSING ---
def parse_lastmod(value):
    if not value:
        return None
    value = value.strip().replace("Z", "+00:00")
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(value, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp())
        except ValueError:
            continue
    return None

def strip_ns(tag):
    return tag.split('}', 1)[-1] if '}' in tag else tag

def fetch_sitemap_entries_recursive(sitemap_url, depth=0, retry=0):
    MAX_RETRIES = 3
    TIMEOUT = 90
    
    if depth > 2:
        return {}
    entries = {}
    try:
        if depth == 0 and retry == 0:
            log(f"🗺️ Sitemap taranıyor: {sitemap_url}")
        
        headers = {'User-Agent': random.choice(USER_AGENTS)}
        response = requests.get(sitemap_url, headers=headers, timeout=TIMEOUT)
        if response.status_code != 200:
            return entries
        content = response.content
        if sitemap_url.endswith('.gz'):
            try:
                content = gzip.decompress(content)
            except OSError:
                return entries
        root = ET.fromstring(content)
        root_tag = strip_ns(root.tag)
        if root_tag == "sitemapindex":
            for sitemap in root.findall(".//{*}sitemap"):
                loc = sitemap.findtext("{*}loc")
                if not loc:
                    continue
                loc = loc.strip()
                if loc:
                    entries.update(fetch_sitemap_entries_recursive(loc, depth + 1))
        else:
            for url_el in root.findall(".//{*}url"):
                loc = url_el.findtext("{*}loc")
                if not loc:
                    continue
                loc = loc.strip()
                lastmod = url_el.findtext("{*}lastmod")
                lastmod_ts = parse_lastmod(lastmod)
                if loc:
                    entries[loc] = lastmod_ts
        
        if depth == 0:
            log(f"✅ Sitemap'ten {len(entries)} URL bulundu", "SUCCESS")
            
    except requests.exceptions.Timeout:
        if retry < MAX_RETRIES:
            time.sleep(5)
            return fetch_sitemap_entries_recursive(sitemap_url, depth, retry + 1)
    except requests.exceptions.ConnectionError:
        if retry < MAX_RETRIES:
            time.sleep(3)
            return fetch_sitemap_entries_recursive(sitemap_url, depth, retry + 1)
    except Exception as e:
        return entries
    return entries

def sync_sitemap(conn):
    log("🔄 Sitemap ile senkronize ediliyor...", "HEADER")
    entries = fetch_sitemap_entries_recursive(SITEMAP_URL)
    fallbacks = [
        f"https://{HOST}/sitemap-tr.xml", f"https://{HOST}/sitemap-en.xml",
        f"https://{HOST}/sitemap-de.xml", f"https://{HOST}/sitemap-es.xml",
    ]
    for fb in fallbacks:
        entries.update(fetch_sitemap_entries_recursive(fb))
    if entries:
        new_count, updated_count = add_or_update_urls(conn, entries)
        log(f"✅ Sync: {len(entries)} URL | Yeni: {new_count} | Güncellenen: {updated_count}", "SUCCESS")
    return len(entries)

# --- REQUEST HELPERS ---
def get_random_headers():
    return {
        'User-Agent': random.choice(USER_AGENTS),
        'Referer': random.choice(REFERRERS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
        'Cache-Control': 'no-cache',
    }

def trigger_worker(args):
    """Her servis için istek gönder"""
    name, target = args
    try:
        headers = get_random_headers()
        timeout = 8 if "Google" in name or "Archive" in name else 5
        res = requests.get(target, headers=headers, timeout=timeout, allow_redirects=True)
        return (name, res.status_code, target)
    except requests.exceptions.Timeout:
        return (name, -1, target)
    except requests.exceptions.ConnectionError:
        return (name, -2, target)
    except Exception:
        return (name, 0, target)

def send_xml_rpc_ping(url):
    ping_servers = PING_SERVERS if VERIFIED_SOURCES_LOADED else FALLBACK_PING_SERVERS
    
    def ping_server(server):
        try:
            payload = f"""<?xml version="1.0"?>
            <methodCall>
              <methodName>weblogUpdates.ping</methodName>
              <params>
                <param><value>{HOST}</value></param>
                <param><value>{url}</value></param>
              </params>
            </methodCall>"""
            requests.post(server, data=payload, timeout=3)
            return True
        except:
            return False
    
    selected_servers = random.sample(ping_servers, min(5, len(ping_servers)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        list(executor.map(ping_server, selected_servers))

def sitemap_ping():
    """Sitemap ping gönder"""
    if not VERIFIED_SOURCES_LOADED:
        return 0
    
    sitemap_url = f"https://{HOST}/sitemap.xml"
    success = 0
    
    for ping_url in SITEMAP_PING_URLS:
        try:
            target = ping_url.format(sitemap=sitemap_url)
            response = requests.get(target, timeout=10)
            if response.status_code == 200:
                success += 1
        except:
            pass
    
    return success

def websub_notify():
    """WebSub bildirimi gönder"""
    if not VERIFIED_SOURCES_LOADED:
        return 0
    
    feed_urls = [f"https://{HOST}/sitemap.xml"]
    success = 0
    
    for hub_url in WEBSUB_HUBS:
        for feed_url in feed_urls:
            try:
                data = {"hub.mode": "publish", "hub.url": feed_url}
                response = requests.post(hub_url, data=data, timeout=10)
                if response.status_code in [200, 204]:
                    success += 1
            except:
                pass
    
    return success

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN PROCESS FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════
def process_url_pro(url, include_heavy=False):
    """PRO MODE: URL'yi işle - Doğrulanmış kaynaklar ile"""
    global url_counter
    domain = HOST
    triggers = []
    
    # LIGHT SOURCES
    if VERIFIED_SOURCES_LOADED:
        light_sources = get_all_light_sources()
    else:
        light_sources = FALLBACK_LIGHT_SOURCES
    
    for name, rpc in light_sources:
        try:
            target = rpc.format(url=url, domain=domain)
            triggers.append((name, target))
        except:
            pass
    
    light_count = len(triggers)
    heavy_count = 0
    
    # HEAVY SOURCES - Sadece include_heavy=True ise
    if include_heavy:
        if VERIFIED_SOURCES_LOADED:
            heavy_sources = get_all_heavy_sources()
        else:
            heavy_sources = FALLBACK_HEAVY_SOURCES
        
        for name, rpc in heavy_sources:
            try:
                target = rpc.format(url=url, domain=domain)
                triggers.append((name, target))
                heavy_count += 1
            except:
                pass
    
    mode = "PRO+HEAVY" if include_heavy else "PRO"
    
    print(f"\n{'='*70}")
    print(f"{Colors.MAGENTA}{Colors.BOLD}⚡ [{mode}] URL İşleniyor{Colors.ENDC}")
    print(f"{Colors.OKCYAN}🔗 {url}{Colors.ENDC}")
    print(f"{Colors.OKBLUE}📡 Light: {light_count} | Heavy: {heavy_count} | Toplam: {len(triggers)}{Colors.ENDC}")
    print(f"{'='*70}", flush=True)
    
    start_time = time.time()
    success_count = 0
    fail_count = 0
    results_detail = []
    
    # XML-RPC ping
    send_xml_rpc_ping(url)
    
    # Sitemap ve WebSub ping
    sitemap_ping()
    websub_notify()
    
    # Paralel HTTP istekleri
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_TRIGGER_WORKERS) as executor:
        future_to_name = {executor.submit(trigger_worker, t): t[0] for t in triggers}
        
        for future in concurrent.futures.as_completed(future_to_name):
            name, code, target = future.result()
            
            if code in [200, 201, 202, 301, 302]:
                success_count += 1
                # Sadece başarılı olanları göster
                short_name = name[:25].ljust(25)
                print(f"   {Colors.OKGREEN}✓ {short_name} : {target}{Colors.ENDC}", flush=True)
            else:
                fail_count += 1
            
            results_detail.append((name, code, "", target))
    
    # Özet
    total_time = round(time.time() - start_time, 2)
    success_rate = (success_count / len(triggers)) * 100 if triggers else 0
    
    status = "SUCCESS" if success_rate >= 30 else "PARTIAL" if success_rate >= 10 else "FAILED"
    
    print(f"\n{'─'*70}")
    print(f"{Colors.BOLD}📊 ÖZET:{Colors.ENDC} ✓ {success_count} başarılı | ✗ {fail_count} başarısız | %{success_rate:.0f} | {total_time}s")
    
    if status == "SUCCESS":
        print(f"   {Colors.OKGREEN}{Colors.BOLD}✅ URL BAŞARIYLA İNDEXLENDİ!{Colors.ENDC}")
    elif status == "PARTIAL":
        print(f"   {Colors.WARNING}⚠️ KISMI BAŞARI{Colors.ENDC}")
    else:
        print(f"   {Colors.FAIL}❌ BAŞARISIZ{Colors.ENDC}")
    
    print(f"{'='*70}\n", flush=True)
    
    # Dosyaya logla
    log_to_file(url, status, results_detail, total_time, mode)
    
    # DB güncelle
    t_conn = sqlite3.connect(str(DB_FILE))
    mark_done(t_conn, url, success=status != "FAILED")
    t_conn.close()
    
    # İstatistik güncelle
    update_daily_stats(1, 1 if status == "SUCCESS" else 0, 1 if status == "FAILED" else 0, light_count, heavy_count)
    
    if status == "FAILED":
        log_failed(url, f"Low success rate: {success_rate:.0f}%")
    
    return status == "SUCCESS"

def main():
    global url_counter
    
    light_count = LIGHT_COUNT if VERIFIED_SOURCES_LOADED else len(FALLBACK_LIGHT_SOURCES)
    heavy_count = HEAVY_COUNT if VERIFIED_SOURCES_LOADED else len(FALLBACK_HEAVY_SOURCES)
    total_count = TOTAL_COUNT if VERIFIED_SOURCES_LOADED else light_count + heavy_count
    
    print(f"""
{Colors.MAGENTA}{Colors.BOLD}
╔══════════════════════════════════════════════════════════════════╗
║     ⚡ UserReview.net SEO PRO Indexer Bot v5.0 ⚡                ║
╠══════════════════════════════════════════════════════════════════╣
║  🚀 PRO MODE - Doğrulanmış Kaynaklar ile Profesyonel İndexleme   ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║  📡 Light Sources : {light_count:3d}  (Her URL'ye gönderilir)                ║
║  🔨 Heavy Sources : {heavy_count:3d}  (Her 5 URL'de 1 gönderilir)             ║
║  📊 Toplam Kaynak : {total_count:3d}  (Gereksizler temizlendi)               ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║  📝 Log: logs/turbo_indexed_urls.log                             ║
║  ⏱️  Cooldown: {int(COOLDOWN_SEC / 3600)} saat | CPU: Düşük                           ║
╚══════════════════════════════════════════════════════════════════╝
{Colors.ENDC}""")
    
    conn = init_db()
    stats = count_stats(conn)
    pending_count = stats.get('PENDING', 0)
    done_count = stats.get('DONE', 0)
    
    if pending_count > 0:
        log(f"📂 Devam ediliyor: PENDING: {pending_count} | DONE: {done_count}", "SUCCESS")
    elif pending_count == 0 and done_count > 0:
        log(f"🎉 Önceki cycle tamamlanmış! DONE: {done_count}", "SUCCESS")
        sync_sitemap(conn)
    else:
        log("🆕 İlk çalıştırma - Sitemap taranıyor...", "HEADER")
        sync_sitemap(conn)
    
    conn.close()
    
    cycle_complete = False
    
    while True:
        main_conn = sqlite3.connect(str(DB_FILE))
        unlock_due_urls(main_conn)
        batch = get_pending_urls(main_conn, limit=MAX_URL_WORKERS)
        stats = count_stats(main_conn)
        main_conn.close()
        
        if not batch:
            pending = stats.get('PENDING', 0)
            done = stats.get('DONE', 0)
            
            if not cycle_complete:
                log(f"🎉 Cycle tamamlandı! {done} URL işlendi.", "SUCCESS")
                cycle_complete = True
                
                conn = init_db()
                new_urls = sync_sitemap(conn)
                conn.close()
                
                if new_urls > 0:
                    cycle_complete = False
                    continue
            
            log(f"⏸️ Bekleyen URL yok. PENDING: {pending} | DONE: {done}", "INFO")
            time.sleep(15)
            continue
        
        cycle_complete = False
        
        log(f"PRO BATCH - {len(batch)} URL İşleniyor", "HEADER")
        
        for url in batch:
            url_counter += 1
            include_heavy = (url_counter % HEAVY_TRIGGER_RATIO == 0)
            
            if include_heavy:
                log(f"🔨 Heavy Mode Aktif! (URL #{url_counter})", "TURBO")
            
            process_url_pro(url, include_heavy=include_heavy)
        
        delay = random.randint(DELAY_MIN, DELAY_MAX)
        print(f"\n{Colors.OKCYAN}⏳ Batch tamamlandı. {delay}s bekleniyor...{Colors.ENDC}", flush=True)
        time.sleep(delay)

if __name__ == "__main__":
    main()
