
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

def check_schema():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing Supabase credentials in .env")
        return

    supabase: Client = create_client(url, key)
    try:
        # Check profiles table
        res = supabase.table("profiles").select("*").limit(1).execute()
        print("Profiles table exists. Sample data:", res.data)
        if res.data and len(res.data) > 0:
            print("Columns:", res.data[0].keys())
        else:
            print("Profiles table is empty. Checking system columns...")
            # We can't easily check columns if empty via Postgrest, but let's try a dry select of id
            try:
                supabase.table("profiles").select("id").limit(1).execute()
                print("Column 'id' exists")
            except Exception as e:
                print("Error selecting 'id':", e)

    except Exception as e:
        print("Error checking profiles:", e)

if __name__ == "__main__":
    check_schema()
