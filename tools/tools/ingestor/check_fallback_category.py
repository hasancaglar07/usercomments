"""
Check and optionally create a fallback "Other" category for unmatched reviews.
Run this script to see existing categories and get the ID for FALLBACK_CATEGORY_ID.
"""
import os
import sys
from dotenv import load_dotenv

# Add ingestor package to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ingestor.db.supabase_client import SupabaseClient
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

def main():
    supabase = SupabaseClient(
        url=os.getenv("SUPABASE_URL"),
        key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        logger=logger,
        dry_run=False
    )
    
    # Fetch all parent categories (parent_id is null)
    print("\n" + "="*60)
    print("EXISTING PARENT CATEGORIES")
    print("="*60)
    
    rows = supabase.select(
        "categories",
        "id, name, source_url",
        filters=[("is", "parent_id", "null")],
        order=("name", "asc")
    )
    
    for row in rows:
        print(f"  ID: {row['id']:4} | Name: {row.get('name', 'N/A')[:50]:<50}")
    
    print(f"\nTotal parent categories: {len(rows)}")
    
    # Check if "Other" or "Diğer" exists
    other_names = ["other", "diğer", "diger", "miscellaneous", "misc", "genel", "general"]
    found_other = None
    
    for row in rows:
        name = (row.get("name") or "").strip().lower()
        if name in other_names:
            found_other = row
            break
    
    print("\n" + "="*60)
    
    if found_other:
        print(f"✅ FALLBACK CATEGORY FOUND!")
        print(f"   ID: {found_other['id']}")
        print(f"   Name: {found_other.get('name')}")
        print(f"\n👉 Add this to your .env or run_ingestor.bat:")
        print(f"   set FALLBACK_CATEGORY_ID={found_other['id']}")
    else:
        print("❌ No 'Other' / 'Diğer' category found.")
        print("\n👉 OPTIONS:")
        print("   1. Create a new 'Other' category in your admin panel")
        print("   2. Use an existing category ID from the list above")
        print("   3. Run this script with --create to auto-create 'Other' category")
        
        if len(sys.argv) > 1 and sys.argv[1] == "--create":
            print("\n📝 Creating 'Other' category...")
            payload = {
                "name": "Other",
                "source_url": "https://irecommend.ru/other",
                "parent_id": None,
            }
            supabase.insert("categories", [payload])
            
            # Fetch the new category
            new_rows = supabase.select("categories", "id", filters=[("eq", "name", "Other")])
            if new_rows:
                new_id = new_rows[0]["id"]
                print(f"✅ Created 'Other' category with ID: {new_id}")
                print(f"\n👉 Add this to your .env or run_ingestor.bat:")
                print(f"   set FALLBACK_CATEGORY_ID={new_id}")
                
                # Also create translations
                translations = [
                    {"category_id": new_id, "lang": "en", "name": "Other", "slug": "other"},
                    {"category_id": new_id, "lang": "tr", "name": "Diğer", "slug": "diger"},
                    {"category_id": new_id, "lang": "de", "name": "Sonstiges", "slug": "sonstiges"},
                    {"category_id": new_id, "lang": "es", "name": "Otros", "slug": "otros"},
                ]
                for t in translations:
                    try:
                        supabase.upsert("category_translations", [t], on_conflict="category_id,lang")
                        print(f"   Created translation: {t['lang']} -> {t['name']}")
                    except Exception as e:
                        print(f"   Warning: translation {t['lang']} failed: {e}")
            else:
                print("❌ Failed to create category")

if __name__ == "__main__":
    main()
