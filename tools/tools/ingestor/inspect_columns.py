import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

tables = ["reviews", "review_translations", "products", "product_translations", "product_images"]

for table in tables:
    print(f"\n--- Table: {table} ---")
    try:
        # Get one row to see columns
        res = supabase.table(table).select("*").limit(1).execute()
        if res.data:
            cols = list(res.data[0].keys())
            print(f"Columns: {cols}")
            if "products" in table:
                if "source_url" in cols:
                    print(f"  [YES] 'source_url' FOUND in {table}")
                else:
                    print(f"  [NO] 'source_url' NOT FOUND in {table}")
        else:
            print("Table is empty, cannot infer columns from select *")
    except Exception as e:
        print(f"Error: {e}")
