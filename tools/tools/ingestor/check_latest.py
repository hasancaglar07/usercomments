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
    "https://irecommend.ru/content/turtsiya-v-dekabre-2025-rixos-downtown-po-smeshnoi-tsene",
    "https://irecommend.ru/content/chainik-redmond-rk-m1721-kachestvennyi-chainik-dlya-doma",
    "https://irecommend.ru/content/Chainik-za-kopeiki-elektricheskii-chainik-Home-Club",
]

for url in test_urls:
    resp = client.table('reviews').select('id, slug, photo_urls, created_at, status, pros, cons').eq('source_url', url).execute()
    if resp.data:
        r = resp.data[0]
        print(f"FOUND: {r['slug'][:40]} | Photos: {len(r['photo_urls'] or [])} | {r['status']}")
        print(f"  Pros: {r['pros']}")
        print(f"  Cons: {r['cons']}")
    else:
        print(f"NOT FOUND: {url[:60]}...")

# Also check source_map for processing status
print("\n=== Source Map Status ===")
resp2 = client.table('source_map').select('source_url, status, last_seen_at').order('last_seen_at', desc=True).limit(10).execute()
for s in resp2.data:
    processed = s.get('last_seen_at', 'N/A')
    if processed:
        processed = processed[:16]
    print(f"{processed} | {s['status']:12} | {s['source_url'][:50]}...")
