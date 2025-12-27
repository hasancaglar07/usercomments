import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
client = create_client(url, key)

# Check reviews with source_url to see their source URLs
print("=== Recent Reviews ===")
resp = client.table('reviews').select('id, slug, source_url, photo_urls, photo_count').order('created_at', desc=True).limit(10).execute()
for r in resp.data:
    print(f"ID: {r['id'][:8]}... | Slug: {r['slug'][:40]:40} | Photos: {len(r['photo_urls'] or [])} | Source: {r['source_url']}")
