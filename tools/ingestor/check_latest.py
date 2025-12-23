import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
client = create_client(url, key)

# Check by source_url
print("=== Searching for recently processed URLs ===")
test_urls = [
    "https://irecommend.ru/content/sushilnaya-mashina-maunfeld-kotoraya-na-poryadok-oblegchila-bytovuyu-rutinu-tak-zhe-chastich",
    "https://irecommend.ru/content/moi-pervyi-aerogril-neodnoznachnoe-mnenie",
    "https://irecommend.ru/content/polzuyus-pochti-god-vsem-dovolna-no-est-para-zamechanii",
]

for url in test_urls:
    resp = client.table('reviews').select('id, slug, photo_urls, created_at, status').eq('source_url', url).execute()
    if resp.data:
        r = resp.data[0]
        print(f"FOUND: {r['slug'][:50]} | Photos: {len(r['photo_urls'] or [])} | {r['status']}")
    else:
        print(f"NOT FOUND: {url[:60]}...")

# Also check source_map for processing status
print("\n=== Source Map Status ===")
resp2 = client.table('source_map').select('source_url, status, processed_at, content_hash').order('processed_at', desc=True).limit(10).execute()
for s in resp2.data:
    processed = s.get('processed_at', 'N/A')
    if processed:
        processed = processed[:16]
    print(f"{processed} | {s['status']:12} | {s['source_url'][:50]}...")
