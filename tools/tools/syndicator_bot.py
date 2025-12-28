import os
import json
import requests
import argparse
import time
import sys
import xml.etree.ElementTree as ET
from datetime import datetime

# --- Configuration & Constants ---
HOST = "userreview.net"
SITEMAP_URL = f"https://{HOST}/sitemap.xml"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HISTORY_FILE = os.path.join(BASE_DIR, "syndicated_urls.json")

# LLM Configuration
# We will use the existing Groq/OpenAI setup or OpenRouter
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

# Platform Credentials (from Environment)
MEDIUM_TOKEN = os.getenv("MEDIUM_INTEGRATION_TOKEN", "")
MEDIUM_USER_ID = os.getenv("MEDIUM_USER_ID", "")

# --- Helper Functions ---

def log(message):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def extract_best_image(url):
    """
    Sayfadan en iyi görseli çeker. 
    Özellikle 'img-029.png' gibi varsayılan placeholder görselleri atlar.
    """
    try:
        import requests
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
        r = requests.get(url, headers=headers, timeout=15)
        
        if r.status_code != 200:
            return None
        
        import re
        
        # 1. og:image (property="og:image" content="...")
        matches = re.findall(r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', r.text, re.IGNORECASE)
        
        # 2. og:image (content="..." property="og:image") - Sıra farklı olabilir
        matches += re.findall(r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']og:image["\']', r.text, re.IGNORECASE)
        
        # 3. twitter:image
        matches += re.findall(r'<meta\s+(?:property|name)=["\']twitter:image["\']\s+content=["\']([^"\']+)["\']', r.text, re.IGNORECASE)
        
        # Filtreleme: Varsayılan (placeholder) görselleri atla
        for img_url in matches:
            if "img-029.png" not in img_url and "default" not in img_url.lower():
                # Bazen URL relative olabilir ama Next.js genelde absolute basar.
                if img_url.startswith("http"):
                    return img_url
        
        return None
        
    except Exception as e:
        log(f"Image extraction error: {e}")
        return None

def load_history():
    if not os.path.exists(HISTORY_FILE):
        return {}
    try:
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        log(f"Error loading history: {e}")
        return {}

def save_history(history):
    try:
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        log(f"Error saving history: {e}")

def fetch_sitemap_urls_recursive(sitemap_url, depth=0):
    if depth > 2: return set()
    
    urls = set()
    try:
        headers = {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(sitemap_url, headers=headers, timeout=45)
        
        if response.status_code != 200:
            return urls
            
        root = ET.fromstring(response.content)
        
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
            for sitemap in children:
                loc = sitemap.find(tag_loc, ns)
                if loc is not None and loc.text:
                    urls.update(fetch_sitemap_urls_recursive(loc.text, depth+1))

        elif root.tag.endswith('urlset'):
            children = root.findall(tag_url, ns)
            for url in children:
                loc = url.find(tag_loc, ns)
                if loc is None: loc = url.find('loc')
                if loc is not None and loc.text:
                    urls.add(loc.text)
                    
    except Exception as e:
        log(f"Sitemap error ({sitemap_url}): {e}")
        
    return urls

SITEMAP_CACHE_FILE = os.path.join(BASE_DIR, "sitemap_cache.json")

def fetch_all_urls(refresh=False):
    # 1. Try Cache
    if not refresh and os.path.exists(SITEMAP_CACHE_FILE):
        try:
            with open(SITEMAP_CACHE_FILE, 'r') as f:
                urls = set(json.load(f))
            log(f"Loaded {len(urls)} URLs from cache.")
            return urls
        except:
            pass

    log("Fetching sitemap (this may take a while)...")
    urls = fetch_sitemap_urls_recursive(SITEMAP_URL)
    
    # Fallback if empty
    if not urls:
        fallback_sitemaps = [
            f"https://{HOST}/sitemap-tr.xml",
            f"https://{HOST}/sitemap-en.xml",
            f"https://{HOST}/sitemap-de.xml",
            f"https://{HOST}/sitemap-es.xml",
            f"https://{HOST}/sitemap-ar.xml"
        ]
        for fb in fallback_sitemaps:
            urls.update(fetch_sitemap_urls_recursive(fb))
    
    # Save to Cache
    if urls:
        try:
            with open(SITEMAP_CACHE_FILE, 'w') as f:
                json.dump(list(urls), f)
            log(f"Cached {len(urls)} URLs to {SITEMAP_CACHE_FILE}")
        except Exception as e:
            log(f"Cache save failed: {e}")
            
    return urls

# --- LLM Content Generation (Groq) ---

def generate_social_content(url, original_content_summary=""):
    """
    Generates a social media post/blog post from a URL using Groq LLM.
    Returns a dict: {'title': str, 'body': str, 'tags': list}
    """
    log(f"İçerik oluşturuluyor (Groq): {url}")
    
    # Try to get Groq Key from Env or argument
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    if not GROQ_API_KEY:
        # Fallback to hardcoded or other env var if known, else fail gracefully
        log("HATA: GROQ_API_KEY bulunamadı! run_syndicator.bat dosyasını kontrol et.")
        return None

    # Prepare Prompt
    prompt = f"""
    You are a professional social media manager.
    Target URL: {url}
    
    Task: Write a high-quality, engaging blog post summary (300 words).
    
    CRITICAL OUTPUT RULES:
    1. **Language Matching**: Check the URL structure. 
       - If URL contains `/tr/`, write the ENTIRE post (Title + Body) in **TURKISH**.
       - If URL contains `/en/`, write in **ENGLISH**.
       - If URL contains `/de/`, write in **GERMAN**.
       - If URL contains `/es/`, write in **SPANISH**.
       - If URL contains `/ar/`, write in **ARABIC**.
       
    2. **Title**: Catchy and click-worthy, in the target language. No markdown.
    3. **Content**: Engaging intro + Pros/Cons summary.
    4. **Call to Action**: Must link back to `{url}` explicitly at the end.
    5. **Format**: JSON {{ "title": "...", "body": "HTML string", "tags": [...] }}
    6. **HTML**: Use <h3> for headers, <ul>/<li> for lists.
    """

    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        
        # Use Env Model or Default
        model = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")
        
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that outputs JSON."
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model=model,
            temperature=0.7,
            response_format={"type": "json_object"},
        )

        content = chat_completion.choices[0].message.content
        return json.loads(content)

    except ImportError:
        log("X 'groq' kütüphanesi eksik. Lütfen 'pip install groq' yapın.")
        return None
    except Exception as e:
        log(f"Groq API Hatası: {e}")
        return None

# --- Platform Providers ---

class MediumProvider:
    def __init__(self, token, user_id=None):
        self.token = token
        self.user_id = user_id
        self.base_url = "https://api.medium.com/v1"
        
    def get_user_id(self):
        if self.user_id: 
            return self.user_id
        
        headers = {"Authorization": f"Bearer {self.token}"}
        resp = requests.get(f"{self.base_url}/me", headers=headers)
        if resp.status_code == 200:
            self.user_id = resp.json()['data']['id']
            return self.user_id
        else:
            log(f"Medium Auth Error: {resp.text}")
            return None
            
    def post(self, title, body, tags, canonical_url):
        uid = self.get_user_id()
        if not uid: return False
        
        url = f"{self.base_url}/users/{uid}/posts"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Add canonical link to body if not present
        body += f'\n\n<p>Original Article: <a href="{canonical_url}">{title}</a></p>'
        
        payload = {
            "title": title,
            "contentFormat": "html",
            "content": body,
            "canonicalUrl": canonical_url,
            "tags": tags[:5], # Max 5 tags
            "publishStatus": "public" 
        }
        
        resp = requests.post(url, headers=headers, json=payload)
        if resp.status_code in [200, 201]:
            log(f"✓ Posted to Medium: {resp.json()['data']['url']}")
            return True
        else:
            log(f"X Medium Post Error: {resp.text}")
            return False

class TumblrProvider:
    def __init__(self, consumer_key, consumer_secret, oauth_token, oauth_secret, blog_name):
        self.consumer_key = consumer_key
        self.consumer_secret = consumer_secret
        self.oauth_token = oauth_token
        self.oauth_secret = oauth_secret
        self.blog_name = blog_name
        
    def post(self, title, body, tags, canonical_url):
        # Requires 'requests_oauthlib' to be installed
        try:
            from requests_oauthlib import OAuth1Session
            url = f"https://api.tumblr.com/v2/blog/{self.blog_name}/post"
            
            tumblr = OAuth1Session(
                self.consumer_key, 
                client_secret=self.consumer_secret,
                resource_owner_key=self.oauth_token,
                resource_owner_secret=self.oauth_secret
            )
            
            # Tumblr body allows HTML
            data = {
                "type": "text",
                "title": title,
                "body": f"{body}\n<p>Source_ <a href='{canonical_url}'>{title}</a></p>",
                "tags": ",".join(tags),
                "state": "published"
            }
            
            resp = tumblr.post(url, data=data)
            
            if resp.status_code in [200, 201]:
                log(f"✓ Posted to Tumblr")
                return True
            else:
                log(f"X Tumblr Post Error: {resp.text}")
                return False
                
        except ImportError:
            log("X 'requests_oauthlib' module missing. Install it to use Tumblr.")
            return False
        except Exception as e:
            log(f"Tumblr Exception: {e}")
            return False

class PlurkProvider:
    def __init__(self, key, secret, token, token_secret):
        from requests_oauthlib import OAuth1
        self.auth = OAuth1(key, secret, token, token_secret)
        self.endpoint = "https://www.plurk.com/APP/Timeline/plurkAdd"
        
    def post(self, title, body, tags, canonical_url):
        try:
            import requests
            # Plurk limit is ~360 chars.
            # We will send Title + Link + Tags
            
            # Simple Text
            content = f"{title}\n{canonical_url}\n"
            content += " ".join([f"#{t}" for t in tags[:3]])
            
            payload = {
                'content': content,
                'qualifier': 'shares',
                'lang': 'en' # Default EN, but Plurk detects mostly
            }
            
            r = requests.post(self.endpoint, auth=self.auth, data=payload, timeout=30)
            
            if r.status_code == 200:
                 res = r.json()
                 log(f"✓ Posted to Plurk: https://www.plurk.com/p/{base36(res.get('plurk_id'))} (ID: {res.get('plurk_id')})")
                 return True
            else:
                 log(f"Plurk Error: {r.text}")
                 return False
        except Exception as e:
            log(f"Plurk Exception: {e}")
            return False

class PinterestProvider:
    def __init__(self, access_token):
        self.access_token = access_token
        self.api_url = "https://api.pinterest.com/v5"
        self.headers = {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}
        # Auto-detect or create board
        self.board_id = self._get_or_create_board("UserReview Best Products")

    def _get_or_create_board(self, name):
        try:
            import requests
            # List first
            r = requests.get(f"{self.api_url}/boards", headers=self.headers)
            if r.status_code == 200:
                for b in r.json().get('items', []):
                    if b['name'].lower() == name.lower():
                        return b['id']
            # Create if not found
            r = requests.post(f"{self.api_url}/boards", json={"name": name, "privacy": "PUBLIC"}, headers=self.headers)
            if r.status_code == 201:
                log(f"IyI Created Pinterest Board: {name}")
                return r.json()['id']
        except Exception as e:
            log(f"Pinterest Board Error: {e}")
        return None

    def post(self, title, body, tags, canonical_url):
        if not self.board_id:
            log("Pinterest Error: No Board ID found or created.")
            return False
            
        img_url = extract_best_image(canonical_url)
        if not img_url:
            log("Pinterest Skip: No Image found (or only default image found).")
            return False
            
        try:
            import requests
            payload = {
                "board_id": self.board_id,
                "title": title[:100],
                "description": f"{body[:400]}... #review {' '.join(['#'+t for t in tags[:3]])}",
                "link": canonical_url,
                "media_source": {
                    "source_type": "image_url",
                    "url": img_url
                }
            }
            
            r = requests.post(f"{self.api_url}/pins", json=payload, headers=self.headers)
            if r.status_code == 201:
                log(f"✓ Posted to Pinterest (Board: {self.board_id})")
                return True
            else:
                log(f"Pinterest Error: {r.text}")
                return False
        except Exception as e:
            log(f"Pinterest Exception: {e}")
            return False

class RaindropProvider:
    def __init__(self, token):
        self.token = token
        self.endpoint = "https://api.raindrop.io/rest/v1/raindrop"
        
    def post(self, title, body, tags, canonical_url):
        try:
            import requests
            headers = {"Authorization": f"Bearer {self.token}"}
            payload = {
                "link": canonical_url,
                "title": title,
                "excerpt": body[:250],
                "tags": tags[:5],
                "pleaseParse": {} 
            }
            
            r = requests.post(self.endpoint, json=payload, headers=headers, timeout=30)
            
            if r.status_code == 200:
                res = r.json()
                if res.get('result'):
                    log(f"✓ Posted to Raindrop.io (ID: {res.get('item', {}).get('_id')})")
                    return True
                else:
                    log(f"Raindrop Error: {res.get('errorMessage')}")
                    return False
            else:
                log(f"Raindrop HTTP Error: {r.status_code} - {r.text}")
                return False
        except Exception as e:
            log(f"Raindrop Exception: {e}")
            return False

def base36(n):
    # Quick helper for Plurk Link
    if not n: return ""
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    r = ""
    while n > 0:
        n, m = divmod(n, 36)
        r = chars[m] + r
    return r

class InstapaperProvider:
    def __init__(self, username, password):
        self.username = username
        self.password = password
        
    def post(self, title, body, tags, canonical_url):
        try:
            import requests
            # Instapaper Simple API
            url = "https://www.instapaper.com/api/add"
            data = {
                'username': self.username,
                'password': self.password,
                'url': canonical_url,
                'title': title,
                'selection': body[:300] # Brief summary
            }
            
            # Use POST for security
            r = requests.post(url, data=data, timeout=30)
            
            if r.status_code == 201:
                log(f"✓ Posted to Instapaper")
                return True
            elif r.status_code == 403:
                log("Instapaper Error: Invalid credentials")
                return False
            else:
                log(f"Instapaper Error: {r.status_code} - {r.text}")
                return False
        except Exception as e:
            log(f"Instapaper Exception: {e}")
            return False

class IFTTTProvider:
    def __init__(self, key, event_name):
        self.key = key
        self.event_name = event_name
        self.endpoint = f"https://maker.ifttt.com/trigger/{self.event_name}/with/key/{self.key}"

    def post(self, title, body, tags, canonical_url):
        try:
            import requests
            
            # Extract Image URL for Pinterest
            image_url = extract_best_image(canonical_url)
            
            # IFTTT Webhook accepts 3 values. We are repurposing them for maximum compatibility:
            # value1: Title + Tags (Rich Text)
            # value2: Canonical URL (Link)
            # value3: Image URL (For Pinterest/Instagram) OR Summary if no image found.
            
            # Combine Title and Tags for Value1 to save space
            combined_text = f"{title}"
            
            # Prepare Value3: Image URL is priority for Pinterest
            val3 = image_url
            if not val3:
                # Fallback to summary if no image found
                 val3 = f"{body[:300]}... #{' #'.join(tags[:3])}"

            payload = {
                "value1": combined_text,
                "value2": canonical_url,
                "value3": val3
            }
            
            r = requests.post(self.endpoint, json=payload, timeout=30)
            
            if r.status_code == 200:
                log(f"✓ Triggered IFTTT Event: {self.event_name}")
                if image_url:
                     log(f"  ↳ Included Image: {image_url}")
                return True
            else:
                log(f"IFTTT Error: {r.text}")
                return False
                
        except Exception as e:
            log(f"IFTTT Exception: {e}")
            return False

class TelegramProvider:
    def __init__(self, token, chat_id):
        self.token = token
        self.chat_id = chat_id
        
    def post(self, title, body, tags, canonical_url):
        try:
            import requests
            import re
            
            # Clean HTML for Telegram (Only supports <b>, <i>, <a>, <code>, <pre>)
            # Remove header tags, keep text
            clean_body = re.sub(r'<h[1-6]>', '<b>', body)
            clean_body = re.sub(r'</h[1-6]>', '</b>\n', clean_body)
            clean_body = re.sub(r'<li>', '• ', clean_body)
            clean_body = re.sub(r'</li>', '\n', clean_body)
            clean_body = re.sub(r'<br\s*/?>', '\n', clean_body)
            
            # Remove other unsupported tags but keep content
            clean_body = re.sub(r'<[^>]+>', '', clean_body) # Too aggressive? 
            # Better: Strip all tags except b, i, a. 
            # Or simpler: Just send Title + Link + Tags
            
            # Simple & Safe Telegram Message
            msg = f"<b>{title}</b>\n\n{clean_body[:500]}...\n\n🔗 <a href='{canonical_url}'>Full Review</a>"
            
            url = f"https://api.telegram.org/bot{self.token}/sendMessage"
            data = {
                "chat_id": self.chat_id,
                "text": msg,
                "parse_mode": "HTML",
                "disable_web_page_preview": False
            }
            
            r = requests.post(url, data=data, timeout=30)
            if r.status_code == 200:
                log(f"✓ Posted to Telegram: {self.chat_id}")
                return True
            else:
                log(f"Telegram Error: {r.text}")
                return False
        except Exception as e:
            log(f"Telegram Exception: {e}")
            return False

class MastodonProvider:
    def __init__(self, instance_url, access_token):
        self.instance_url = instance_url.rstrip('/')
        self.access_token = access_token
        
    def post(self, title, body, tags, canonical_url):
        try:
            import requests
            # Remove HTML from body for Mastodon (Text only + Link)
            clean_body = body.replace('<h3>', '').replace('</h3>', '\n').replace('<ul>', '').replace('</ul>', '').replace('<li>', '• ').replace('</li>', '\n')
            
            # Limit length (500 chars usually)
            status_text = f"{title}\n\n{clean_body[:300]}...\n\n🔗 {canonical_url}\n\n"
            status_text += " ".join([f"#{t}" for t in tags[:3]])
            
            headers = {'Authorization': f'Bearer {self.access_token}'}
            data = {'status': status_text}
            
            r = requests.post(f"{self.instance_url}/api/v1/statuses", headers=headers, data=data, timeout=30)
            
            if r.status_code == 200:
                log(f"✓ Posted to Mastodon: {r.json().get('url')}")
                return True
            else:
                log(f"Mastodon Error: {r.text}")
                return False
        except Exception as e:
            log(f"Mastodon Exception: {e}")
            return False

class DreamwidthProvider:
    def __init__(self, username, password):
        self.username = username
        self.password = password
        self.endpoint = "https://www.dreamwidth.org/interface/xmlrpc"
        
    def post(self, title, body, tags, canonical_url):
         # Same logic as LiveJournal
        try:
            import xmlrpc.client
            import datetime
            server = xmlrpc.client.ServerProxy(self.endpoint)
            now = datetime.datetime.now()
            content = f"{body}<br/><br/>Original Source: <a href='{canonical_url}'>{title}</a>"
            
            payload = {
                'username': self.username,
                'password': self.password,
                'ver': 1,
                'event': content,
                'subject': title,
                'lineendings': 'pc',
                'year': now.year, 'mon': now.month, 'day': now.day,
                'hour': now.hour, 'min': now.minute,
                'props': {'taglist': ", ".join(tags[:5])}
            }
            res = server.LJ.XMLRPC.postevent(payload)
            if 'url' in res:
                 log(f"✓ Posted to Dreamwidth: {res['url']}")
                 return True
            return False
            
        except Exception as e:
            log(f"Dreamwidth Error: {e}")
            return False

class LiveJournalProvider:
    def __init__(self, username, password):
        self.username = username
        self.password = password
        self.endpoint = "https://www.livejournal.com/interface/xmlrpc"
        
    def post(self, title, body, tags, canonical_url):
        try:
            import xmlrpc.client
            import datetime
            
            server = xmlrpc.client.ServerProxy(self.endpoint)
            
            now = datetime.datetime.now()
            
            content = f"{body}<br/><br/>Original Source: <a href='{canonical_url}'>{title}</a>"
            
            # LiveJournal XML-RPC structure
            payload = {
                'username': self.username,
                'password': self.password,
                'ver': 1,
                'event': content,
                'subject': title,
                'lineendings': 'pc',
                'year': now.year,
                'mon': now.month,
                'day': now.day,
                'hour': now.hour,
                'min': now.minute,
                'props': {
                    'taglist': ", ".join(tags[:5]) # LJ limits tags sometimes
                }
            }
            
            res = server.LJ.XMLRPC.postevent(payload)
            
            if 'url' in res:
                 log(f"✓ Posted to LiveJournal: {res['url']}")
                 return True
            else:
                 log(f"LiveJournal Response Error: {res}")
                 return False

        except Exception as e:
            log(f"LiveJournal Error: {e}")
            return False

class WordPressProvider:
    def __init__(self, url, username, password):
        self.url = url
        self.username = username
        self.password = password
        
    def post(self, title, body, tags, canonical_url):
        try:
            from wordpress_xmlrpc import Client, WordPressPost
            from wordpress_xmlrpc.methods.posts import NewPost
            
            client = Client(self.url, self.username, self.password)
            post = WordPressPost()
            post.title = title
            post.content = f"{body}<br/><br/>Original Source: <a href='{canonical_url}'>{title}</a>"
            post.terms_names = {'post_tag': tags, 'category': ['Reviews']}
            post.post_status = 'publish'
            
            post_id = client.call(NewPost(post))
            
            log(f"✓ Posted to WordPress: ID {post_id}")
            return True
            
        except ImportError:
             log("X 'python-wordpress-xmlrpc' missing. Pip install it.")
             return False
        except Exception as e:
            log(f"WordPress Error: {e}")
            return False

class BloggerProvider:
    def __init__(self, key_file, blog_id):
        self.key_file = key_file
        self.blog_id = blog_id
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.token_file = os.path.join(self.base_dir, 'blogger_token.json')
        
    def post(self, title, body, tags, canonical_url):
        try:
            from google.oauth2 import service_account
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
            
            creds = None
            
            # 1. Try User Token (OAuth) - Preferred for Personal Blogs
            if os.path.exists(self.token_file):
                try:
                    creds = Credentials.from_authorized_user_file(self.token_file, ['https://www.googleapis.com/auth/blogger'])
                    log("✓ Using User OAuth Token")
                except Exception as e:
                    log(f"Token file invalid: {e}")

            # 2. Try Service Account (Fallback)
            if not creds and self.key_file and os.path.exists(self.key_file):
                 creds = service_account.Credentials.from_service_account_file(
                    self.key_file, scopes=['https://www.googleapis.com/auth/blogger'])
                 log("✓ Using Service Account Key")
            
            if not creds:
                log("X Authentication failed: No token or key file found. Run 'run_blogger_auth.bat'.")
                return False

            service = build('blogger', 'v3', credentials=creds)
            
            content = f"{body}<br/><br/>Original Source: <a href='{canonical_url}'>{title}</a>"
            
            body_json = {
                "kind": "blogger#post",
                "blog": {"id": self.blog_id},
                "title": title,
                "content": content,
                "labels": tags
            }
            
            try:
                posts = service.posts()
                result = posts.insert(blogId=self.blog_id, body=body_json).execute()
                log(f"✓ Posted to Blogger: {result.get('url')}")
                return True
            except Exception as api_err:
                 log(f"Blogger API Error: {api_err}")
                 if "403" in str(api_err):
                     log("(!) Permission Denied. Please run 'run_blogger_auth.bat' to authorize correctly.")
        except Exception as e:
            log(f"Blogger General Exception: {e}")
            return False

# --- Main Execution ---

def main():
    parser = argparse.ArgumentParser(description="UserReview Syndicator Bot (SEO Pro Edition)")
    parser.add_argument("--limit", type=int, default=999999, help="Total posts limit (practically infinite)")
    parser.add_argument("--refresh", action="store_true", help="Force refresh sitemap cache")
    args = parser.parse_args()

    # --- 1. Load History ---
    global history
    history = load_history()
    log(f"Loaded history: {len(history)} items processed.")

    # --- 2. Initialize Providers ---
    providers = []
    
    # IFTTT (The Core)
    # IFTTT (The Core)
    if_key = os.getenv('IFTTT_WEBHOOK_KEY')
    if_event = os.getenv('IFTTT_EVENT_NAME')
    
    if if_key and if_event:
        providers.append(IFTTTProvider(if_key, if_event))
        log("✅ IFTTT Provider ACTIVE")
    
    # Tumblr
    if 'TUMBLR_CONSUMER_KEY' in os.environ:
       try:
           providers.append(TumblrProvider(
               os.environ['TUMBLR_CONSUMER_KEY'], os.environ['TUMBLR_CONSUMER_SECRET'],
               os.environ['TUMBLR_OAUTH_TOKEN'], os.environ['TUMBLR_OAUTH_SECRET']
           ))
           log("✅ Tumblr Provider ACTIVE")
       except: pass

    # Blogger
    token_file = 'blogger_token.json' 
    client_secrets = 'client_secrets.json' 
    if os.path.exists(token_file) and os.path.exists(client_secrets):
        try:
             blog_id = os.environ.get('BLOGGER_BLOG_ID', '2378878950669279769')
             # Note: BloggerProvider signature might vary, checking previous usage: (key_file, blog_id) or (client_secrets, blog_id, token_file...?)
             # Based on previous robust code: BloggerProvider(key_file, blog_id) usually expects service account or Oauth. 
             # Let's align with the file's BloggerProvider: __init__(self, key_file, blog_id, token_file=None, client_secrets_file=None)
             # If key_file is None, it uses OAuth flow with token_file and client_secrets_file.
             providers.append(BloggerProvider(None, blog_id, token_file, client_secrets))
             log("✅ Blogger Provider ACTIVE")
        except Exception as e:
            log(f"⚠️ Blogger Error: {e}")

    # WordPress
    if 'WORDPRESS_URL' in os.environ:
        providers.append(WordPressProvider(
            os.environ['WORDPRESS_URL'], os.environ['WORDPRESS_USER'], os.environ['WORDPRESS_PASSWORD']
        ))
        log("✅ WordPress Provider ACTIVE")

    # LiveJournal / Dreamwidth
    if 'LIVEJOURNAL_USER' in os.environ:
        providers.append(LiveJournalProvider(
            os.environ['LIVEJOURNAL_USER'], os.environ['LIVEJOURNAL_PASSWORD']
        ))
        log("✅ LiveJournal Provider ACTIVE")
    
    if 'DREAMWIDTH_USER' in os.environ:
        providers.append(DreamwidthProvider(
            os.environ['DREAMWIDTH_USER'], os.environ['DREAMWIDTH_PASSWORD']
        ))
        log("✅ Dreamwidth Provider ACTIVE")

    # Mastodon
    if 'MASTODON_ACCESS_TOKEN' in os.environ:
         providers.append(MastodonProvider(
             os.environ.get('MASTODON_INSTANCE', 'https://mastodon.social'),
             os.environ['MASTODON_ACCESS_TOKEN']
         ))
         log("✅ Mastodon Provider ACTIVE")
         
    # Telegram
    if 'TELEGRAM_BOT_TOKEN' in os.environ:
        providers.append(TelegramProvider(
            os.environ['TELEGRAM_BOT_TOKEN'], os.environ['TELEGRAM_CHAT_ID']
        ))
        log("✅ Telegram Provider ACTIVE")
        
    # Instapaper
    if 'INSTAPAPER_USER' in os.environ:
        providers.append(InstapaperProvider(
            os.environ['INSTAPAPER_USER'], os.environ['INSTAPAPER_PASSWORD']
        ))
        log("✅ Instapaper Provider ACTIVE")

    # Plurk
    if 'PLURK_CONSUMER_KEY' in os.environ:
        providers.append(PlurkProvider(
            os.environ['PLURK_CONSUMER_KEY'], os.environ['PLURK_CONSUMER_SECRET'],
            os.environ['PLURK_ACCESS_TOKEN'], os.environ['PLURK_ACCESS_SECRET']
        ))
        log("✅ Plurk Provider ACTIVE")
        
    # Raindrop
    if 'RAINDROP_ACCESS_TOKEN' in os.environ:
        providers.append(RaindropProvider(os.environ['RAINDROP_ACCESS_TOKEN']))
        log("✅ Raindrop Provider ACTIVE")



    if not providers:
        log("❌ No providers configured! Check environment variables.")
        return

    log("🚀 Syndicator Bot Started (SEO Strategy: 70% New / 30% Old, 15-45m Delay)")

    while True: # INFINITE LOOP
        try:
            # --- 3. Fetch & Filter URLs ---
            all_urls = fetch_all_urls(refresh=args.refresh)
            
            # STRICT FILTER: Only /en/ URLs
            en_urls = [u for u in all_urls if "/en/" in u]
            log(f"Total English URLs found: {len(en_urls)}")

            # Identify candidates (not in history)
            candidates = [u for u in en_urls if u not in history]
            
            if not candidates:
                log("😴 No new candidates found. Sleeping 1 hour before re-checking sitemap...")
                time.sleep(3600)
                args.refresh = True # Force refresh next time
                continue

            # --- 4. Smart Selection Strategy (70% New / 30% Old) ---
            import random
            
            target_url = None
            
            if len(candidates) > 10:
                split_index = int(len(candidates) * 0.8) # Last 20% is "New"
                new_pool = candidates[split_index:]
                old_pool = candidates[:split_index]
                
                roll = random.random()
                if roll < 0.70 and new_pool: # 70% chance for NEW
                    target_url = random.choice(new_pool)
                    log(f"🎯 Strategy: FRESH CONTENT selected ({len(new_pool)} candidates)")
                elif old_pool: # 30% chance for OLD
                    target_url = random.choice(old_pool)
                    log(f"🏺 Strategy: ARCHIVE REVIVAL selected ({len(old_pool)} candidates)")
                else:
                    target_url = random.choice(candidates)
            else:
                target_url = random.choice(candidates)

            log(f"Processing: {target_url}")

            # --- 5. Generate Content ---
            content = generate_social_content(target_url)
            
            if content:
                success_count = 0
                for provider in providers:
                    if provider.post(content['title'], content['body'], content['tags'], target_url):
                        success_count += 1
                
                if success_count > 0:
                    history[target_url] = datetime.now().isoformat()
                    save_history(history)
                    log(f"✅ Successfully syndicated to {success_count} platforms.")
                    
                    # --- 6. Human-Like Delay (15m - 45m) ---
                    delay = random.randint(900, 2700) 
                    # Calculate next time safely
                    import datetime as dt_module
                    next_time = dt_module.datetime.now() + dt_module.timedelta(seconds=delay)
                    log(f"⏳ Human Delay: Sleeping for {delay // 60} minutes... (Next post around {next_time.strftime('%H:%M')})")
                    time.sleep(delay)
                else:
                    log("❌ Failed to syndicate to any provider. Sleeping 5 mins retry.")
                    time.sleep(300)
            else:
                log("⚠️ Content generation failed. Skipping.")
                time.sleep(60)

        except Exception as e:
            log(f"🔥 CRITICAL LOOP ERROR: {e}")
            time.sleep(600)

if __name__ == "__main__":
    main()
