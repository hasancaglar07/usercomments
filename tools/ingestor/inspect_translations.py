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
    print(f"Content Length: {len(r['content_html'])}")
    has_pros = "Pros & Cons" in r['content_html'] or "Avantajlar ve Dezavantajlar" in r['content_html']
    has_summary = "Summary" in r['content_html'] or "Özet" in r['content_html']
    print(f"Contains 'Pros & Cons': {has_pros}")
    print(f"Contains 'Summary': {has_summary}")
    # print(r['content_html'][:500] + "...")
