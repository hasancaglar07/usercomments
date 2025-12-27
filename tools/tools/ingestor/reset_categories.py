from ingestor.config import Config
from ingestor.db.supabase_client import SupabaseClient
import sys

def run():
    config = Config.from_env()
    db = SupabaseClient(config.supabase_url, config.supabase_service_role_key, None)

    print("Step 1: Creating 'Diğerleri' (Others) category...")
    # Check if exists
    others = db.select('categories', columns='id', filters=[('eq', 'name', 'Diğerleri')])
    if others:
        others_id = others[0]['id']
        print(f"Found existing 'Diğerleri': {others_id}")
    else:
        # Create it
        res = db.insert('categories', [{'name': 'Diğerleri', 'parent_id': None, 'source_url': 'custom-others'}])
        if not res:
            print("Failed to create Others category")
            sys.exit(1)
        others_id = res[0]['id']
        print(f"Created 'Diğerleri': {others_id}")

    print("Step 2: Migrating Reviews...")
    # Update all reviews to point to this category
    # Note: We can't easily filter "all", but we can filter by ID > '0000...' (uuid) or similar.
    # Actually, let's just use a filter that is always true if possible or fetch + bulk update?
    # Bulk update is better. But with 483 categories, there might be many reviews?
    # User said "195 products" were ingested. Reviews? Probably few.
    # Supabase update without filter might be blocked.
    # Let's try updating where category_id is NOT 'Diğerleri'
    
    # We need to know which reviews to update. 
    # Let's select all IDs first.
    all_reviews = db.select('reviews', columns='id')
    print(f"Found {len(all_reviews)} reviews.")
    
    # Update individually or in batches?
    # Helper update doesn't support bulk update with different values, but here value is Same.
    # But Helper update is `query.update(updates)`. If I filter `in ('id', [list of ids])`, it should work.
    if all_reviews:
        review_ids = [r['id'] for r in all_reviews]
        # Process in chunks of 50
        chunk_size = 50
        for i in range(0, len(review_ids), chunk_size):
            chunk = review_ids[i:i+chunk_size]
            db.update('reviews', 
                      {'category_id': others_id, 'sub_category_id': None}, 
                      filters=[('in', 'id', chunk)])
    print("Reviews migrated.")

    print("Step 3: Migrating Products...")
    # Re-link products to "Diğerleri".
    # First, clear `product_categories`
    # We can delete all rows in `product_categories`.
    # To delete all, we need a filter matching all. `id.neq.0`? `product_categories` usually has composite PK.
    # Supabase-py might not support `delete` without filter.
    # Let's fetch all product_categories and delete them.
    pcs = db.select('product_categories', columns='product_id, category_id')
    print(f"Found {len(pcs)} product-category links.")
    
    # Delete them. We can filter by product_id in list.
    if pcs:
        p_ids = list(set([p['product_id'] for p in pcs]))
        for i in range(0, len(p_ids), chunk_size):
            chunk = p_ids[i:i+chunk_size]
            db.delete('product_categories', filters=[('in', 'product_id', chunk)])
            
    # Now link all products to Others
    all_products = db.select('products', columns='id')
    print(f"Found {len(all_products)} products.")
    if all_products:
        p_ids = [p['id'] for p in all_products]
        # Insert links
        # chunks
        for i in range(0, len(p_ids), chunk_size):
            chunk = p_ids[i:i+chunk_size]
            payload = [{"product_id": pid, "category_id": others_id} for pid in chunk]
            db.upsert('product_categories', payload, on_conflict="product_id,category_id")
    print("Products migrated.")

    print("Step 4: Deleting old categories...")
    # Fetch all categories
    all_cats = db.select('categories', columns='id')
    # Exclude Others
    to_delete = [c['id'] for c in all_cats if c['id'] != others_id]
    print(f"Deleting {len(to_delete)} categories...")
    
    # Delete in chunks
    for i in range(0, len(to_delete), chunk_size):
        chunk = to_delete[i:i+chunk_size]
        db.delete('categories', filters=[('in', 'id', chunk)])
        
    print("Cleanup complete!")

if __name__ == "__main__":
    run()
