import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
client = create_client(url, key)

# Check photo URLs for recently processed content
print("=== Checking actual photo URLs ===")
test_urls = [
    "https://irecommend.ru/content/sushilnaya-mashina-maunfeld-kotoraya-na-poryadok-oblegchila-bytovuyu-rutinu-tak-zhe-chastich",
    "https://irecommend.ru/content/moi-pervyi-aerogril-neodnoznachnoe-mnenie",
]

for url in test_urls:
    resp = client.table('reviews').select('id, slug, photo_urls').eq('source_url', url).execute()
    if resp.data:
        r = resp.data[0]
        print(f"\n=== {r['slug'][:50]} ===")
        print(f"Review ID: {r['id']}")
        print(f"Photo count: {len(r['photo_urls'] or [])}")
        if r['photo_urls']:
            print("Sample URLs:")
            for i, photo_url in enumerate(r['photo_urls'][:3]):
                print(f"  {i+1}. {photo_url}")
        else:
            print("NO PHOTO URLS!")
