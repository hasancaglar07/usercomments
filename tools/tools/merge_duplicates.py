import os
import sys
import argparse
from collections import defaultdict
from dotenv import load_dotenv

# Try multiple .env locations
# Try multiple .env locations
script_dir = os.path.dirname(os.path.abspath(__file__))
env_paths = [
    os.path.join(script_dir, 'ingestor', '.env'),
    os.path.join(script_dir, '..', '..', 'workers', 'api', '.dev.vars'),
]

for env_path in env_paths:
    if os.path.exists(env_path):
        print(f"Loading env from: {env_path}")
        load_dotenv(env_path)

from supabase import create_client

SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')

if not SUPABASE_URL:
    print("Error: Missing SUPABASE_URL")
    # Debug: print what we have
    print("Available keys starting with SUPABASE:")
    for k in os.environ:
        if k.startswith('SUPABASE'):
            print(f" - {k}")

if not SUPABASE_SERVICE_KEY:
    print("Error: Missing SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Please ensure your .env or .dev.vars file is correctly configured.")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def fetch_all_products():
    """Fetches minimal product data to detect duplicates."""
    print("Fetching all products...")
    all_products = []
    page = 0
    page_size = 1000
    
    while True:
        result = supabase.table('products').select('id, name, slug, created_at').range(page * page_size, (page + 1) * page_size - 1).execute()
        items = result.data
        if not items:
            break
        all_products.extend(items)
        page += 1
        print(f"Fetched {len(all_products)} products so far...")
    
    return all_products

import difflib
import re

def normalize_name(name):
    """
    Normalizes product name for fuzzy comparison.
    - Lowercase
    - Remove punctuation
    - Remove 'stop words' (common suffixes/prefixes)
    """
    # Lowercase and remove non-alphanumeric (keep spaces)
    name = name.lower()
    name = re.sub(r'[^a-z0-9\s]', '', name)
    
    # Remove common business/review suffixes
    stop_words = [
        ' inc', ' corp', ' corporation', ' ltd', ' llc', ' co', 
        ' official', ' site', ' website', ' app', ' application',
        ' review', ' reviews', ' guide', ' login'
    ]
    
    for word in stop_words:
        if name.endswith(word):
            name = name[:-len(word)]
        if name.startswith(word.strip() + ' '):
            name = name[len(word.strip())+1:]
            
    return name.strip()

def group_duplicates(products):
    """
    Groups products by similar names using fuzzy matching.
    """
    print("Grouping products using fuzzy matching (this may take a moment)...")
    
    # 1. First, strict grouping (fast) to reduce N
    strict_groups = defaultdict(list)
    for p in products:
        norm = normalize_name(p['name'])
        strict_groups[norm].append(p)
    
    # 2. Fuzzy merge valid groups
    # We treat keys of strict_groups as "representatives"
    unique_names = list(strict_groups.keys())
    unique_names.sort(key=len, reverse=True) # Longest first usually better for substring checks?
    
    merged_groups = [] # List of lists of products
    processed_names = set()
    
    for i, name1 in enumerate(unique_names):
        if name1 in processed_names:
            continue
            
        current_cluster = strict_groups[name1]
        processed_names.add(name1)
        
        # Compare with all subsequent names
        for name2 in unique_names[i+1:]:
            if name2 in processed_names:
                continue
                
            # Similarity check
            ratio = difflib.SequenceMatcher(None, name1, name2).ratio()
            
            # Criteria for match:
            # 1. High similarity ratio (> 0.85)
            # 2. One is contained in other AND ratio > 0.6 (e.g. "Adobe" vs "Adobe Systems")
            
            is_match = False
            if ratio > 0.85:
                is_match = True
            elif (name1 in name2 or name2 in name1) and ratio > 0.6:
                # Protection against "Mail" vs "Gmail" -> ratio is 0.88, caught by above.
                # "Car" vs "Car Wash" -> ratio 0.54. 
                # "Hainan Airlines" vs "Hainan Airlines Flight" -> ratio ~0.7
                is_match = True
            
            if is_match:
                current_cluster.extend(strict_groups[name2])
                processed_names.add(name2)
        
        if len(current_cluster) > 1:
            merged_groups.append(current_cluster)
            
    # Return as dict for compatibility with existing code structure
    # Key can be the name of the first item
    result = {}
    for group in merged_groups:
        key = group[0]['name']
        result[key] = group
        
    return result

def get_product_details(product_id):
    """Fetches stats to help decide the master."""
    # Try fetching stats. If it fails, return empty dict.
    try:
        stats = supabase.table('product_stats').select('review_count').eq('product_id', product_id).maybe_single().execute()
        return stats.data or {'review_count': 0}
    except Exception:
        return {'review_count': 0}

def merge_products(master, victim, dry_run=True):
    """
    Merges 'victim' product into 'master' product.
    1. Moves Reviews
    2. Moves Images (appends)
    3. Moves Collections/Categories (union)
    4. Moves/Merges Translations
    5. Deletes Victim
    """
    print(f"\n[Plan] Merging '{victim['name']}' ({victim['id']}) -> '{master['name']}' ({master['id']})")
    
    if dry_run:
        print("  [DRY RUN] Would move reviews, images, categories, and delete victim.")
        return True

    try:
        # 1. Update Reviews
        # reviews table usually has product_id
        res = supabase.table('reviews').update({'product_id': master['id']}).eq('product_id', victim['id']).execute()
        print(f"  ✓ Moved reviews")

        # 2. Update Images
        # First check master's max sort_order
        master_imgs = supabase.table('product_images').select('sort_order').eq('product_id', master['id']).execute()
        max_sort = 0
        if master_imgs.data:
            max_sort = max([img['sort_order'] or 0 for img in master_imgs.data], default=0)
        
        # Get victim images
        victim_imgs = supabase.table('product_images').select('id, url, sort_order').eq('product_id', victim['id']).execute()
        start_sort = max_sort + 1
        
        for img in victim_imgs.data:
            # Check if this URL already exists in master to avoid exact dupe images
            existing = supabase.table('product_images').select('id').eq('product_id', master['id']).eq('url', img['url']).execute()
            if not existing.data:
                supabase.table('product_images').update({
                    'product_id': master['id'],
                    'sort_order': start_sort
                }).eq('id', img['id']).execute()
                start_sort += 1
            else:
                # Delete duplicate image
                supabase.table('product_images').delete().eq('id', img['id']).execute()
        print(f"  ✓ Merged images")

        # 3. Product Categories
        # Move categories that master doesn't have
        victim_cats = supabase.table('product_categories').select('*').eq('product_id', victim['id']).execute()
        for cat in victim_cats.data:
            # Check if master has this category
            existing = supabase.table('product_categories').select('*').eq('product_id', master['id']).eq('category_id', cat['category_id']).execute()
            if not existing.data:
                supabase.table('product_categories').insert({
                    'product_id': master['id'],
                    'category_id': cat['category_id']
                }).execute()
        # Delete old category links (handled by cascade usually, but safe to do)
        supabase.table('product_categories').delete().eq('product_id', victim['id']).execute()
        print(f"  ✓ Merged categories")

        # 4. Translations
        # Preserve Master's translations. If Victim has a language Master doesn't, move it.
        victim_trans = supabase.table('product_translations').select('*').eq('product_id', victim['id']).execute()
        for trans in victim_trans.data:
            existing = supabase.table('product_translations').select('id').eq('product_id', master['id']).eq('lang', trans['lang']).execute()
            if not existing.data:
                # Update product_id to master
                # Need to handle potential slug conflicts too?
                # Usually slug is unique per lang? Schema says (lang, slug) unique?
                # If we just change product_id, slug remains same. If that slug exists for another product in that lang... (unlikely since we merged by name, but possible)
                
                # Check if slug is taken by master (unlikely if master didn't have lang) or anyone else?
                # Actually, if we move it to master, (master_id, lang) is unique.
                # But (lang, slug) must be unique globally? 
                # If so, we are fine as long as master doesn't have a translation with same slug (it doesn't have same lang).
                
                # We need to delete the specific translation row and insert a new one or update PK?
                # product_translations usually PK is (product_id, lang)? or ID?
                # Let's try update.
                try:
                    supabase.table('product_translations').update({'product_id': master['id']}).eq('product_id', victim['id']).eq('lang', trans['lang']).execute()
                except Exception as e:
                    print(f"  ! Warning: Could not move translation {trans['lang']}: {e}")
            else:
                # Master has this lang. Drop victim trans.
                pass
                
        # 5. Delete Victim Product
        supabase.table('products').delete().eq('id', victim['id']).execute()
        print(f"  ✓ Deleted victim product")
        return True

    except Exception as e:
        print(f"  ✗ Error during merge: {e}")
        return False

def select_master_interactive(products):
    """
    Shows options and asks user to pick master.
    """
    print(f"\n--- Constructing Merge Group: '{products[0]['name']}' ---")
    options = []
    
    # Enrich with stats
    for p in products:
        stats = get_product_details(p['id'])
        p['review_count'] = stats.get('review_count', 0)
        p['photo_count'] = stats.get('photo_count', 0)
        options.append(p)

    # Sort by created_at (oldest first) as default recommendation
    # But also consider review count.
    # Logic: Prefer one with reviews. If equal, prefer oldest.
    options.sort(key=lambda x: (x['review_count'], -1 * float(x['created_at'].replace('-','').replace(':','').replace('T','')[:14])), reverse=True)
    
    # Display
    for idx, p in enumerate(options):
        print(f" {idx+1}. ID: {p['id']} | Created: {p['created_at']} | Reviews: {p['review_count']} | Slug: {p['slug']}")
    
    choice = input("Select Master Product (1-%d) or 's' to Skip: " % len(options))
    if choice.lower() == 's':
        return None, []
    
    try:
        idx = int(choice) - 1
        if 0 <= idx < len(options):
            master = options[idx]
            victims = [o for i, o in enumerate(options) if i != idx]
            return master, victims
    except ValueError:
        pass
    
    return None, []

def main():
    parser = argparse.ArgumentParser(description="Find and merge duplicate products")
    parser.add_argument('--run', action='store_true', help="Actually execute the merge (default is dry-run)")
    parser.add_argument('--auto', action='store_true', help="Auto-merge based on review count and age (Oldest with most reviews wins)")
    args = parser.parse_args()

    products = fetch_all_products()
    groups = group_duplicates(products)
    
    print(f"\nFound {len(groups)} groups of duplicates.")
    
    count_merged = 0
    
    for name, group in groups.items():
        master = None
        victims = []
        
        if args.auto:
             # Logic: sort by review_count DESC, then created_at ASC (Oldest)
             # Note string comparison for ISO dates works for 'oldest' if we want smaller string? No, ASC means older.
             # sorted(key=created_at) -> [oldest, ..., newest]
             # We want master to be: max reviews, then oldest.
             # sort key: (-review_count, created_at) -> smallest wins (Most reviews, earliest date)
             
             enriched_group = []
             for p in group:
                 stats = get_product_details(p['id'])
                 p['review_count'] = stats.get('review_count', 0)
                 enriched_group.append(p)
                 
             enriched_group.sort(key=lambda x: (-x['review_count'], x['created_at']))
             master = enriched_group[0]
             victims = enriched_group[1:]
             print(f"Auto-selected Master: {master['name']} (Reviews: {master['review_count']}, Date: {master['created_at']})")
        else:
            master, victims = select_master_interactive(group)
        
        if master and victims:
            dry_run = not args.run
            for v in victims:
                success = merge_products(master, v, dry_run=dry_run)
                if success and not dry_run:
                    count_merged += 1
        else:
            print(f"Skipping group: {name}")

    print(f"\nDone. Merged {count_merged} duplicates.")

if __name__ == "__main__":
    main()
