"""
🚀 UserReview.net SEO Pro Indexer Bot v2.0
============================================
SEO Master tarafından optimize edilmiş gelişmiş index botu.

Özellikler:
- ✅ IndexNow API (Bing/Yandex için anında indexleme)
- ✅ Detaylı dosya loglama (indexed_urls.log + CSV export)
- ✅ Akıllı URL önceliklendirme (priority + lastmod bazlı)
- ✅ Günlük/haftalık raporlama
- ✅ Rate limiting ve güvenli throttling
- ✅ Başarısız URL takibi
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

# Enable ANSI colors
os.system('')

# --- PATHS ---
SCRIPT_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = SCRIPT_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

LOG_FILE = LOG_DIR / "indexed_urls.log"
CSV_FILE = LOG_DIR / "indexed_urls.csv"
STATS_FILE = LOG_DIR / "daily_stats.json"
FAILED_LOG = LOG_DIR / "failed_urls.log"

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

def log_to_file(url, status, triggered_services, response_codes, elapsed_time):
    """Indexlenen URL'yi dosyaya logla"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] {status} | {url} | Services: {len(triggered_services)} | Success: {sum(1 for c in response_codes if c == 200)}/{len(response_codes)} | Time: {elapsed_time}s\n"
    
    # Text log
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_entry)
    
    # CSV log
    csv_exists = CSV_FILE.exists()
    with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not csv_exists:
            writer.writerow(["timestamp", "url", "status", "services_triggered", "success_count", "total_count", "elapsed_time", "services_detail"])
        writer.writerow([
            timestamp,
            url,
            status,
            len(triggered_services),
            sum(1 for c in response_codes if c == 200),
            len(response_codes),
            elapsed_time,
            "|".join(triggered_services)
        ])

def log_failed(url, reason):
    """Başarısız URL'yi logla"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(FAILED_LOG, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {url} | Reason: {reason}\n")

def update_daily_stats(urls_indexed, success_count, fail_count):
    """Günlük istatistikleri güncelle"""
    today = datetime.now().strftime("%Y-%m-%d")
    stats = {}
    
    if STATS_FILE.exists():
        try:
            with open(STATS_FILE, "r", encoding="utf-8") as f:
                stats = json.load(f)
        except:
            stats = {}
    
    if today not in stats:
        stats[today] = {"urls_indexed": 0, "success": 0, "fail": 0}
    
    stats[today]["urls_indexed"] += urls_indexed
    stats[today]["success"] += success_count
    stats[today]["fail"] += fail_count
    
    # Son 30 günü tut
    sorted_dates = sorted(stats.keys(), reverse=True)[:30]
    stats = {date: stats[date] for date in sorted_dates if date in stats}
    
    with open(STATS_FILE, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

def print_stats_summary():
    """İstatistik özeti göster"""
    if not STATS_FILE.exists():
        return
    
    try:
        with open(STATS_FILE, "r", encoding="utf-8") as f:
            stats = json.load(f)
        
        today = datetime.now().strftime("%Y-%m-%d")
        if today in stats:
            s = stats[today]
            log(f"📊 Bugünkü İstatistik: {s['urls_indexed']} URL | ✓ {s['success']} Başarılı | ✗ {s['fail']} Başarısız", "INFO")
    except:
        pass

# --- CONFIGURATION ---
HOST = "userreview.net"
INDEXNOW_KEY = "b59490923cf34772b03f94c9f516f0c0"
INDEXNOW_LOCATION = f"https://{HOST}/{INDEXNOW_KEY}.txt"
SITEMAP_URL = f"https://{HOST}/sitemap.xml"
DB_FILE = SCRIPT_DIR / "indexing_state_pro.db"

# THREADING & SPEED (LIGHT MODE - Sunucu dostu)
MAX_URL_WORKERS = 1          # Tek URL işle (sunucu yükü azaltma)
MAX_TRIGGER_WORKERS = 10     # Paralel HTTP istekleri (azaltıldı)
MAX_AUTHORITY_TRIGGERS = 35  # Her URL için trigger sayısı (70'ten 35'e düşürüldü)
DELAY_MIN = 8                # Minimum bekleme (artırıldı)
DELAY_MAX = 15               # Maximum bekleme (artırıldı)
COOLDOWN_SEC = 24 * 60 * 60  # 24 saat cooldown
SITEMAP_SYNC_INTERVAL_SEC = 20 * 60  # 20 dakikada bir sitemap sync
IDLE_SLEEP_SEC = 15

# URL PRIORITY WEIGHTS
PRIORITY_WEIGHTS = {
    "homepage": 1.0,
    "category": 0.8,
    "product": 0.7,
    "review": 0.7,
    "content": 0.6,
    "static": 0.3
}

# --- SEO TRIGGER SOURCES ---
# ═══════════════════════════════════════════════════════════════════════════════
# SEO Master tarafından optimize edilmiş 100+ kaynak
# Kategoriler: IndexNow, Google Tools, Validators, Social, Archive, 
#              DNS/WHOIS, Ping Services, SEO Tools, AI Search, Performance
# ═══════════════════════════════════════════════════════════════════════════════

CORE_TRIGGERS = [
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 0: OFFICIAL INDEXING APIs (EN KRİTİK - Direkt arama motorlarına bildirim)
    # ═══════════════════════════════════════════════════════════════════════════
    ("IndexNow Bing", "https://www.bing.com/indexnow?url={url}&key=" + INDEXNOW_KEY),
    ("IndexNow Yandex", "https://yandex.com/indexnow?url={url}&key=" + INDEXNOW_KEY),
    ("IndexNow API", "https://api.indexnow.org/indexnow?url={url}&key=" + INDEXNOW_KEY),
    ("IndexNow Seznam", "https://search.seznam.cz/indexnow?url={url}&key=" + INDEXNOW_KEY),  # Czech search engine
    ("IndexNow Naver", "https://searchadvisor.naver.com/indexnow?url={url}&key=" + INDEXNOW_KEY),  # Korean search engine
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 1: GOOGLE TOOLS (Google crawlerlarını tetikler)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Google Rich Results", "https://search.google.com/test/rich-results?url={url}"),
    ("Google Mobile Friendly", "https://search.google.com/test/mobile-friendly?url={url}"),
    ("Google PageSpeed", "https://pagespeed.web.dev/report?url={url}"),
    ("Google Translate", "https://translate.google.com/translate?sl=auto&tl=en&u={url}"),
    ("Google Translate FR", "https://translate.google.com/translate?sl=auto&tl=fr&u={url}"),
    ("Google Translate DE", "https://translate.google.com/translate?sl=auto&tl=de&u={url}"),
    ("Google Transparency", "https://transparencyreport.google.com/safe-browsing/search?url={url}"),
    ("Google Cache Check", "https://webcache.googleusercontent.com/search?q=cache:{url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 2: VALIDATORS & SCHEMA (Structured data doğrulaması)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Schema.org Validator", "https://validator.schema.org/#url={url}"),
    ("W3C HTML Validator", "https://validator.w3.org/nu/?doc={url}"),
    ("W3C CSS Validator", "https://jigsaw.w3.org/css-validator/validator?uri={url}"),
    ("W3C Link Checker", "https://validator.w3.org/checklink?uri={url}"),
    ("AMP Validator", "https://validator.ampproject.org/#url={url}"),
    ("RSS Validator", "https://validator.w3.org/feed/check.cgi?url={url}"),
]

SOCIAL_TRIGGERS = [
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 3: SOCIAL MEDIA VALIDATORS (Sosyal medya botlarını tetikler)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Facebook Debugger", "https://developers.facebook.com/tools/debug/?q={url}"),
    ("Twitter Card Validator", "https://cards-dev.twitter.com/validator?url={url}"),
    ("LinkedIn Inspector", "https://www.linkedin.com/post-inspector/inspect/{url}"),
    ("Pinterest Validator", "https://developers.pinterest.com/tools/url-debugger/?link={url}"),
    ("Telegram Preview", "https://t.me/iv?url={url}"),  # Telegram Instant View
    ("Reddit Preview", "https://www.reddit.com/submit?url={url}"),  # Reddit preview
    ("VK Share", "https://vk.com/share.php?url={url}"),  # VKontakte (Russian)
    ("Tumblr Share", "https://www.tumblr.com/widgets/share/tool?canonicalUrl={url}"),
]

SEO_TOOLS = [
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 4: SEO ANALYSIS TOOLS (SEO araç crawlerları)
    # ═══════════════════════════════════════════════════════════════════════════
    ("MetaTags Preview", "https://metatags.io/?url={url}"),
    ("OpenGraph XYZ", "https://opengraph.xyz/url/{url}"),
    ("HeyMeta Preview", "https://www.heymeta.com/?url={url}"),
    ("Social Share Preview", "https://socialsharepreview.com/?url={url}"),
    ("OpenGraph Dev", "https://opengraph.dev/?url={url}"),
    ("OpenGraph Check", "https://www.opengraphcheck.com/result.php?url={url}"),
    ("Seobility Check", "https://www.seobility.net/en/seocheck/?url={url}"),
    ("Seoptimer", "https://www.seoptimer.com/{domain}"),
    ("SEO Site Checkup", "https://seositecheckup.com/seo-audit/{domain}"),
    ("Nibbler Test", "https://nibbler.silktide.com/en_US/reports/{domain}"),
    ("Woorank Review", "https://www.woorank.com/en/www/{domain}"),
    ("SiteChecker Pro", "https://sitechecker.pro/seo-report/{domain}"),
]

AUTHORITY_TRIGGERS = [
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 5: ARCHIVE SERVICES (Kalıcı içerik kanıtı - ÇOK ÖNEMLİ!)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Wayback Machine", "https://web.archive.org/save/{url}"),
    ("Archive.is", "https://archive.is/?run=1&url={url}"),
    ("Archive.today", "https://archive.today/?run=1&url={url}"),
    ("Archive.ph", "https://archive.ph/?run=1&url={url}"),
    ("Archive.fo", "https://archive.fo/?run=1&url={url}"),
    ("Perma.cc", "https://perma.cc/service/generate?url={url}"),  # Academic archive
    ("Webcitation.org", "https://www.webcitation.org/archive?url={url}"),
    ("Megalodon.jp", "https://megalodon.jp/?url={url}"),  # Japanese archive
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 6: SECURITY SCANNERS (Güvenlik taramaları - Trust sinyali)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Norton SafeWeb", "https://safeweb.norton.com/report/show?url={url}"),
    ("Sucuri Check", "https://sitecheck.sucuri.net/results/{url}"),
    ("Mozilla Observatory", "https://observatory.mozilla.org/analyze/{domain}"),
    ("Security Headers", "https://securityheaders.com/?q={url}"),
    ("VirusTotal", "https://www.virustotal.com/gui/url/{url}"),
    ("URLVoid", "https://www.urlvoid.com/scan/{domain}"),
    ("McAfee SiteAdvisor", "https://www.siteadvisor.com/sitereport.html?url={domain}"),
    ("ScamAdviser", "https://www.scamadviser.com/check-website/{domain}"),
    ("MyWOT", "https://www.mywot.com/scorecard/{domain}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 7: PERFORMANCE TOOLS (Performans crawlerları)
    # ═══════════════════════════════════════════════════════════════════════════
    ("GTMetrix", "https://gtmetrix.com/analyze.html?bm=&url={url}"),
    ("WebPageTest", "https://www.webpagetest.org/?url={url}"),
    ("WordPress mShots", "https://s.wordpress.com/mshots/v1/{url}?w=1200"),
    ("Thum.io Screenshot", "https://image.thum.io/get/{url}"),
    ("Thum.io Wide", "https://image.thum.io/get/width/1200/{url}"),
    ("KeyCDN Speed", "https://tools.keycdn.com/speed?url={url}"),
    ("Dareboost", "https://www.dareboost.com/en/website-speed-test?url={url}"),
    ("Experte PageSpeed", "https://www.experte.com/pagespeed?url={url}"),
    ("Pingdom", "https://tools.pingdom.com/#!/cost/{url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 8: DOMAIN/WHOIS ANALYSIS (Domain authority sinyalleri)
    # ═══════════════════════════════════════════════════════════════════════════
    ("SimilarWeb", "https://www.similarweb.com/website/{domain}"),
    ("BuiltWith", "https://builtwith.com/{domain}"),
    ("HypeStat", "https://hypestat.com/info/{domain}"),
    ("StatShow", "https://www.statshow.com/www/{domain}"),
    ("StatsCrop", "https://www.statscrop.com/www/{domain}"),
    ("WebsiteInformer", "https://website.informer.com/{domain}"),
    ("SiteWorthTraffic", "https://www.siteworthtraffic.com/report/{domain}"),
    ("WorthOfWeb", "https://www.worthofweb.com/website-value/{domain}"),
    ("SitePrice", "https://www.siteprice.org/website-worth/{domain}"),
    ("SimilarSites", "https://www.similarsites.com/site/{domain}"),
    ("DomainTools", "https://whois.domaintools.com/{domain}"),
    ("Whois.com", "https://www.whois.com/whois/{domain}"),
    ("Who.is", "https://who.is/whois/{domain}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 9: DNS/NETWORK TOOLS (DNS crawlerları tetikler)
    # ═══════════════════════════════════════════════════════════════════════════
    ("DNSChecker", "https://dnschecker.org/#A/{domain}"),
    ("WhatsmyDNS", "https://www.whatsmydns.net/#A/{domain}"),
    ("MXToolbox", "https://mxtoolbox.com/SuperTool.aspx?action=mx%3a{domain}"),
    ("IntoDNS", "https://intodns.com/{domain}"),
    ("ViewDNS", "https://viewdns.info/dnsreport/?domain={domain}"),
    ("Robtex", "https://www.robtex.com/dns-lookup/{domain}"),
    ("DNSViz", "https://dnsviz.net/d/{domain}/analyze/"),
    ("SSLLabs", "https://www.ssllabs.com/ssltest/analyze.html?d={domain}"),
    ("CRT.sh", "https://crt.sh/?q={domain}"),  # Certificate transparency
    ("SecurityTrails", "https://securitytrails.com/domain/{domain}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 10: UPTIME/STATUS CHECKERS (Düzenli crawling tetikler)
    # ═══════════════════════════════════════════════════════════════════════════
    ("DownForEveryone", "https://downforeveryoneorjustme.com/{domain}"),
    ("IsItDownRightNow", "https://www.isitdownrightnow.com/{domain}.html"),
    ("UpDownRadar", "https://www.updownradar.com/status/{domain}"),
    ("CheckHost", "https://check-host.net/check-http?host={url}"),
    ("Site24x7", "https://www.site24x7.com/check-website-availability.html?url={url}"),
    ("HostTracker", "https://www.host-tracker.com/check_page/?furl={url}"),
    ("UptimeRobot", "https://uptimerobot.com/dashboard?url={url}"),
    ("Uptrends", "https://www.uptrends.com/tools/uptime?url={url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 11: BACKLINK/SEO PRO TOOLS (Premium SEO crawlerları)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Ahrefs Checker", "https://ahrefs.com/backlink-checker/?input={domain}"),
    ("SEMrush", "https://www.semrush.com/info/{domain}"),
    ("Moz Explorer", "https://moz.com/researchtools/ose/links?site={domain}"),
    ("Majestic", "https://www.majestic.com/reports/site-explorer?q={domain}"),
    ("Alexa", "https://www.alexa.com/siteinfo/{domain}"),
    ("SpyFu", "https://www.spyfu.com/overview/domain?query={domain}"),
    ("SERanking", "https://online.seranking.com/audit.html?url={url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 12: AI SEARCH ENGINES (YENİ - AI botlarını tetikler!)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Bing Chat", "https://www.bing.com/search?q=site:{domain}"),
    ("You.com", "https://you.com/search?q=site:{domain}"),
    ("Perplexity", "https://www.perplexity.ai/search?q={url}"),
    ("Phind", "https://www.phind.com/search?q={url}"),
    ("Kagi", "https://kagi.com/search?q=site:{domain}"),
    ("Brave Search", "https://search.brave.com/search?q=site:{domain}"),
    ("DuckDuckGo", "https://duckduckgo.com/?q=site:{domain}"),
    ("Ecosia", "https://www.ecosia.org/search?q=site:{domain}"),
    ("Qwant", "https://www.qwant.com/?q=site:{domain}"),
    ("Mojeek", "https://www.mojeek.com/search?q=site:{domain}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 13: REDIRECT & LINK TRACKERS (URL takip crawlerları)
    # ═══════════════════════════════════════════════════════════════════════════
    ("WhereGoes", "https://wheregoes.com/trace/{url}"),
    ("RedirectDetective", "https://redirectdetective.com/index.html?url={url}"),
    ("HTTPStatus", "https://httpstatus.io/status?url={url}"),
    ("Siteliner", "https://www.siteliner.com/{domain}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 14: REVIEW/TRUST PLATFORMS (E-E-A-T sinyalleri)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Trustpilot", "https://www.trustpilot.com/review/{domain}"),
    ("SiteJabber", "https://www.sitejabber.com/reviews/{domain}"),
    ("WebWiki", "https://www.webwiki.com/{domain}"),
    ("TalkReviews", "https://www.talkreviews.com/{domain}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 15: SCREENSHOT & THUMBNAIL SERVICES (Görsel cache oluşturur)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Screenshotlayer", "https://api.screenshotlayer.com/api/capture?url={url}"),
    ("ApiFlash", "https://api.apiflash.com/v1/urltoimage?url={url}"),
    ("PagePeeker", "https://pagepeeker.com/thumbs.php?size=x&url={url}"),
    ("ThumbnailWS", "https://thumbnail.ws/get/{url}"),
    ("ShrinkTheWeb", "https://images.shrinktheweb.com/xino.php?stwurl={url}"),
    ("Microlink", "https://api.microlink.io/?url={url}"),
    ("ScreenshotMachine", "https://www.screenshotmachine.com/index.php?url={url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 16: CARBON FOOTPRINT & GREEN WEB (Sürdürülebilirlik - Yeni SEO trendi)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Website Carbon", "https://www.websitecarbon.com/website/{domain}"),
    ("Green Web Check", "https://www.thegreenwebfoundation.org/green-web-check/?url={url}"),
    ("Ecograder", "https://ecograder.com/report/{domain}"),
    ("Digital Beacon", "https://digitalbeacon.co/report?url={url}"),
    ("Beacon", "https://www.beacon.tools/report?url={url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 17: ACCESSIBILITY CHECKERS (Erişilebilirlik - Ranking faktörü)
    # ═══════════════════════════════════════════════════════════════════════════
    ("WAVE", "https://wave.webaim.org/report#/{url}"),
    ("Axe DevTools", "https://www.deque.com/axe/axe-devtools/?url={url}"),
    ("AccessiBe Scan", "https://accessibe.com/accessscan?url={url}"),
    ("A11y Checker", "https://www.a11ycheck.com/?url={url}"),
    ("Pa11y", "https://pa11y.org/demo?url={url}"),
    ("ANDI", "https://www.ssa.gov/accessibility/andi/help/howtouse.html?url={url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 18: JSON-LD & STRUCTURED DATA VALIDATORS (Rich Snippets)
    # ═══════════════════════════════════════════════════════════════════════════
    ("JSON-LD Playground", "https://json-ld.org/playground/?url={url}"),
    ("Structured Data Linter", "http://linter.structured-data.org/?url={url}"),
    ("Bing Markup Validator", "https://www.bing.com/webmasters/markup-validator?url={url}"),
    ("Yandex Validator", "https://webmaster.yandex.com/tools/microtest/?url={url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 19: BLOG DIRECTORIES & AGGREGATORS (İçerik keşif platformları)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Blogarama", "https://www.blogarama.com/add-a-blog/?url={url}"),
    ("BlogCatalog", "https://www.blogcatalog.com/search?q={domain}"),
    ("AllTop", "https://alltop.com/search?q={domain}"),
    ("Feedly Discover", "https://feedly.com/i/discover/sources/search/{domain}"),
    ("Inoreader Discover", "https://www.inoreader.com/search/{domain}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 20: LINK SHORTENERS & PREVIEW (URL önizleme)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Bitly Preview", "https://bitly.com/a/warning?url={url}"),
    ("TinyURL Preview", "https://preview.tinyurl.com/{url}"),
    ("GetLinkInfo", "https://www.getlinkinfo.com/info?link={url}"),
    ("URLExpander", "https://urlex.org/search?url={url}"),
    ("UnShorten", "https://unshorten.it/link/{url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 21: CODE QUALITY & TECH ANALYSIS (Teknik SEO)
    # ═══════════════════════════════════════════════════════════════════════════
    ("W3C Internationalization", "https://validator.w3.org/i18n-checker/check?uri={url}"),
    ("Nu HTML Checker", "https://html5.validator.nu/?doc={url}"),
    ("CSS Stats", "https://cssstats.com/stats?url={url}"),
    ("Yellow Lab Tools", "https://yellowlab.tools/?url={url}"),
    ("Webhint", "https://webhint.io/scanner/{url}"),
    ("DebugBear", "https://www.debugbear.com/test/{url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 22: LOCAL SEO & CITATION (Yerel SEO)
    # ═══════════════════════════════════════════════════════════════════════════
    ("BrightLocal", "https://www.brightlocal.com/local-search-results-checker/?url={url}"),
    ("WhiteSpark", "https://whitespark.ca/google-business-profile-audit/?url={url}"),
    ("Yext PowerListings", "https://www.yext.com/pl/{domain}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 23: BROKEN LINK & CONTENT ANALYSIS
    # ═══════════════════════════════════════════════════════════════════════════
    ("Dead Link Checker", "https://www.deadlinkchecker.com/website-dead-link-checker.asp?u={url}"),
    ("Online Broken Link Checker", "https://www.brokenlinkcheck.com/broken-links.php?url={url}"),
    ("Dr. Link Check", "https://www.drlinkcheck.com/?url={url}"),
    ("Copyscape", "https://www.copyscape.com/?q={url}"),
    ("Plagiarism Checker", "https://www.duplichecker.com/plagiarism-checker.php?url={url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 24: INTERNATIONAL & HREFLANG (Çoklu dil SEO)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Hreflang Checker", "https://technicalseo.com/tools/hreflang/?url={url}"),
    ("Hreflang Tags Generator", "https://www.aleydasolis.com/english/international-seo-tools/hreflang-tags-generator/?url={url}"),
    ("International SEO Checker", "https://www.sistrix.com/hreflang-tag-generator/?url={url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 25: ADDITIONAL SEARCH ENGINES (Alternatif arama motorları)
    # ═══════════════════════════════════════════════════════════════════════════
    ("Sogou Search", "https://www.sogou.com/web?query=site:{domain}"),  # China
    ("Baidu Search", "https://www.baidu.com/s?wd=site:{domain}"),  # China
    ("Cốc Cốc", "https://coccoc.com/search?query=site:{domain}"),  # Vietnam
    ("ZipLook", "https://ziplook.io/search?q={domain}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 26: MEDIA & IMAGE ANALYSIS (Görsel SEO)
    # ═══════════════════════════════════════════════════════════════════════════
    ("TinEye Reverse", "https://tineye.com/search?url={url}"),
    ("Google Images", "https://www.google.com/searchbyimage?image_url={url}"),
    ("Image Size Checker", "https://www.image-size.com/?url={url}"),
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TIER 27: API & DEVELOPER TOOLS (Geliştirici araçları)
    # ═══════════════════════════════════════════════════════════════════════════
    ("ReqBin", "https://reqbin.com/curl/{url}"),
    ("Hoppscotch", "https://hoppscotch.io/?url={url}"),
    ("Web Code Tools", "https://webcode.tools/open-graph/inspect?url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# PING SERVICES (XML-RPC Blog Ping - Klasik SEO yöntemi)
# ═══════════════════════════════════════════════════════════════════════════════
PING_SERVERS = [
    "http://rpc.pingomatic.com",
    "http://ping.feedburner.com",
    "http://rpc.twingly.com",
    "http://ping.blo.gs/",
    "http://ping.bloggers.jp/rpc/",
    "http://blogsearch.google.com/ping/RPC2",
    "http://rpc.weblogs.com/RPC2",
    "http://api.my.yahoo.com/RPC2",
    "http://ping.fc2.com/",
    "http://ping.rss.drecom.jp/",
    "http://rpc.technorati.com/rpc/ping",
    "http://rpc.icerocket.com:10080/",
    "http://www.blogpeople.net/servlet/weblogUpdates",
]

# --- STEALTH ASSETS ---
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
]

REFERRERS = [
    "https://www.google.com/", "https://www.bing.com/", "https://duckduckgo.com/",
    "https://t.co/", "https://www.facebook.com/", "https://www.linkedin.com/",
    "https://news.google.com/", "https://www.reddit.com/"
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
    """Öncelik sırasına göre pending URL'leri getir"""
    now = int(time.time())
    c = conn.cursor()
    # Priority bazlı sıralama: yüksek priority + yeni lastmod önce
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
        c.execute(
            "UPDATE urls SET fail_count=fail_count+1 WHERE url=?",
            (url,)
        )
        # 3 kez başarısız olursa cooldown'a al
        c.execute("SELECT fail_count FROM urls WHERE url=?", (url,))
        row = c.fetchone()
        if row and row[0] >= 3:
            c.execute(
                "UPDATE urls SET status='DONE', next_crawl_at=? WHERE url=?",
                (now + COOLDOWN_SEC * 2, url)  # 2x cooldown
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
    """URL tipini belirle"""
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
            log(f"🗺️ Sitemap taranıyor: {sitemap_url}")

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
    except Exception as e:
        log(f"Sitemap hatası: {e}", "WARNING")
        return entries
    return entries

def sync_sitemap(conn):
    log("🔄 Sitemap ile senkronize ediliyor...", "HEADER")
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
        log(f"✅ Sync tamamlandı. Toplam: {len(entries)} URL | Yeni: {new_count} | Güncellenen: {updated_count}", "SUCCESS")
    
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
    name, target = args
    try:
        headers = get_random_headers()
        timeout = 8 if "Google" in name else 5
        res = requests.get(target, headers=headers, timeout=timeout, allow_redirects=True)
        return (name, res.status_code)
    except Exception:
        return (name, 0)

def submit_to_indexnow_batch(urls):
    """IndexNow'a toplu URL gönder"""
    try:
        payload = {
            "host": HOST,
            "key": INDEXNOW_KEY,
            "keyLocation": INDEXNOW_LOCATION,
            "urlList": urls
        }
        res = requests.post("https://api.indexnow.org/IndexNow", json=payload, timeout=10)
        return res.status_code in [200, 202]
    except:
        return False

def send_xml_rpc_ping(url, title="UserReview Content Update"):
    """XML-RPC ping gönder - Klasik SEO yöntemi"""
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
    
    # 3 rastgele ping server'a gönder
    selected_servers = random.sample(PING_SERVERS, min(3, len(PING_SERVERS)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        list(executor.map(ping_server, selected_servers))

def process_url_task(url):
    """Tek URL'yi işle ve logla - Her URL farklı random sinyal alır"""
    domain = HOST
    triggers = []
    triggered_services = []
    
    # ═══════════════════════════════════════════════════════════════════════════
    # YENİ SİSTEM: Sabit kritik kaynaklar + Random havuz
    # Her URL farklı kombinasyon alacak, tüm 170+ kaynak kullanılacak
    # ═══════════════════════════════════════════════════════════════════════════
    
    # TIER 1: SABİT KRİTİK KAYNAKLAR (Her zaman gönderilecek)
    # IndexNow API'leri - en önemli, direkt arama motorlarına bildirim
    critical_triggers = [
        t for t in CORE_TRIGGERS 
        if any(x in t[0] for x in ["IndexNow", "Google Rich", "Google Mobile", "Google PageSpeed"])
    ]
    
    # TIER 2: RANDOM HAVUZ (Tüm diğer kaynaklar)
    # Social, SEO Tools, Authority, Archive vs. hepsi bu havuzda
    random_pool = []
    random_pool.extend([t for t in CORE_TRIGGERS if t not in critical_triggers])
    random_pool.extend(SOCIAL_TRIGGERS)
    random_pool.extend(SEO_TOOLS)
    random_pool.extend(AUTHORITY_TRIGGERS)
    
    # Random seçim yap
    remaining_slots = MAX_AUTHORITY_TRIGGERS - len(critical_triggers)
    if remaining_slots > 0 and len(random_pool) > 0:
        selected_random = random.sample(random_pool, min(remaining_slots, len(random_pool)))
    else:
        selected_random = []
    
    # Birleştir
    all_triggers = critical_triggers + selected_random
    
    for name, rpc in all_triggers:
        target = rpc.format(url=url, domain=domain)
        triggers.append((name, target))
        triggered_services.append(name)

    print(f"{Colors.OKBLUE}🎯 Hedef:{Colors.ENDC} {url} {Colors.UNDERLINE}({len(triggers)} Sinyal + XML-RPC Ping){Colors.ENDC}", flush=True)

    start_time = time.time()
    success_count = 0
    response_codes = []
    
    # Arka planda XML-RPC ping gönder
    send_xml_rpc_ping(url)

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_TRIGGER_WORKERS) as executor:
        results = list(executor.map(trigger_worker, triggers))

    for name, code in results:
        response_codes.append(code)
        if code == 200:
            success_count += 1

    total_time = round(time.time() - start_time, 2)
    success_rate = (success_count / len(triggers)) * 100 if triggers else 0
    
    status = "SUCCESS" if success_rate >= 30 else "PARTIAL" if success_rate >= 10 else "FAILED"
    
    # Console'a yaz
    if status == "SUCCESS":
        print(f"  {Colors.OKGREEN}✓ Tamamlandı {success_count}/{len(triggers)} ({success_rate:.0f}%) - {total_time}s{Colors.ENDC}", flush=True)
    elif status == "PARTIAL":
        print(f"  {Colors.WARNING}! Kısmi {success_count}/{len(triggers)} ({success_rate:.0f}%) - {total_time}s{Colors.ENDC}", flush=True)
    else:
        print(f"  {Colors.FAIL}✗ Başarısız {success_count}/{len(triggers)} ({success_rate:.0f}%) - {total_time}s{Colors.ENDC}", flush=True)
    
    # Dosyaya logla (ÖNEMLİ!)
    log_to_file(url, status, triggered_services, response_codes, total_time)
    
    # DB güncelle
    t_conn = sqlite3.connect(str(DB_FILE))
    mark_done(t_conn, url, success=status != "FAILED")
    t_conn.close()
    
    # İstatistik güncelle
    update_daily_stats(1, 1 if status == "SUCCESS" else 0, 1 if status == "FAILED" else 0)
    
    if status == "FAILED":
        log_failed(url, f"Low success rate: {success_rate:.0f}%")
    
    return status == "SUCCESS"

def main():
    print(f"""
{Colors.HEADER}╔══════════════════════════════════════════════════════════════╗
║  🚀 UserReview.net SEO Pro Indexer Bot v2.2 [LIGHT MODE]     ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
║  📊 Log: logs/indexed_urls.log | CSV: indexed_urls.csv       ║
║  🔥 170+ SEO Kaynağı: 27 Tier | Sunucu Dostu Mod             ║
║  ⚙️  Workers: {MAX_URL_WORKERS} | Triggers: ~{MAX_AUTHORITY_TRIGGERS} | XML-RPC Ping: ✓                ║
║  ⏱️  Cooldown: {int(COOLDOWN_SEC / 3600)} saat | Akıllı Resume: ✓                       ║
╚══════════════════════════════════════════════════════════════╝{Colors.ENDC}
""")

    conn = init_db()
    stats = count_stats(conn)
    pending_count = stats.get('PENDING', 0)
    done_count = stats.get('DONE', 0)
    total_in_db = pending_count + done_count
    
    # Eğer DB'de bekleyen URL varsa, sitemap taramayı ATLA
    if pending_count > 0:
        log(f"📂 Kaldığı yerden devam ediliyor... PENDING: {pending_count} | DONE: {done_count}", "SUCCESS")
        log("ℹ️  Sitemap taraması atlandı (bekleyen URL'ler var)", "INFO")
    elif total_in_db > 0 and pending_count == 0:
        # Tüm URL'ler işlenmiş, yeni cycle için sitemap tara
        log(f"🎉 Önceki cycle tamamlanmış! DONE: {done_count} URL", "SUCCESS")
        log("🔄 Yeni URL'ler için sitemap taranıyor...", "HEADER")
        sync_sitemap(conn)
    else:
        # İlk çalıştırma - DB boş
        log("🆕 İlk çalıştırma tespit edildi. Sitemap taranıyor...", "HEADER")
        sync_sitemap(conn)
    
    conn.close()
    
    cycle_complete = False  # Tüm URL'ler işlendiğinde True olacak

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
                # Cycle tamamlandı - yeni sitemap sync yap
                log(f"🎉 Cycle tamamlandı! DONE: {done} URL işlendi.", "SUCCESS")
                print_stats_summary()
                cycle_complete = True
                
                log("🔄 Yeni URL'ler için sitemap tekrar taranıyor...", "HEADER")
                conn = init_db()
                new_urls = sync_sitemap(conn)
                conn.close()
                
                if new_urls > 0:
                    cycle_complete = False  # Yeni URL'ler var, devam et
                    continue
            
            log(f"⏸️ Bekleyen URL yok. PENDING: {pending} | DONE: {done} | Cooldown bekleniyor...", "INFO")
            time.sleep(IDLE_SLEEP_SEC)
            continue
        
        cycle_complete = False  # İşlenecek URL var

        print(f"\n{Colors.HEADER}━━━ Batch İşleniyor ({len(batch)} URL) ━━━{Colors.ENDC}", flush=True)
        
        for url in batch:
            process_url_task(url)

        delay = random.randint(DELAY_MIN, DELAY_MAX)
        print(f"{Colors.OKCYAN}⏳ Batch tamamlandı. {delay}s bekleniyor...{Colors.ENDC}", flush=True)
        time.sleep(delay)

if __name__ == "__main__":
    main()
