import asyncio
from ingestor.config import Config
from ingestor.db.supabase_client import SupabaseClient

async def check_status():
    config = Config.from_env()
    db = SupabaseClient(config.supabase_url, config.supabase_service_role_key, None)
    
    print("--- Searching for Review (Fiat) ---")
    reviews = db.select("reviews", "*", filters=[("ilike", "title", "%Fiat%")])
    
    # Also check translations
    trans = db.select("review_translations", "*", filters=[("ilike", "title", "%Fiat%")])
    
    all_review_ids = set([r['id'] for r in reviews] + [t['review_id'] for t in trans])
    
    for rid in all_review_ids:
        r = db.select("reviews", "*", filters=[("eq", "id", rid)])
        if r:
            rev = r[0]
            print(f"Review ID: {rev['id']}")
            print(f"  > Original Title: {rev.get('title')}")
            print(f"  > Product ID: {rev.get('product_id')}")
            print(f"  > Source URL: {rev.get('source_url')}")
            
            # Check Linked Product
            if rev.get('product_id'):
                p = db.select("products", "*", filters=[("eq", "id", rev['product_id'])])
                if p:
                    print(f"  > LINKED PRODUCT: {p[0]['name']} (Slug: {p[0]['slug']})")
                else:
                    print("  > Link Product NOT FOUND")

if __name__ == "__main__":
    asyncio.run(check_status())
