import asyncio
import json
from ingestor.config import Config
from ingestor.db.supabase_client import SupabaseClient

async def check_status():
    config = Config.from_env()
    db = SupabaseClient(config.supabase_url, config.supabase_service_role_key, None)
    
    print("--- Searching for Product ---")
    # Search product by partial name
    products = db.select("products", "*", filters=[("ilike", "name", "%Aceline%")])
    if not products:
        print("Product NOT found in DB!")
    else:
        for p in products:
            print(f"Product Found: ID={p['id']}, Name={p['name']}, Slug={p['slug']}")
            
            # Check product categories
            links = db.select("product_categories", "*", filters=[("eq", "product_id", p['id'])])
            print(f"  > Linked Categories: {links}")

    print("\n--- Searching for Review ---")
    # Search review by partial title or source_slug
    reviews = db.select("reviews", "*", filters=[("ilike", "title", "%Aceline%")]) # title might be null if not translated yet
    if not reviews:
        # Try finding by looking at all recent reviews
        reviews = db.select("reviews", "*", limit=5, order=("created_at", False))
        print("Checking recent 5 reviews as specific search failed:")
    
    for r in reviews:
        print(f"Review: ID={r['id']}")
        print(f"  > Title: {r.get('title')}")
        print(f"  > Slug: {r.get('source_slug')}")
        print(f"  > Category ID: {r.get('category_id')}")
        print(f"  > SubCategory ID: {r.get('sub_category_id')}")
        print(f"  > Product ID: {r.get('product_id')}")

if __name__ == "__main__":
    asyncio.run(check_status())
