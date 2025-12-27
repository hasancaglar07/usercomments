import logging
import asyncio
import random
import os
import re
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from ..config import Config
from ..http_client import HttpClient
from ..db.upsert import (
    upsert_categories,
    upsert_category_translations,
    upsert_product,
    upsert_product_translations,
    upsert_product_image,
    link_product_to_category,
)
from ..llm.groq_client import GroqClient
from ..llm.translate_and_seo import translate_category, translate_product
from ..media.image_fetch import fetch_image
from ..media.image_process import process_image
from ..media.r2_upload import R2Uploader
from .selectors import (
    SUBCATEGORY_LINK_SELECTORS,
    CATALOG_PAGINATION_NEXT,
    CATALOG_PRODUCT_ITEMS,
    PRODUCT_IMAGE_SELECTORS,
)

logger = logging.getLogger(__name__)

class CatalogSpider:
    def __init__(
        self, 
        config: Config, 
        http: HttpClient, 
        groq: GroqClient, 
        supabase,
        logger: logging.Logger
    ):
        self.config = config
        self.http = http
        self.groq = groq
        self.supabase = supabase
        self.logger = logger
        self.r2 = R2Uploader(
            endpoint=config.r2_endpoint,
            region=config.r2_region,
            access_key_id=config.r2_access_key_id,
            secret_access_key=config.r2_secret_access_key,
            bucket=config.r2_bucket,
            public_base_url=config.r2_public_base_url,
            logger=logger
        )
        self.state_file = "catalog_visited_urls.txt"
        self.visited_urls: Set[str] = self._load_state()
        self.queued_urls: Set[str] = set()
        self.queue = asyncio.Queue()

    def _load_state(self) -> Set[str]:
        if not os.path.exists(self.state_file):
            return set()
        try:
            with open(self.state_file, "r", encoding="utf-8") as f:
                return set(line.strip() for line in f if line.strip())
        except Exception:
            return set()

    def _save_state_url(self, url: str):
        try:
            with open(self.state_file, "a", encoding="utf-8") as f:
                f.write(f"{url}\n")
        except Exception as e:
            logger.warning(f"Failed to save state for {url}: {e}")

    def _normalize_url(self, base_url: str, href: str) -> Optional[str]:
        if not href:
            return None
        full = urljoin(base_url, href)
        parsed = urlparse(full)
        if not parsed.scheme.startswith("http"):
            return None
        return parsed._replace(fragment="").geturl()

    def _extract_source_key(self, url: str) -> Optional[str]:
        parsed = urlparse(url)
        match = re.search(r"(\d+)", parsed.path)
        if match:
            return match.group(1)
        query_match = re.search(r"id=(\d+)", parsed.query)
        if query_match:
            return query_match.group(1)
        return None

    # -------------------------------------------------------------------------
    # STRICT 2-LEVEL CATALOG CRAWL LOGIC
    # -------------------------------------------------------------------------

    async def run(self, seed_urls: List[str]):
        """Strict runner to explore ONLY the master directory structure (Top > Sub)."""
        # Strict override for user request
        master_url = "https://irecommend.ru/category/katalog-otzyvov"
        
        self.logger.info(f"Starting strict catalog import from: {master_url}")
        
        # We don't use queue or recursion here. Just one pass.
        await self.process_category_node(master_url)
        
        self.logger.info("Catalog import complete.")

    async def process_category_node(self, category_url: str, parent_id: Optional[int] = None, depth: int = 0) -> List[Tuple[str, Optional[int], int]]:
        # Strictly only process the master catalog page
        if "/category/katalog-otzyvov" not in category_url:
            self.logger.warning(f"Skipping non-master URL: {category_url}")
            return []
        
        try:
            resp = self.http.get(category_url)
            html = resp.text
        except Exception as e:
            self.logger.error(f"Failed to fetch {category_url}: {e}")
            return []

        soup = BeautifulSoup(html, "lxml")
        
        self.logger.info("Parsing Master Directory...")
        blocks = soup.select(".categoryBlock")
        
        total_top = 0
        total_sub = 0

        for block in blocks:
            # 1. Top Level Category
            # Selector: matches <a ...><h2>...</h2></a>
            main_link = block.select_one("a:has(h2)")
            
            if not main_link:
                # Fallback: link inside h2?
                main_link = block.select_one("h2 a")
            
            if not main_link:
                # Fallback: look for generic header link
                main_link = block.select_one(".catHeader a")
            
            if not main_link:
                continue
                
            main_url = self._normalize_url(self.config.source_base_url, main_link.get("href"))
            if not main_url:
                continue

            h1_text = main_link.get_text(strip=True)
            source_key = self._extract_source_key(main_url)
            
            try:
                upserted = upsert_categories(self.supabase, [{"source_url": main_url, "name": h1_text, "parent_id": None, "source_key": source_key}], self.logger)
                main_id = upserted.get(main_url)
                
                if main_id:
                    total_top += 1
                    await self._check_translate(main_id, h1_text)
                    
                    # 2. Sub Categories (Level 2)
                    # Try specific class first, then general list, then fall back to all links
                    sub_links = block.select("ul.catList li a")
                    if not sub_links:
                        sub_links = block.select("ul li a")
                    if not sub_links:
                        # Fallback: get all links in block, exclude the main header link/urls
                        main_href = main_link.get("href")
                        all_a = block.select("a")
                        sub_links = []
                        for a in all_a:
                           h = a.get("href")
                           # Important: main_link might be one of those A tags or wrapping H2
                           # We exclude it by ref or href comparison
                           if h and h != main_href and a != main_link:
                               sub_links.append(a)

                    seen_subs = set()
                    for sub in sub_links:
                        sub_href = sub.get("href")
                        sub_url = self._normalize_url(self.config.source_base_url, sub_href)
                        if not sub_url: continue
                        if sub_url == main_url: continue 
                        if sub_url in seen_subs: continue
                        seen_subs.add(sub_url)
                        
                        sub_name = sub.get_text(strip=True)
                        if not sub_name: continue
                        
                        sub_key = self._extract_source_key(sub_url)
                        
                        upserted_sub = upsert_categories(self.supabase, [{"source_url": sub_url, "name": sub_name, "parent_id": main_id, "source_key": sub_key}], self.logger)
                        sub_id = upserted_sub.get(sub_url)
                        
                        if sub_id:
                            total_sub += 1
                            await self._check_translate(sub_id, sub_name)
            except Exception as e:
                self.logger.error(f"Error processing block {h1_text}: {e}")

        self.logger.info(f"Processed {total_top} top categories and {total_sub} subcategories.")    
        return []

    async def _check_translate(self, cat_id: int, name_ru: str):
        existing_trans = self.supabase.select("category_translations", columns="category_id", filters=[("eq", "category_id", cat_id), ("eq", "lang", "en")])
        if not existing_trans:
            self.logger.info(f"Translating: {name_ru}")
            translations = await translate_category(self.groq, name_ru, self.config.langs, self.logger)
            if translations:
                upsert_category_translations(self.supabase, cat_id, translations.values(), self.logger)
    
    # Keeping this method signature to satisfy interface if needed, but unused
    async def process_product_list(self, soup: BeautifulSoup, category_id: int, category_name: str):
        pass

    async def _process_single_product(self, product_url: str, name_ru: str, category_id: int, category_name: str, teaser_soup: Optional[BeautifulSoup] = None):
        pass
