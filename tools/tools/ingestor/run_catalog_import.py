import logging
import asyncio
import os
from dotenv import load_dotenv

from ingestor.config import Config
from ingestor.http_client import HttpClient
from ingestor.db.supabase_client import SupabaseClient
from ingestor.llm.groq_client import GroqClient
from ingestor.crawl.catalog_spider import CatalogSpider

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | cat-import | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.FileHandler("ingestor.log", encoding="utf-8"),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger("cat-import")

async def main():
    load_dotenv()
    logger = setup_logging()
    logger.info("Starting BFS Catalog Import...")

    config = Config.from_env()
    
    # 1. Initialize Clients
    http = HttpClient(
        timeout_seconds=config.http_timeout_seconds,
        max_retries=config.http_max_retries,
        user_agent=config.user_agent,
        logger=logger,
        proxy=config.http_proxy
    )
    
    groq = GroqClient(
        api_key=config.groq_api_key,
        model=config.groq_model,
        logger=logger
    )
    
    supabase = SupabaseClient(
        url=config.supabase_url,
        key=config.supabase_service_role_key,
        logger=logger
    )

    spider = CatalogSpider(config, http, groq, supabase, logger)

    # 2. Start from Master Directory for best coverage
    seed_urls = [
        f"{config.source_base_url}/category/katalog-otzyvov",
    ]
    
    logger.info("Initiating BFS crawl...")
    try:
        await spider.run(seed_urls)
    except KeyboardInterrupt:
        logger.info("Crawl interrupted by user.")
    except Exception as e:
        logger.error(f"Critical error in crawl: {e}", exc_info=True)
    finally:
        logger.info("Catalog Import Finished.")

if __name__ == "__main__":
    asyncio.run(main())
