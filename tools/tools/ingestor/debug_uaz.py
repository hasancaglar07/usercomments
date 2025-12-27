import asyncio
import json
from ingestor.config import Config
from ingestor.db.supabase_client import SupabaseClient

async def check_status():
    config = Config.from_env()
    db = SupabaseClient(config.supabase_url, config.supabase_service_role_key, None)
    
    print("--- Searching for Product (UAZ) ---")
    products = db.select("products", "*", filters=[("ilike", "name", "%UAZ%")])
    for p in products:
        print(f"Product: ID={p['id']}")
        print(f"  > Name: {p['name']}")
        print(f"  > Slug: {p['slug']}")
    
    print("\n--- Searching for Reviews (UAZ) ---")
    reviews = db.select("reviews", "*", filters=[("ilike", "title", "%UAZ%")])
    if not reviews:
        # Try checking translations
        print("No English title match in reviews table, checking translations...")
        trans = db.select("review_translations", "*", filters=[("ilike", "title", "%UAZ%")])
        for t in trans:
            print(f"Translation Found: ReviewID={t['review_id']}, Title={t['title']}, Lang={t['lang']}")
            # Get parent review
            r = db.select("reviews", "*", filters=[("eq", "id", t['review_id'])])
            if r:
                print(f"  > Parent Review: ProductID={r[0]['product_id']}, Status={r[0].get('status')}")

    for r in reviews:
        print(f"Review: ID={r['id']}")
        print(f"  > Title: {r.get('title')}")
        print(f"  > Product ID: {r.get('product_id')}")
        print(f"  > Category ID: {r.get('category_id')}")

if __name__ == "__main__":
    asyncio.run(check_status())
