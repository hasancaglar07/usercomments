import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

# Fetch all pending or failed sources
res = supabase.table('source_map').select('source_url').neq('status', 'processed').execute()
pending = res.data or []

product_overviews = [x['source_url'] for x in pending if "-n" not in x['source_url']]
print(f"Total pending/failed items: {len(pending)}")
print(f"Product overview items to remove: {len(product_overviews)}")

if product_overviews:
    print("Removing garbage from source_map...")
    for i in range(0, len(product_overviews), 100):
        chunk = product_overviews[i:i+100]
        supabase.table('source_map').delete().in_('source_url', chunk).execute()
    print("Done cleaning source_map.")
else:
    print("No garbage found.")
