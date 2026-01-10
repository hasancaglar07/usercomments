import os
import asyncio
from dotenv import load_dotenv
from ingestor.db.supabase_client import SupabaseClient
from ingestor.logger import setup_logging

# Load environment variables
load_dotenv()

async def main():
    logger = setup_logging("skip_tool.log")
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("Error: .env not loaded or missing keys.")
        return

    supabase = SupabaseClient(url, key, logger)
    
    bad_url = "https://irecommend.ru/content/tochilka-dlya-nozhei-vsego-za-84-rublya-idealnaya-pomoshchnitsa-na-kukhne-udachnoe-priobrete"
    
    print(f"Marking as failed: {bad_url}")
    
    try:
        # Manually update the record to 'failed' with max retries to ensure it's skipped
        supabase.update(
            "source_map",
            {
                "status": "failed", 
                "retries": 99, 
                "last_error": "Manual skip: Persistent 403 (burned URL) despite bot fix"
            },
            filters=[("eq", "source_url", bad_url)]
        )
        print("Success! Item marked as failed.")
    except Exception as e:
        print(f"Failed to update: {e}")

if __name__ == "__main__":
    asyncio.run(main())
