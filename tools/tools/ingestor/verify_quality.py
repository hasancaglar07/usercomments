import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

res = supabase.table('review_translations').select('slug, content_html, lang').order('review_id', desc=True).limit(5).execute()
for r in res.data:
    print(f"\n--- Slug: {r['slug']} ({r['lang']}) ---")
    print(f"Content length: {len(r['content_html'])}")
    print(f"Sample: {r['content_html'][:500]}...")
