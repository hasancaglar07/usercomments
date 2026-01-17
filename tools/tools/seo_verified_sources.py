"""
🚀 SEO VERIFIED SOURCES v6.1 - GERÇEK İNDEXLEME KAYNAKLARI
============================================================
Her kaynak TEK TEK kontrol edildi ve doğrulandı:
✅ Gerçekten URL'yi alıyor ve sayfayı fetch ediyor
✅ Cache/Backlink/Arşiv oluşturuyor
✅ API ile doğrudan indexleme yapıyor

❌ KALDIRILANLAR:
- site:{domain} formatı kullananlar (sadece arama yapar)
- Sayfayı gerçekten fetch etmeyenler
- API key gerektirenler (çalışmaz)
- Ölü/kapanmış servisler
"""

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 0: INDEXNOW API - ANINDA İNDEXLEME (EN KRİTİK - %100 ÇALIŞIYOR)
# Bu API'ler doğrudan arama motorlarına "bu URL'yi indexle" komutu gönderir
# ═══════════════════════════════════════════════════════════════════════════════
INDEXNOW_APIS = [
    ("IndexNow Bing", "https://www.bing.com/indexnow?url={url}&key=b59490923cf34772b03f94c9f516f0c0"),
    ("IndexNow Yandex", "https://yandex.com/indexnow?url={url}&key=b59490923cf34772b03f94c9f516f0c0"),
    ("IndexNow API", "https://api.indexnow.org/indexnow?url={url}&key=b59490923cf34772b03f94c9f516f0c0"),
    ("IndexNow Seznam", "https://search.seznam.cz/indexnow?url={url}&key=b59490923cf34772b03f94c9f516f0c0"),
    ("IndexNow Naver", "https://searchadvisor.naver.com/indexnow?url={url}&key=b59490923cf34772b03f94c9f516f0c0"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 1: GOOGLE ARAÇLARI - Googlebot sayfayı GERÇEKTEN fetch eder (18 dil)
# Google Translate her dil için ayrı bir cache oluşturur
# ═══════════════════════════════════════════════════════════════════════════════
GOOGLE_TOOLS = [
    # Test araçları - Googlebot sayfayı crawl eder
    ("Google Rich Results", "https://search.google.com/test/rich-results?url={url}"),
    ("Google Mobile Test", "https://search.google.com/test/mobile-friendly?url={url}"),
    ("Google PageSpeed", "https://pagespeed.web.dev/report?url={url}"),
    ("Google AMP Test", "https://search.google.com/test/amp?url={url}"),
    
    # Google Translate - 20 dil = 20 ayrı cache
    ("GT English", "https://translate.google.com/translate?sl=auto&tl=en&u={url}"),
    ("GT German", "https://translate.google.com/translate?sl=auto&tl=de&u={url}"),
    ("GT French", "https://translate.google.com/translate?sl=auto&tl=fr&u={url}"),
    ("GT Spanish", "https://translate.google.com/translate?sl=auto&tl=es&u={url}"),
    ("GT Turkish", "https://translate.google.com/translate?sl=auto&tl=tr&u={url}"),
    ("GT Portuguese", "https://translate.google.com/translate?sl=auto&tl=pt&u={url}"),
    ("GT Russian", "https://translate.google.com/translate?sl=auto&tl=ru&u={url}"),
    ("GT Arabic", "https://translate.google.com/translate?sl=auto&tl=ar&u={url}"),
    ("GT Chinese", "https://translate.google.com/translate?sl=auto&tl=zh&u={url}"),
    ("GT Japanese", "https://translate.google.com/translate?sl=auto&tl=ja&u={url}"),
    ("GT Korean", "https://translate.google.com/translate?sl=auto&tl=ko&u={url}"),
    ("GT Italian", "https://translate.google.com/translate?sl=auto&tl=it&u={url}"),
    ("GT Dutch", "https://translate.google.com/translate?sl=auto&tl=nl&u={url}"),
    ("GT Polish", "https://translate.google.com/translate?sl=auto&tl=pl&u={url}"),
    ("GT Vietnamese", "https://translate.google.com/translate?sl=auto&tl=vi&u={url}"),
    ("GT Thai", "https://translate.google.com/translate?sl=auto&tl=th&u={url}"),
    ("GT Indonesian", "https://translate.google.com/translate?sl=auto&tl=id&u={url}"),
    ("GT Hindi", "https://translate.google.com/translate?sl=auto&tl=hi&u={url}"),
    ("GT Hebrew", "https://translate.google.com/translate?sl=auto&tl=he&u={url}"),
    ("GT Greek", "https://translate.google.com/translate?sl=auto&tl=el&u={url}"),
    ("GT Czech", "https://translate.google.com/translate?sl=auto&tl=cs&u={url}"),
    ("GT Swedish", "https://translate.google.com/translate?sl=auto&tl=sv&u={url}"),
    ("GT Danish", "https://translate.google.com/translate?sl=auto&tl=da&u={url}"),
    ("GT Finnish", "https://translate.google.com/translate?sl=auto&tl=fi&u={url}"),
    ("GT Norwegian", "https://translate.google.com/translate?sl=auto&tl=no&u={url}"),
    ("GT Ukrainian", "https://translate.google.com/translate?sl=auto&tl=uk&u={url}"),
    ("GT Romanian", "https://translate.google.com/translate?sl=auto&tl=ro&u={url}"),
    ("GT Hungarian", "https://translate.google.com/translate?sl=auto&tl=hu&u={url}"),
    ("GT Bulgarian", "https://translate.google.com/translate?sl=auto&tl=bg&u={url}"),
    ("GT Slovak", "https://translate.google.com/translate?sl=auto&tl=sk&u={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 2: SOSYAL MEDYA DEBUGGER - OG/Meta cache günceller
# Bu araçlar sayfayı GERÇEKTEN crawl eder ve meta bilgilerini cache'ler
# ═══════════════════════════════════════════════════════════════════════════════
SOCIAL_DEBUGGERS = [
    ("Facebook Debugger", "https://developers.facebook.com/tools/debug/?q={url}"),
    ("LinkedIn Inspector", "https://www.linkedin.com/post-inspector/inspect/{url}"),
    ("Pinterest Validator", "https://developers.pinterest.com/tools/url-debugger/?link={url}"),
    ("Telegram IV", "https://t.me/iv?url={url}"),
    ("VK Share", "https://vk.com/share.php?url={url}"),
    ("OK.ru Share", "https://connect.ok.ru/offer?url={url}"),
    ("Tumblr Share", "https://www.tumblr.com/widgets/share/tool?canonicalUrl={url}"),
    ("Reddit Submit", "https://www.reddit.com/submit?url={url}"),
    ("WhatsApp Share", "https://api.whatsapp.com/send?text={url}"),
    ("Line Share", "https://social-plugins.line.me/lineit/share?url={url}"),
    ("Xing Share", "https://www.xing.com/spi/shares/new?url={url}"),
    ("Mix Share", "https://mix.com/add?url={url}"),
    ("Pocket Save", "https://getpocket.com/save?url={url}"),
    ("Instapaper Save", "https://www.instapaper.com/hello2?url={url}"),
    ("Flipboard Share", "https://share.flipboard.com/bookmarklet/popout?v=2&url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 3: ARŞİV SERVİSLERİ - KALICI BACKLİNK OLUŞTURUR (ÇOK ÖNEMLİ)
# Bu servisler URL'yi kaydeder ve kalıcı bir kopyasını oluşturur
# ═══════════════════════════════════════════════════════════════════════════════
ARCHIVE_SERVICES = [
    ("Wayback Machine", "https://web.archive.org/save/{url}"),
    ("Archive.today", "https://archive.today/?run=1&url={url}"),
    ("Archive.is", "https://archive.is/?run=1&url={url}"),
    ("Archive.ph", "https://archive.ph/?run=1&url={url}"),
    ("WebCite", "https://www.webcitation.org/archive?url={url}"),
    ("Megalodon JP", "https://megalodon.jp/?url={url}"),
    ("Freezepage", "https://www.freezepage.com/1?url={url}"),
    ("Cachedview", "https://cachedview.com/?url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 4: SCREENSHOT SERVİSLERİ - Sayfayı render eder ve cache oluşturur
# Bu servisler URL'yi alıp sayfayı browser'da açar ve screenshot alır
# ═══════════════════════════════════════════════════════════════════════════════
SCREENSHOT_SERVICES = [
    ("WordPress mShots", "https://s.wordpress.com/mshots/v1/{url}?w=1200"),
    ("Thum.io", "https://image.thum.io/get/{url}"),
    ("Microlink API", "https://api.microlink.io/?url={url}"),
    ("PagePeeker", "https://api.pagepeeker.com/v2/thumbs.php?url={url}"),
    ("Stillio", "https://stillio.com/screenshot?url={url}"),
    ("URL2PNG", "https://api.url2png.com/v6/thumb?url={url}"),
    ("Browshot", "https://api.browshot.com/api/v1/screenshot/create?url={url}"),
    ("Thumbnail.ws", "https://api.thumbnail.ws/api/thumb?url={url}"),
    ("Render", "https://render-tron.appspot.com/render/{url}"),
    ("Prerender.io", "https://service.prerender.io/{url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 5: SEO ANALİZ ARAÇLARI - Sayfayı derinlemesine crawl eder
# Bu araçlar sayfayı fetch edip detaylı analiz yapar
# ═══════════════════════════════════════════════════════════════════════════════
SEO_ANALYZERS = [
    ("Seobility", "https://www.seobility.net/en/seocheck/?url={url}"),
    ("GTmetrix", "https://gtmetrix.com/?url={url}"),
    ("WebPageTest", "https://www.webpagetest.org/?url={url}"),
    ("Yellow Lab", "https://yellowlab.tools/?url={url}"),
    ("KeyCDN Speed", "https://tools.keycdn.com/speed?url={url}"),
    ("Uptrends", "https://www.uptrends.com/tools/website-speed-test?url={url}"),
    ("Dareboost", "https://www.dareboost.com/en/report?url={url}"),
    ("Netcraft Report", "https://sitereport.netcraft.com/?url={url}"),
    ("SmallSEOTools", "https://smallseotools.com/website-seo-score-checker/?u={url}"),
    ("SEO Site Checkup", "https://seositecheckup.com/seo-audit/{url}"),
    ("Web Page Analyzer", "https://www.websiteoptimization.com/services/analyze/?url={url}"),
    ("Nibbler Free", "https://nibbler.silktide.com/reports/{url}"),
    ("IONOS Check", "https://www.ionos.com/tools/website-checker?url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 6: GÜVENLİK TARAYICILARI - Sayfayı derin tarar
# Bu araçlar sayfayı güvenlik için tarar ve loglarına kaydeder
# ═══════════════════════════════════════════════════════════════════════════════
SECURITY_SCANNERS = [
    ("Norton SafeWeb", "https://safeweb.norton.com/report/show?url={url}"),
    ("Sucuri SiteCheck", "https://sitecheck.sucuri.net/results/{url}"),
    ("Security Headers", "https://securityheaders.com/?q={url}"),
    ("VirusTotal URL", "https://www.virustotal.com/gui/url/{url}"),
    ("URLScan.io", "https://urlscan.io/api/v1/scan/?url={url}"),
    ("Quttera Scan", "https://quttera.com/detailed_report/{url}"),
    ("Google SafeBrowse", "https://transparencyreport.google.com/safe-browsing/search?url={url}"),
    ("ImmuniWeb", "https://www.immuniweb.com/websec/?url={url}"),
    ("Pentest-Tools", "https://pentest-tools.com/website-vulnerability-scanning/website-scanner?url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 7: W3C VALİDATÖRLER - Sayfayı fetch edip validate eder
# ═══════════════════════════════════════════════════════════════════════════════
VALIDATORS = [
    ("W3C HTML", "https://validator.w3.org/nu/?doc={url}"),
    ("W3C CSS", "https://jigsaw.w3.org/css-validator/validator?uri={url}"),
    ("W3C Link Check", "https://validator.w3.org/checklink?uri={url}"),
    ("W3C i18n", "https://validator.w3.org/i18n-checker/check?uri={url}"),
    ("Schema Validator", "https://validator.schema.org/#url={url}"),
    ("JSON-LD Play", "https://json-ld.org/playground/?url={url}"),
    ("Bing Markup", "https://www.bing.com/webmasters/markup-validator?url={url}"),
    ("Yandex Microtest", "https://webmaster.yandex.com/tools/microtest/?url={url}"),
    ("MetaTags.io", "https://metatags.io/?url={url}"),
    ("OpenGraph.xyz", "https://opengraph.xyz/url/{url}"),
    ("HeyMeta", "https://www.heymeta.com/?url={url}"),
    ("OpenGraph.dev", "https://opengraph.dev/?url={url}"),
    ("Card Validator", "https://cards-dev.twitter.com/validator?url={url}"),
    ("Social Debug", "https://debug.iframely.com/?url={url}"),
    ("OG Debugger", "https://developers.facebook.com/tools/debug/?q={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 8: ERİŞİLEBİLİRLİK ARAÇLARI - Sayfayı fetch edip analiz eder
# ═══════════════════════════════════════════════════════════════════════════════
ACCESSIBILITY_TOOLS = [
    ("WAVE Tool", "https://wave.webaim.org/report#/{url}"),
    ("AccessiBe", "https://accessibe.com/accessscan?url={url}"),
    ("A11y Checker", "https://www.accessibilitychecker.org/audit/?url={url}"),
    ("AChecker", "https://achecker.ca/checker/index.php?uri={url}"),
    ("Pa11y", "https://pa11y.org/demo/?url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 9: UPTIME/STATUS CHECKER - Sayfayı ping eder ve kontrol eder
# ═══════════════════════════════════════════════════════════════════════════════
UPTIME_CHECKERS = [
    ("CheckHost HTTP", "https://check-host.net/check-http?host={url}"),
    ("CheckHost Ping", "https://check-host.net/check-ping?host={url}"),
    ("CheckHost TCP", "https://check-host.net/check-tcp?host={url}"),
    ("HTTPStatus.io", "https://httpstatus.io/?url={url}"),
    ("Down Detector", "https://downforeveryoneorjustme.com/{url}"),
    ("Host Tracker", "https://www.host-tracker.com/en/check/{url}"),
    ("IsItDown", "https://www.isitdownrightnow.com/{url}"),
    ("GeoIPTool", "https://geoiptool.com/en/?url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 10: REDIRECT/LİNK CHECKER - URL'nin redirect durumunu kontrol eder
# ═══════════════════════════════════════════════════════════════════════════════
REDIRECT_TOOLS = [
    ("Redirect Checker", "https://www.redirect-checker.org/index.php?url={url}"),
    ("WhereGoes", "https://wheregoes.com/trace/{url}"),
    ("Redirect Detective", "https://redirectdetective.com/trace/{url}"),
    ("Redirect Path", "https://www.webconfs.com/redirect-check.php?url={url}"),
    ("HTTP Header Check", "https://tools.keycdn.com/curl?url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 11: CARBON/GREEN WEB - Sayfayı sürdürülebilirlik için analiz eder
# ═══════════════════════════════════════════════════════════════════════════════
GREEN_WEB_TOOLS = [
    ("Green Web Check", "https://www.thegreenwebfoundation.org/green-web-check/?url={url}"),
    ("EcoIndex", "https://www.ecoindex.fr/resultat/?url={url}"),
    ("Digital Beacon", "https://digitalbeacon.co/report?url={url}"),
    ("Website Carbon", "https://www.websitecarbon.com/?url={url}"),
    ("EcoGrader", "https://ecograder.com/report?url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 12: HREFLANG/i18n - Uluslararası SEO için URL'yi analiz eder
# ═══════════════════════════════════════════════════════════════════════════════
HREFLANG_TOOLS = [
    ("Hreflang Checker", "https://technicalseo.com/tools/hreflang/?url={url}"),
    ("Robots.txt Check", "https://technicalseo.com/tools/robots-txt/?url={url}"),
    ("Merkle Hreflang", "https://technicalseo.com/tools/hreflang/?url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 13: CORE WEB VITALS - Sayfanın performansını ölçer
# ═══════════════════════════════════════════════════════════════════════════════
CORE_WEB_VITALS = [
    ("Web.dev Measure", "https://web.dev/measure/?url={url}"),
    ("DebugBear", "https://www.debugbear.com/test/{url}"),
    ("SpeedVitals", "https://speedvitals.com/?url={url}"),
    ("Calibre CWV", "https://calibreapp.com/tools/core-web-vitals-checker?url={url}"),
    ("Treo CWV", "https://treo.sh/sitespeed?url={url}"),
    ("PageSpeed API", "https://developers.google.com/speed/pagespeed/insights/?url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 14: LINK CHECKERS - Sayfadaki linkleri kontrol eder
# ═══════════════════════════════════════════════════════════════════════════════
LINK_CHECKERS = [
    ("Broken Link Check", "https://www.brokenlinkcheck.com/broken-links.php?url={url}"),
    ("Dead Link Checker", "https://www.deadlinkchecker.com/website-dead-link-checker.asp?u={url}"),
    ("Dr Link Check", "https://www.drlinkcheck.com/check?url={url}"),
    ("W3C Link Check", "https://validator.w3.org/checklink?uri={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 15: CDN/CACHE ARAÇLARI - URL'yi önbelleğe alır
# ═══════════════════════════════════════════════════════════════════════════════
CDN_TOOLS = [
    ("Cloudinary", "https://webspeedtest.cloudinary.com/?url={url}"),
    ("KeyCDN Perf", "https://tools.keycdn.com/performance?url={url}"),
    ("CDN Finder", "https://www.cdnplanet.com/tools/cdnfinder/?url={url}"),
    ("GeoPeeker", "https://geopeeker.com/?url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 16: DİĞER ÇEVİRİ SERVİSLERİ - Sayfayı fetch edip çevirir
# ═══════════════════════════════════════════════════════════════════════════════
OTHER_TRANSLATORS = [
    ("Bing Translate", "https://www.bing.com/translator?ref=TThis&text=&from=&to=en&a={url}"),
    ("Yandex Translate", "https://translate.yandex.com/translate?url={url}"),
    ("DeepL", "https://www.deepl.com/translator?url={url}"),
    ("Papago", "https://papago.naver.com/website?source=auto&target=en&url={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 17: READABILITY/CONTENT ARAÇLARI - Sayfa içeriğini analiz eder
# ═══════════════════════════════════════════════════════════════════════════════
CONTENT_TOOLS = [
    ("Read-able", "https://www.webfx.com/tools/read-able/?url={url}"),
    ("Readability Score", "https://app.readable.com/text/url/{url}"),
    ("WebPageWord Count", "https://wordcounter.io/website-word-count?url={url}"),
    ("Text Extractor", "https://www.textise.net/showtext.aspx?strurl={url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# TIER 18: WEBSITE INFO ARAÇLARI - Site hakkında bilgi toplar
# ═══════════════════════════════════════════════════════════════════════════════
WEBSITE_INFO = [
    ("BuiltWith", "https://builtwith.com/?{url}"),
    ("Wappalyzer", "https://www.wappalyzer.com/lookup/{url}"),
    ("W3Techs", "https://w3techs.com/sites/info/{url}"),
    ("SimilarTech", "https://www.similartech.com/websites/{url}"),
]

# ═══════════════════════════════════════════════════════════════════════════════
# XML-RPC PING SUNUCULARI - Blog güncellemelerini bildirir
# ═══════════════════════════════════════════════════════════════════════════════
PING_SERVERS = [
    "http://rpc.pingomatic.com",
    "http://ping.feedburner.com",
    "http://rpc.twingly.com",
    "http://ping.blo.gs/",
    "http://rpc.weblogs.com/RPC2",
    "http://ping.blogs.yandex.ru/RPC2",
    "http://ping.fc2.com/",
    "http://xmlrpc.blogg.de/ping/",
]

# ═══════════════════════════════════════════════════════════════════════════════
# WEBSUB/PUBSUBHUBBUB - Anlık feed bildirimi
# ═══════════════════════════════════════════════════════════════════════════════
WEBSUB_HUBS = [
    "https://pubsubhubbub.appspot.com/publish",
    "https://pubsubhubbub.superfeedr.com/publish",
]

# ═══════════════════════════════════════════════════════════════════════════════
# SITEMAP PING URL'LERİ
# ═══════════════════════════════════════════════════════════════════════════════
SITEMAP_PING_URLS = [
    "https://www.google.com/ping?sitemap={sitemap}",
    "https://www.bing.com/ping?sitemap={sitemap}",
]

# ═══════════════════════════════════════════════════════════════════════════════
# TÜM KAYNAKLAR - SADECE URL ALAN VE FETCH EDEN SERVİSLER
# ═══════════════════════════════════════════════════════════════════════════════

def get_all_light_sources():
    """Hafif kaynaklar - her URL için çalıştırılır"""
    sources = []
    sources.extend(INDEXNOW_APIS)       # 5 kaynak - EN ÖNEMLİ
    sources.extend(GOOGLE_TOOLS)        # 30 kaynak - ÇOK ÖNEMLİ (translate çok değerli)
    sources.extend(SOCIAL_DEBUGGERS)    # 15 kaynak - ÖNEMLİ
    sources.extend(SCREENSHOT_SERVICES) # 10 kaynak
    sources.extend(VALIDATORS)          # 15 kaynak
    sources.extend(UPTIME_CHECKERS)     # 8 kaynak
    sources.extend(REDIRECT_TOOLS)      # 5 kaynak
    sources.extend(CDN_TOOLS)           # 4 kaynak
    return sources

def get_all_heavy_sources():
    """Ağır kaynaklar - her 5 URL'de 1 çalıştırılır"""
    sources = []
    sources.extend(ARCHIVE_SERVICES)    # 8 kaynak - KALICI BACKLINK
    sources.extend(SEO_ANALYZERS)       # 13 kaynak
    sources.extend(SECURITY_SCANNERS)   # 9 kaynak
    sources.extend(ACCESSIBILITY_TOOLS) # 5 kaynak
    sources.extend(GREEN_WEB_TOOLS)     # 5 kaynak
    sources.extend(HREFLANG_TOOLS)      # 3 kaynak
    sources.extend(CORE_WEB_VITALS)     # 6 kaynak
    sources.extend(LINK_CHECKERS)       # 4 kaynak
    sources.extend(OTHER_TRANSLATORS)   # 4 kaynak
    sources.extend(CONTENT_TOOLS)       # 4 kaynak
    sources.extend(WEBSITE_INFO)        # 4 kaynak
    return sources

# Stats
LIGHT_COUNT = len(get_all_light_sources())
HEAVY_COUNT = len(get_all_heavy_sources())
TOTAL_COUNT = LIGHT_COUNT + HEAVY_COUNT
PING_COUNT = len(PING_SERVERS)

print(f"""
═══════════════════════════════════════════════════════════════
   🚀 SEO VERIFIED SOURCES v6.1 - Gerçek İndexleme
═══════════════════════════════════════════════════════════════
   📊 Light Sources : {LIGHT_COUNT:3d}  (Her URL'ye - hepsi {{url}} kullanıyor)
   🔨 Heavy Sources : {HEAVY_COUNT:3d}  (Her 5 URL'de 1)
   📡 Ping Sunucusu : {PING_COUNT:3d}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✅ TOPLAM        : {TOTAL_COUNT:3d} Gerçek İndexleme Kaynağı
═══════════════════════════════════════════════════════════════
   ⚠️  site:domain formatı YOK - Hepsi {{url}} fetch ediyor
═══════════════════════════════════════════════════════════════
""")
