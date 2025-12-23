import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
client = create_client(url, key)

# Check reviews table for photo_urls
print("=== Reviews with photo_urls ===")
resp = client.table('reviews').select('id, slug, photo_urls').eq('status', 'published').limit(5).execute()
for r in resp.data:
    print(f"ID: {r['id']}")
    print(f"  Slug: {r['slug']}")
    print(f"  Photos: {r['photo_urls']}")
    print()

# Check products table for images
print("\n=== Products with images ===")
resp2 = client.table('products').select('id, name, image_url').limit(5).execute()
for p in resp2.data:
    print(f"ID: {p['id']}, Name: {p.get('name')}, Image: {p.get('image_url')}")
