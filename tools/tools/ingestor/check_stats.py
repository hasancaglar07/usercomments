from ingestor.config import Config
from ingestor.db.supabase_client import SupabaseClient
import logging
import sys

def check():
    config = Config.from_env()
    logger = logging.getLogger("checker")
    sb = SupabaseClient(config.supabase_url, config.supabase_service_role_key, logger)
    
    cats = sb.select("categories", columns="id")
    prods = sb.select("products", columns="id")
    trans = sb.select("category_translations", columns="category_id", filters=[("eq", "lang", "en")])
    
    print(f"Total Categories: {len(cats)}")
    print(f"Total Products: {len(prods)}")
    print(f"Translated Categories (EN): {len(trans)}")

if __name__ == "__main__":
    check()
