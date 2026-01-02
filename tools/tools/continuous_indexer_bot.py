import os
import sqlite3
import requests
import time
import random
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
import re
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
INDEXNOW_KEY = "b59490923cf34772b03f94c9f516f0c0"
INDEXNOW_LOCATION = f"https://{HOST}/{INDEXNOW_KEY}.txt"
SITEMAP_URL = f"https://{HOST}/sitemap.xml"
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "indexing_state.db")

# THREADING & SPEED
MAX_URL_WORKERS = 3       # Process 3 URLs at the same time
MAX_TRIGGER_WORKERS = 20  # Fire 20 triggers in parallel per URL
MAX_AUTHORITY_TRIGGERS = 80
DELAY_MIN = 2             
DELAY_MAX = 5

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
        last_crawled_at TIMESTAMP,
        crawl_count INTEGER DEFAULT 0
    )''')
    conn.commit()
    return conn

def get_pending_urls(conn, limit=3):
    c = conn.cursor()
    c.execute(f"SELECT url FROM urls WHERE status='PENDING' ORDER BY last_crawled_at ASC LIMIT {limit}")
    rows = c.fetchall()
    return [row[0] for row in rows]

def mark_done(conn, url):
    c = conn.cursor()
    c.execute("UPDATE urls SET status='DONE', last_crawled_at=?, crawl_count=crawl_count+1 WHERE url=?", (datetime.now(), url))
    conn.commit()

def reset_all_to_pending(conn):
    c = conn.cursor()
    c.execute("UPDATE urls SET status='PENDING'")
    conn.commit()
    log("All URLs reset to PENDING. Starting new cycle!", "HEADER")

def add_urls(conn, urls):
    c = conn.cursor()
    new_count = 0
    for url in urls:
        try:
            c.execute("INSERT INTO urls (url, status) VALUES (?, 'PENDING')", (url,))
            new_count += 1
        except sqlite3.IntegrityError: pass 
    conn.commit()
    return new_count

def count_stats(conn):
    c = conn.cursor()
    c.execute("SELECT status, COUNT(*) FROM urls GROUP BY status")
    return dict(c.fetchall())

def fetch_sitemap_urls_recursive(sitemap_url, depth=0):
    if depth > 2: return set()
    urls = set()
    try:
        if depth == 0: log(f"Scanning Root Sitemap: {sitemap_url}")
        
        headers = {'User-Agent': random.choice(USER_AGENTS)}
        response = requests.get(sitemap_url, headers=headers, timeout=30)
        
        if response.status_code != 200: return urls
        locs = re.findall(r'<loc>(.*?)</loc>', response.text)
        for loc in locs:
            loc = loc.strip()
            if loc.endswith('.xml'): urls.update(fetch_sitemap_urls_recursive(loc, depth+1))
            else: urls.add(loc)
    except: pass
    return urls

def sync_sitemap(conn):
    log("Syncing with Sitemap...", "HEADER")
    root_urls = fetch_sitemap_urls_recursive(SITEMAP_URL)
    fallbacks = [
        f"https://{HOST}/sitemap-tr.xml", f"https://{HOST}/sitemap-en.xml",
        f"https://{HOST}/sitemap-de.xml", f"https://{HOST}/sitemap-es.xml",
        f"https://{HOST}/sitemap-ar.xml", f"https://{HOST}/sitemap-products-tr.xml",
        f"https://{HOST}/sitemap-products-en.xml"
    ]
    for fb in fallbacks: root_urls.update(fetch_sitemap_urls_recursive(fb))

    if root_urls:
        added = add_urls(conn, root_urls)
        log(f"Sync Complete. Total URLs: {len(root_urls)}. New: {added}", "SUCCESS")

def get_random_headers():
    return {
        'User-Agent': random.choice(USER_AGENTS),
        'Referer': random.choice(REFERRERS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Cache-Control': 'no-cache',
    }

def submit_to_indexnow_single(url):
    """Submits a single URL to IndexNow (Bing/Yandex)"""
    try:
        payload = {
            "host": HOST,
            "key": INDEXNOW_KEY,
            "keyLocation": INDEXNOW_LOCATION,
            "urlList": [url]
        }
        requests.post("https://api.indexnow.org/IndexNow", json=payload, timeout=3)
        return True
    except:
        return False

def mass_xml_ping(title, url):
    ping_servers = [
        "http://rpc.pingomatic.com", "http://blogsearch.google.com/ping/RPC2",
        "http://rpc.twingly.com", "http://ping.feedburner.com",
        "http://rpc.weblogs.com/RPC2", "http://www.blogdigger.com/RPC2",
        "http://rpc.technorati.com/rpc/ping", "http://ping.blo.gs/",
        "http://www.pingmyblog.com/"
    ]
    selected = random.sample(ping_servers, 3)
    def send_ping(server):
        try:
            payload = f"""<?xml version="1.0"?>
            <methodCall>
              <methodName>weblogUpdates.ping</methodName>
              <params><param><value>{HOST}</value></param><param><value>{url}</value></param></params>
            </methodCall>"""
            requests.post(server, data=payload, timeout=2)
            return True
        except: return False
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        list(executor.map(send_ping, selected))

def trigger_worker(args):
    name, target = args
    try:
        headers = get_random_headers()
        to = 6 if "Google" in name else 4
        res = requests.get(target, headers=headers, timeout=to)
        return (name, res.status_code)
    except:
        return (name, 0)

def process_url_task(url, conn_mutex):
    domain = HOST
    ts = int(time.time())
    triggers = []
    
    # 0. OFFICIAL INDEXING API (IndexNow)
    # This is "Tier 0" - The most powerful official method for non-Google engines
    triggers.append(("IndexNow (Bing/Yandex)", f"https://api.indexnow.org/indexnow?url={url}&key={INDEXNOW_KEY}&keyLocation={INDEXNOW_LOCATION}"))

    # 1. CORE GOOGLE TOOLS
    triggers.append(("Google Translate", f"https://translate.google.com/translate?sl=auto&tl=fr&u={url}?t={ts}"))
    triggers.append(("PageSpeed Insights", f"https://pagespeed.web.dev/report?url={url}"))
    triggers.append(("Google Mobile Friend", f"https://search.google.com/test/mobile-friendly?url={url}"))

    # 2. SECURITY GIANTS
    triggers.append(("Norton SafeWeb", f"https://safeweb.norton.com/report/show?url={url}"))
    triggers.append(("McAfee SiteAdvisor", f"https://www.siteadvisor.com/sitereport.html?url={domain}"))
    triggers.append(("Google Transparency", f"https://transparencyreport.google.com/safe-browsing/search?url={url}"))
    triggers.append(("Sucuri Check", f"https://sitecheck.sucuri.net/results/{url}"))
    triggers.append(("VirusTotal", f"https://www.virustotal.com/gui/url/submission?url={url}"))
    triggers.append(("UrlScan.io", f"https://urlscan.io/search/#{domain}"))

    # 3. PERFORMANCE TOOLS
    triggers.append(("WebPageTest", f"https://www.webpagetest.org/?url={url}"))
    triggers.append(("GTMetrix", f"https://gtmetrix.com/analyze.html?bm=&url={url}"))
    triggers.append(("KeyCDN Tool", f"https://tools.keycdn.com/speed?url={url}"))
    triggers.append(("Pingdom", f"https://tools.pingdom.com/#!/c2L5O/http://{url}"))
    triggers.append(("AMP Validator", f"https://validator.ampproject.org/#url={url}"))

    # 4. SOCIAL & SEO
    triggers.append(("Twitter Validator", f"https://cards-dev.twitter.com/validator?url={url}")) 
    triggers.append(("LinkedIn Inspector", f"https://www.linkedin.com/post-inspector/inspect/{url}"))
    triggers.append(("Pinterest Validator", f"https://developers.pinterest.com/tools/url-debugger/?link={url}"))
    
    # 5. TIER 5: MASSIVE AUTHORITY LIST
    whois_rpcs = [
        ("DomainTools", f"https://whois.domaintools.com/{domain}"),
        ("SimilarWeb", f"https://www.similarweb.com/website/{domain}"),
        ("Alexa Info", f"https://www.alexa.com/siteinfo/{domain}"),
        ("HypeStat", f"https://hypestat.com/info/{domain}"),
        ("WebsiteInformer", f"https://website.informer.com/{domain}"),
        ("SSLLabs", f"https://www.ssllabs.com/ssltest/analyze.html?d={domain}"),
        (f"GeoCerts", f"https://www.geocerts.com/ssl-checker?domain={domain}"),
        (f"RedirectCheck", f"https://wheregoes.com/trace?url={url}"),
        (f"HttpStatus", f"https://httpstatus.io/status?url={url}"),
        (f"Wayback Save", f"https://web.archive.org/save/{url}"),
        (f"BuiltWith", f"https://builtwith.com/{domain}"),
        (f"W3Techs", f"https://www.w3techs.com/sites/info/{domain}"),
        (f"CheckHost", f"https://check-host.net/check-http?host={url}"),
        (f"URLVoid", f"https://www.urlvoid.com/scan/{domain}/"),
        (f"SemRush", f"https://www.semrush.com/info/{domain}"),
        (f"Majestic", f"https://www.majestic.com/reports/site-explorer?q={domain}"),
        (f"TalkReviews", f"https://www.talkreviews.com/{domain}"),
        (f"Moz Link Explorer", f"https://moz.com/researchtools/ose/links?site={domain}"),
        (f"Ahrefs Backlinks", f"https://ahrefs.com/backlink-checker/?input={domain}&mode=subdomains"),
        (f"UptimeRobot", f"https://uptimerobot.com/dashboard?url={url}"),
        (f"DownForEveryone", f"https://downforeveryoneorjustme.com/{domain}"),
        (f"SEOChk", f"https://seochk.com/analysis/{domain}"),
        (f"SiteChecker", f"https://sitechecker.pro/seo-report/{domain}"),
        (f"Woorank", f"https://www.woorank.com/en/www/{domain}"),
        (f"Archive.is", f"https://archive.is/?run=1&url={url}"),
        (f"SeoSiteCheckup", f"https://seositecheckup.com/analysis/{domain}"),
        (f"Nibbler", f"https://nibbler.silktide.com/en_US/reports/{domain}"),
        (f"DNSDumpster", f"https://dnsdumpster.com/static/map/{domain}.png"),
        (f"SecurityHeaders", f"https://securityheaders.com/?q={url}"),
        (f"IntoDNS", f"https://intodns.com/{domain}"),
        (f"ViewDNS", f"https://viewdns.info/dnsreport/?domain={domain}"),
        (f"MXToolbox", f"https://mxtoolbox.com/SuperTool.aspx?action=mx%3a{domain}"),
        (f"WhatMyDNS", f"https://www.whatsmydns.net/#A/{domain}"),
        (f"Site24x7", f"https://www.site24x7.com/check-website-availability.html?url={url}"),
        (f"Varvy SEO", f"https://varvy.com/tools/mobile/"),
        (f"IsEating", f"https://isitdownorjust.me/{domain}"),
        (f"UpTrends", f"https://www.uptrends.com/tools/uptime?url={url}"),
        (f"SiteLike", f"https://www.sitelike.org/similar/{domain}/"),
        (f"TrafficEstimate", f"https://www.trafficestimate.com/{domain}"),
        (f"Quantcast", f"https://www.quantcast.com/{domain}"),
        (f"Compete", f"https://www.compete.com/{domain}"),
        (f"Mojeek", f"https://www.mojeek.com/search?q=site%3A{domain}"),
        (f"Gigablast", f"https://www.gigablast.com/search?q=site%3A{domain}"),
    ]
    
    extra_rpcs = [
        ("Google Rich Results", f"https://search.google.com/test/rich-results?url={url}"),
        ("Schema.org Validator", f"https://validator.schema.org/#url={url}"),
        ("W3C HTML Validator", f"https://validator.w3.org/nu/?doc={url}"),
        ("W3C CSS Validator", f"https://jigsaw.w3.org/css-validator/validator?uri={url}"),
        ("W3C Link Checker", f"https://validator.w3.org/checklink?uri={url}"),
        ("W3C Feed Validator", f"https://validator.w3.org/feed/check.cgi?url={url}"),
        ("Feed Validator", f"https://feedvalidator.org/check.cgi?url={url}"),
        ("Mozilla Observatory", f"https://observatory.mozilla.org/analyze/{domain}"),
        ("Facebook Sharing Debugger", f"https://developers.facebook.com/tools/debug/?q={url}"),
        ("Social Share Preview", f"https://socialsharepreview.com/?url={url}"),
        ("MetaTags Preview", f"https://metatags.io/?url={url}"),
        ("HeyMeta Preview", f"https://www.heymeta.com/?url={url}"),
        ("OpenGraph XYZ", f"https://opengraph.xyz/url/{url}"),
        ("OpenGraph Dev", f"https://opengraph.dev/?url={url}"),
        ("OpenGraph Check", f"https://www.opengraphcheck.com/result.php?url={url}"),
        ("Seobility Check", f"https://www.seobility.net/en/seocheck/?url={url}"),
        ("Seoptimer Report", f"https://www.seoptimer.com/{domain}"),
        ("SEO Review Tools", f"https://www.seoreviewtools.com/website-review/{domain}"),
        ("SEOCentro Analysis", f"https://www.seocentro.com/tools/seo/analysis/?url={url}"),
        ("WebWiki", f"https://www.webwiki.com/{domain}"),
        ("StatShow", f"https://www.statshow.com/www/{domain}"),
        ("StatsCrop", f"https://www.statscrop.com/www/{domain}"),
        ("SiteWorthTraffic", f"https://www.siteworthtraffic.com/report/{domain}"),
        ("WebsiteWorthValue", f"https://www.websiteworthvalue.com/website/{domain}"),
        ("SiteRankData", f"https://www.siterankdata.com/{domain}"),
        ("SitePrice", f"https://www.siteprice.org/website-worth/{domain}"),
        ("WorthOfWeb", f"https://www.worthofweb.com/website-value/{domain}/"),
        ("SimilarSites", f"https://www.similarsites.com/site/{domain}"),
        ("SiteJabber", f"https://www.sitejabber.com/reviews/{domain}"),
        ("Trustpilot", f"https://www.trustpilot.com/review/{domain}"),
        ("ScamAdviser", f"https://www.scamadviser.com/check-website/{domain}"),
        ("MyWOT", f"https://www.mywot.com/scorecard/{domain}"),
        ("IsItDownRightNow", f"https://www.isitdownrightnow.com/{domain}.html"),
        ("UpDownRadar", f"https://www.updownradar.com/status/{domain}"),
        ("DownInspector", f"https://downinspector.com/check/{domain}"),
        ("Host Tracker", f"https://www.host-tracker.com/check_page/?furl={url}"),
        ("Whois (who.is)", f"https://who.is/whois/{domain}"),
        ("Whois (whois.com)", f"https://www.whois.com/whois/{domain}"),
        ("RDAP Lookup", f"https://rdap.org/domain/{domain}"),
        ("Robtex DNS", f"https://www.robtex.com/dns-lookup/{domain}"),
        ("DNS Checker", f"https://dnschecker.org/#A/{domain}"),
        ("Certificate Transparency", f"https://crt.sh/?q={domain}"),
        ("SecurityTrails", f"https://securitytrails.com/domain/{domain}"),
        ("DNSViz", f"https://dnsviz.net/d/{domain}/analyze"),
        ("DNSLookup Online", f"https://dnslookup.online/{domain}"),
        ("WordPress mShots", f"https://s.wordpress.com/mshots/v1/{url}?w=1200"),
        ("Thum.io", f"https://image.thum.io/get/{url}"),
        ("Thum.io (Wide)", f"https://image.thum.io/get/width/1200/{url}"),
        ("Archive.ph", f"https://archive.ph/?run=1&url={url}"),
        ("Archive.today", f"https://archive.today/?run=1&url={url}"),
        ("Siteliner", f"https://www.siteliner.com/{domain}"),
        ("Dareboost", f"https://www.dareboost.com/en/website-speed-test?url={url}"),
        ("Experte PageSpeed", f"https://www.experte.com/pagespeed?url={url}"),
        ("CheckPageRank", f"https://checkpagerank.net/index.php?url={url}"),
        ("PRChecker", f"https://prchecker.info/check_page_rank.php?url={url}"),
    ]

    # Random Authority Sources + All Core
    authority_rpcs = whois_rpcs + extra_rpcs
    selected_sources = random.sample(authority_rpcs, min(MAX_AUTHORITY_TRIGGERS, len(authority_rpcs)))
    for name, rpc in selected_sources: triggers.append((name, rpc))

    print(f"{Colors.OKBLUE}Target:{Colors.ENDC} {url} {Colors.UNDERLINE}({len(triggers)} Signals){Colors.ENDC}")
    
    # --- FIRE TRIGGERS IN PARALLEL ---
    start_time = time.time()
    success_count = 0
    
    # 1. Background XML Ping & IndexNow (Fast)
    mass_xml_ping("Update", url)
    submit_to_indexnow_single(url) # Fire and forget style
    
    # 2. Parallel HTTP Requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_TRIGGER_WORKERS) as executor:
        results = list(executor.map(trigger_worker, triggers))
        
    for name, code in results:
        if code == 200: success_count += 1
        
    total_time = round(time.time() - start_time, 2)
    print(f"  {Colors.OKGREEN}✓ Completed {success_count}/{len(triggers)} in {total_time}s{Colors.ENDC}")
    
    # Remove the mutex lock since it's passed as None and each thread opens its own connection
    t_conn = sqlite3.connect(DB_FILE)
    mark_done(t_conn, url)
    t_conn.close()

def main():
    print(f"{Colors.HEADER}=== INFINITY INDEXER BOT v8 (TIER 5) ==={Colors.ENDC}")
    print(f"Workers: {MAX_URL_WORKERS} Concurrent URLs")
    print(f"Source Pool: 100+ Authority Domains")
    print(f"IndexNow: ENABLED (Bing/Yandex)")
    
    conn = init_db()
    sync_sitemap(conn)
    conn.close()
    
    while True:
        main_conn = sqlite3.connect(DB_FILE)
        batch = get_pending_urls(main_conn, limit=MAX_URL_WORKERS)
        main_conn.close()
        
        if not batch:
            main_conn = sqlite3.connect(DB_FILE)
            stats = count_stats(main_conn)
            log(f"Cycle Finished! Stats: {stats}. Restarting...", "HEADER")
            reset_all_to_pending(main_conn)
            main_conn.close()
            time.sleep(10)
            continue
            
        print(f"\n{Colors.HEADER}--- Processing Batch ({len(batch)}) ---{Colors.ENDC}")
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_URL_WORKERS) as executor:
            # Fake Mutex (just None)
            futures = [executor.submit(process_url_task, url, None) for url in batch]
            concurrent.futures.wait(futures)
            
        delay = random.randint(DELAY_MIN, DELAY_MAX)
        print(f"{Colors.OKCYAN}Batch complete. Cooling {delay}s...{Colors.ENDC}")
        time.sleep(delay)

if __name__ == "__main__":
    main()
