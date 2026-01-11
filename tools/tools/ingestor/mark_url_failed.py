"""
Quick script to mark a problematic URL as permanently failed in the database.
This prevents it from blocking the ingestor queue.

Usage: python mark_url_failed.py <url>
"""
import os
import sys

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from ingestor.db.supabase_client import SupabaseClient
from ingestor.db.state import mark_failed

def main():
    if len(sys.argv) < 2:
        print("Usage: python mark_url_failed.py <url>")
        print("\nThis script marks a URL as permanently failed (retries=99) to prevent it from blocking the queue.")
        sys.exit(1)
    
    url = sys.argv[1]
    
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        print(f"  SUPABASE_URL present: {bool(supabase_url)}")
        print(f"  SUPABASE_SERVICE_KEY present: {bool(supabase_key)}")
        sys.exit(1)
    
    client = SupabaseClient(supabase_url, supabase_key)
    
    print(f"Marking URL as permanently failed: {url}")
    
    # Mark with high retry count to prevent re-processing
    mark_failed(client, url, retries=99, reason="Manually marked as permanently failed - persistent bot protection")
    
    print("Done! URL will no longer be picked up by the ingestor.")

if __name__ == "__main__":
    main()
