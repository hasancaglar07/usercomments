import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
client = create_client(url, key)

# Check reviews and their translations
print("=== Bot-fetched reviews with translations ===")
test_urls = [
    "https://irecommend.ru/content/sushilnaya-mashina-maunfeld-kotoraya-na-poryadok-oblegchila-bytovuyu-rutinu-tak-zhe-chastich",
    "https://irecommend.ru/content/moi-pervyi-aerogril-neodnoznachnoe-mnenie",
]

for source_url in test_urls:
    resp = client.table('reviews').select('id, slug, status').eq('source_url', source_url).execute()
    if resp.data:
        r = resp.data[0]
        review_id = r['id']
        print(f"\n=== Review: {r['slug'][:40]} ===")
        print(f"ID: {review_id}")
        print(f"Status: {r['status']}")
        
        # Check translations
        trans = client.table('review_translations').select('lang, slug, title').eq('review_id', review_id).execute()
        print(f"Translations: {len(trans.data)}")
        for t in trans.data:
            print(f"  {t['lang']}: {t['slug'][:40] if t['slug'] else 'NO SLUG'}")
    else:
        print(f"NOT FOUND: {source_url[:50]}")
