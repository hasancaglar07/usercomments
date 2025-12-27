import os
from dotenv import load_dotenv
from supabase import create_client

def check_prod_img_schema():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)
    
    print("Checking product_images columns...")
    try:
        res = supabase.table("product_images").select("*").limit(1).execute()
        if res.data:
            print(f"Columns: {list(res.data[0].keys())}")
        else:
            print("No data in product_images, checking error...")
            # Insert dummy to fail and see columns or just assume
            print("Table exists but empty.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_prod_img_schema()
