
import os
from dotenv import load_dotenv
from supabase import create_client, Client

def check_all_tables():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)
    
    tables = ["categories", "category_translations", "reviews", "review_translations", "source_map", "profiles"]
    for t in tables:
        try:
            res = supabase.table(t).select("*").limit(1).execute()
            print(f"Table {t} exists. Rows: {len(res.data)}")
            if res.data:
                print(f"  Columns: {res.data[0].keys()}")
        except Exception as e:
            print(f"Table {t} error: {e}")

if __name__ == "__main__":
    check_all_tables()
