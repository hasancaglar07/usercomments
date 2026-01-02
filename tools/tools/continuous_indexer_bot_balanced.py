import os
import sqlite3
import requests
import time
import random
import xml.etree.ElementTree as ET
import gzip
from datetime import datetime, timezone
import concurrent.futures

# Enable ANSI colors
os.system('')

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

def log(msg, type="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    if type == "SUCCESS":
        print(f"{Colors.OKGREEN}[{timestamp}] ✓ {msg}{Colors.ENDC}")
    elif type == "WARNING":
        print(f"{Colors.WARNING}[{timestamp}] ! {msg}{Colors.ENDC}")
    elif type == "ERROR":
        print(f"{Colors.FAIL}[{timestamp}] X {msg}{Colors.ENDC}")
    elif type == "HEADER":
        print(f"\n{Colors.HEADER}{Colors.BOLD}--- {msg} ---{Colors.ENDC}")
    else:
        print(f"{Colors.OKCYAN}[{timestamp}] i {msg}{Colors.ENDC}")

# --- CONFIGURATION ---
HOST = "userreview.net"
SITEMAP_URL = f"https://{HOST}/sitemap.xml"
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "indexing_state_balanced.db")

# THREADING & SPEED (BALANCED)
MAX_URL_WORKERS = 2
MAX_TRIGGER_WORKERS = 6
MAX_AUTHORITY_TRIGGERS = 18
DELAY_MIN = 5
DELAY_MAX = 10
COOLDOWN_SEC = 48 * 60 * 60
SITEMAP_SYNC_INTERVAL_SEC = 30 * 60
IDLE_SLEEP_SEC = 20

# --- SAFE SOURCES (FETCHERS) ---
SAFE_RPCS = [
    ("Google Rich Results", "https://search.google.com/test/rich-results?url={url}"),
    ("Schema.org Validator", "https://validator.schema.org/#url={url}"),
    ("W3C HTML Validator", "https://validator.w3.org/nu/?doc={url}"),
    ("W3C CSS Validator", "https://jigsaw.w3.org/css-validator/validator?uri={url}"),
    ("W3C Link Checker", "https://validator.w3.org/checklink?uri={url}"),
    ("MetaTags Preview", "https://metatags.io/?url={url}"),
    ("OpenGraph XYZ", "https://opengraph.xyz/url/{url}"),
    ("HeyMeta Preview", "https://www.heymeta.com/?url={url}"),
    ("Social Share Preview", "https://socialsharepreview.com/?url={url}"),
    ("OpenGraph Dev", "https://opengraph.dev/?url={url}"),
    ("Mozilla Observatory", "https://observatory.mozilla.org/analyze/{domain}"),
    ("WordPress mShots", "https://s.wordpress.com/mshots/v1/{url}?w=1200"),
]

# --- STEALTH ASSETS ---
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
]

REFERRERS = [
    "https://www.google.com/", "https://www.bing.com/", "https://duckduckgo.com/",
    "https://t.co/", "https://www.facebook.com/", "https://www.linkedin.com/",
    "https://news.google.com/"
]

# --- DB MANAGER ---
def init_db():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS urls (
        url TEXT PRIMARY KEY,
        status TEXT DEFAULT 'PENDING',
        last_crawled_at INTEGER,
        crawl_count INTEGER DEFAULT 0,
        lastmod_ts INTEGER,
        next_crawl_at INTEGER,
        fail_count INTEGER DEFAULT 0
    )''')
    conn.commit()
    return conn

def get_pending_urls(conn, limit=3):
    now = int(time.time())
    c = conn.cursor()
    c.execute(
        "SELECT url FROM urls WHERE status='PENDING' "
        "AND (next_crawl_at IS NULL OR next_crawl_at <= ?) "
        "ORDER BY (next_crawl_at IS NOT NULL), next_crawl_at ASC LIMIT ?",
        (now, limit)
    )
    rows = c.fetchall()
    return [row[0] for row in rows]

def mark_done(conn, url):
    now = int(time.time())
    next_crawl = now + COOLDOWN_SEC
    c = conn.cursor()
    c.execute(
        "UPDATE urls SET status='DONE', last_crawled_at=?, crawl_count=crawl_count+1, next_crawl_at=? WHERE url=?",
        (now, next_crawl, url)
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

def add_or_update_urls(conn, url_entries):
    c = conn.cursor()
    new_count = 0
    updated_count = 0
    for url, lastmod_ts in url_entries.items():
        try:
            c.execute(
                "INSERT INTO urls (url, status, lastmod_ts) VALUES (?, 'PENDING', ?)",
                (url, lastmod_ts)
            )
            new_count += 1
        except sqlite3.IntegrityError:
            c.execute("SELECT lastmod_ts FROM urls WHERE url=?", (url,))
            row = c.fetchone()
            stored_lastmod = row[0] if row else None
            if lastmod_ts is not None and (stored_lastmod is None or lastmod_ts > stored_lastmod):
                c.execute(
                    "UPDATE urls SET lastmod_ts=?, status='PENDING', next_crawl_at=NULL WHERE url=?",
                    (lastmod_ts, url)
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
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    except ValueError:
        return None

def strip_ns(tag):
    return tag.split('}', 1)[-1] if '}' in tag else tag

def fetch_sitemap_entries_recursive(sitemap_url, depth=0):
    if depth > 2:
        return {}
    entries = {}
    try:
        if depth == 0:
            log(f"Scanning Root Sitemap: {sitemap_url}")

        headers = {'User-Agent': random.choice(USER_AGENTS)}
        response = requests.get(sitemap_url, headers=headers, timeout=30)
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
    except Exception:
        return entries
    return entries

def sync_sitemap(conn):
    log("Syncing with Sitemap...", "HEADER")
    entries = fetch_sitemap_entries_recursive(SITEMAP_URL)
    fallbacks = [
        f"https://{HOST}/sitemap-tr.xml", f"https://{HOST}/sitemap-en.xml",
        f"https://{HOST}/sitemap-de.xml", f"https://{HOST}/sitemap-es.xml",
        f"https://{HOST}/sitemap-products-tr.xml", f"https://{HOST}/sitemap-products-en.xml"
    ]
    for fb in fallbacks:
        entries.update(fetch_sitemap_entries_recursive(fb))

    if entries:
        new_count, updated_count = add_or_update_urls(conn, entries)
        log(f"Sync Complete. Total URLs: {len(entries)}. New: {new_count}. Updated: {updated_count}", "SUCCESS")

# --- REQUEST HELPERS ---
def get_random_headers():
    return {
        'User-Agent': random.choice(USER_AGENTS),
        'Referer': random.choice(REFERRERS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
    }

def trigger_worker(args):
    name, target = args
    try:
        headers = get_random_headers()
        timeout = 6 if "Google" in name else 4
        res = requests.get(target, headers=headers, timeout=timeout)
        return (name, res.status_code)
    except Exception:
        return (name, 0)

def process_url_task(url):
    domain = HOST
    triggers = []

    selected_sources = random.sample(SAFE_RPCS, min(MAX_AUTHORITY_TRIGGERS, len(SAFE_RPCS)))
    for name, rpc in selected_sources:
        target = rpc.format(url=url, domain=domain)
        triggers.append((name, target))

    print(f"{Colors.OKBLUE}Target:{Colors.ENDC} {url} {Colors.UNDERLINE}({len(triggers)} Signals){Colors.ENDC}")

    start_time = time.time()
    success_count = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_TRIGGER_WORKERS) as executor:
        results = list(executor.map(trigger_worker, triggers))

    for name, code in results:
        if code == 200:
            success_count += 1

    total_time = round(time.time() - start_time, 2)
    print(f"  {Colors.OKGREEN}✓ Completed {success_count}/{len(triggers)} in {total_time}s{Colors.ENDC}")

    t_conn = sqlite3.connect(DB_FILE)
    mark_done(t_conn, url)
    t_conn.close()

def main():
    print(f"{Colors.HEADER}=== BALANCED INDEXER BOT ==={Colors.ENDC}")
    print(f"Workers: {MAX_URL_WORKERS} Concurrent URLs")
    print(f"Triggers per URL: {MAX_AUTHORITY_TRIGGERS}")
    print(f"Cooldown: {int(COOLDOWN_SEC / 3600)} hours")

    conn = init_db()
    sync_sitemap(conn)
    conn.close()

    last_sync = time.time()

    while True:
        now = time.time()
        if now - last_sync >= SITEMAP_SYNC_INTERVAL_SEC:
            conn = init_db()
            sync_sitemap(conn)
            conn.close()
            last_sync = now

        main_conn = sqlite3.connect(DB_FILE)
        unlock_due_urls(main_conn)
        batch = get_pending_urls(main_conn, limit=MAX_URL_WORKERS)
        main_conn.close()

        if not batch:
            log("No due URLs. Sleeping...", "INFO")
            time.sleep(IDLE_SLEEP_SEC)
            continue

        print(f"\n{Colors.HEADER}--- Processing Batch ({len(batch)}) ---{Colors.ENDC}")
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_URL_WORKERS) as executor:
            futures = [executor.submit(process_url_task, url) for url in batch]
            concurrent.futures.wait(futures)

        delay = random.randint(DELAY_MIN, DELAY_MAX)
        print(f"{Colors.OKCYAN}Batch complete. Cooling {delay}s...{Colors.ENDC}")
        time.sleep(delay)

if __name__ == "__main__":
    main()
