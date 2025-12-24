import os
import asyncio
import logging
import argparse
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

from .config import Config
from .http_client import HttpClient
from .logger import setup_logging
from .crawl.catalog_discovery import discover_catalog_categories
from .crawl.category_discovery import discover_subcategories, parse_category_name
from .crawl.review_detail_parser import ReviewDetail, parse_review_detail
from .crawl.review_list_discovery import build_page_urls, discover_review_links
from .db.state import fetch_new_sources, mark_failed, mark_processed, mark_processing, upsert_source_map
from .db.supabase_client import SupabaseClient
from .db.upsert import (
    fetch_categories_by_source_urls,
    update_review_photos,
    upsert_categories,
    upsert_category_translations,
    upsert_review,
    upsert_review_translations,
    upsert_product,
    upsert_product_translations,
    upsert_product_image,
    link_product_to_category,
)
from .db.user_pool import ProfilePool
from .llm.groq_client import GroqClient
from .llm.translate_and_seo import translate_category, translate_product, translate_review, extract_review_details_ai
from .media.r2_upload import R2Uploader
from .media.image_fetch import fetch_image
from .media.image_process import process_image
from .utils.backoff import sleep_with_backoff
from .utils.hashing import sha1_bytes, sha1_text
from .utils.slugify import slugify
from .utils.text_clean import clean_html, normalize_whitespace
from .utils.timing import sleep_jitter


async def _fetch_html_async(http: HttpClient, url: str, logger: logging.Logger) -> str:
    # Use thread for cloudscraper sync get
    def _fetch():
        response = http.get(url)
        response.encoding = response.apparent_encoding
        return response.text
    
    text = await asyncio.to_thread(_fetch)
    logger.info("Fetched %s", url)
    
    # Small delay after fetch to be gentle on proxy
    await asyncio.sleep(2)
    return text


def _normalize_url(base_url: str, href: Optional[str]) -> Optional[str]:
    if not href:
        return None
    full = urljoin(base_url, href)
    parsed = urlparse(full)
    return parsed._replace(fragment="").geturl()


def _infer_product_name(title: Optional[str]) -> Optional[str]:
    if not title:
        return None
    name = normalize_whitespace(title)
    return name or None


async def _process_images_async(
    http: HttpClient,
    uploader: Optional[R2Uploader],
    config: Config,
    image_urls: List[str],
    review_id: Optional[str],
    source_slug: str,
    logger: logging.Logger,
    dry_run: bool,
    prefix: str = "reviews"
) -> List[str]:
    photo_urls: List[str] = []
    
    async def _process_one(img_url):
        raw = await asyncio.to_thread(fetch_image, http, img_url, logger)
        if not raw:
            return None
        processed = await asyncio.to_thread(
            process_image, 
            raw, 
            config.image_crop_right_pct, 
            config.image_max_width, 
            config.image_webp_quality,
            "UserReview.net"
        )
        if not processed:
            return None
        
        filename = f"{sha1_bytes(processed)}.webp"
        base = review_id or source_slug
        key = f"public/{prefix}/{base}/{filename}"
        
        if dry_run:
            if uploader:
                return f"{uploader.public_base_url}/{key}"
            return None
        
        if not uploader:
            raise RuntimeError("Uploader not configured")
        
        return await asyncio.to_thread(uploader.upload_bytes, key, processed)

    results = await asyncio.gather(*[_process_one(u) for u in image_urls])
    return [r for r in results if r]


async def _ensure_category_ids_async(
    http: HttpClient,
    supabase: SupabaseClient,
    category_map: Dict[str, int],
    detail: ReviewDetail,
    base_url: str,
    groq: GroqClient,
    config: Config,
    uploader: Optional[R2Uploader],
    logger: logging.Logger,
    dry_run: bool,
) -> Dict[str, Optional[Any]]:
    updates: Dict[str, Optional[Any]] = {"category_id": None, "sub_category_id": None, "product_id": None}

    cat_url = _normalize_url(base_url, detail.category_url)
    sub_url = _normalize_url(base_url, detail.subcategory_url)
    prod_name = detail.product_name or _infer_product_name(detail.title)
    if not prod_name and detail.source_slug:
        prod_name = detail.source_slug.replace("-", " ").strip() or None

    # 1. Ensure Category
    cat_id = None
    if cat_url:
        cat_id = category_map.get(cat_url)
        if not cat_id and detail.category_name:
            payload = [{"source_url": cat_url, "name": detail.category_name, "parent_id": None}]
            await asyncio.to_thread(upsert_categories, supabase, payload, logger)
            cat_id = (await asyncio.to_thread(fetch_categories_by_source_urls, supabase, [cat_url])).get(cat_url)
            if cat_id:
                category_map[cat_url] = cat_id
    
    if cat_id and detail.category_name:
        # Check if translation exists
        first_lang = config.langs[0] if config.langs else "en"
        rows = await asyncio.to_thread(supabase.select, "category_translations", "lang", [("eq", "category_id", cat_id), ("eq", "lang", first_lang)])
        if not rows:
            try:
                trans = await translate_category(groq, detail.category_name, config.langs, logger)
                await asyncio.to_thread(upsert_category_translations, supabase, cat_id, trans.values(), logger)
            except Exception as e:
                logger.warning("Category translation failed: %s", e)

    # 2. Ensure Subcategory
    sub_id = None
    if sub_url:
        sub_id = category_map.get(sub_url)
        if not sub_id and detail.subcategory_name:
             payload = [{"source_url": sub_url, "name": detail.subcategory_name, "parent_id": cat_id}]
             await asyncio.to_thread(upsert_categories, supabase, payload, logger)
             sub_id = (await asyncio.to_thread(fetch_categories_by_source_urls, supabase, [sub_url])).get(sub_url)
             if sub_id:
                 category_map[sub_url] = sub_id

    if sub_id and detail.subcategory_name:
        first_lang = config.langs[0] if config.langs else "en"
        rows = await asyncio.to_thread(supabase.select, "category_translations", "lang", [("eq", "category_id", sub_id), ("eq", "lang", first_lang)])
        if not rows:
            try:
                trans = await translate_category(groq, detail.subcategory_name, config.langs, logger)
                await asyncio.to_thread(upsert_category_translations, supabase, sub_id, trans.values(), logger)
            except Exception as e:
                logger.warning("Subcategory translation failed: %s", e)

    # 3. Ensure Product
    prod_id = None
    if prod_name:
        prod_url = f"{config.source_base_url}/product/{detail.source_slug}"
        prod_payload = {
            "name": prod_name,
            "source_url": prod_url,
            "description": f"Product: {prod_name}",
            "status": "published",
        }
        prod_id = await asyncio.to_thread(upsert_product, supabase, prod_payload)
        
        if prod_id:
            await asyncio.to_thread(link_product_to_category, supabase, prod_id, sub_id or cat_id, logger)
            
            if detail.product_image_url:
                logger.info("Found product image URL: %s", detail.product_image_url)
                try:
                    p_img_urls = await _process_images_async(
                        http,
                        uploader,
                        config,
                        [detail.product_image_url],
                        prod_id,
                        detail.source_slug,
                        logger,
                        dry_run,
                        prefix="products"
                    )
                    if p_img_urls and not dry_run:
                        await asyncio.to_thread(upsert_product_image, supabase, prod_id, p_img_urls[0], logger)
                except Exception as e:
                    logger.error("Product image processing failed: %s", e)

            if config.langs:
                first_lang = config.langs[0]
                rows = await asyncio.to_thread(
                    supabase.select,
                    "product_translations",
                    "id",
                    [("eq", "product_id", prod_id), ("eq", "lang", first_lang)],
                )
                if not rows:
                    try:
                        translations = await translate_product(
                            groq,
                            prod_name,
                            prod_payload.get("description"),
                            detail.category_name,
                            config.langs,
                            logger,
                        )
                        await asyncio.to_thread(
                            upsert_product_translations,
                            supabase,
                            prod_id,
                            translations.values(),
                            logger,
                        )
                    except Exception as e:
                        logger.warning("Product translation failed: %s", e)

    updates["product_id"] = prod_id
    updates["sub_category_id"] = sub_id or cat_id
    updates["category_id"] = cat_id

    return updates


async def _process_review_item_async(
    item: Dict[str, str],
    http: HttpClient,
    supabase: SupabaseClient,
    groq: GroqClient,
    uploader: Optional[R2Uploader],
    profile_pool: ProfilePool,
    category_map: Dict[str, int],
    config: Config,
    logger: logging.Logger,
    dry_run: bool,
    semaphore: asyncio.Semaphore,
) -> bool:
    async with semaphore:
        source_url = item["source_url"]
        logger.info("Starting processing: %s", source_url)
        await asyncio.to_thread(mark_processing, supabase, source_url)
        async def _skip(reason: str, retries: int = 999) -> bool:
            logger.warning("Skip review: reason=%s source_url=%s", reason, source_url)
            await asyncio.to_thread(mark_failed, supabase, source_url, retries, reason)
            return False
        try:
            html = await _fetch_html_async(http, source_url, logger)
            detail = parse_review_detail(html, source_url, config.source_base_url, logger)
            
            # Deep Dive: If we land on a product overview page (short content), 
            # try to jump into a real deep review.
            if len(detail.content_html) < 500:
                logger.info("Content looks like a summary/teaser (%d chars). Searching for deep review link.", len(detail.content_html))
                deep_links = discover_review_links(html, config.source_base_url, logger)
                # Prioritize links with -n suffix
                real_reviews = [l for l in deep_links if "-n" in l and l != source_url]
                if real_reviews:
                    target_url = real_reviews[0]
                    logger.info("Deep dive: jumping to full review -> %s", target_url)
                    html = await _fetch_html_async(http, target_url, logger)
                    detail = parse_review_detail(html, target_url, config.source_base_url, logger)
                    # We continue using this detail, but keep original source_url 
                    # for database tracking unless we want to update it.
            
            # Content quality validation & AI Fallback
            needs_ai = not detail.content_html or len(detail.content_html) < 100 or not detail.category_name
            
            if needs_ai:
                logger.warning("Content too short, missing, or missing category. Attempting deep AI extraction for %s", source_url)
                soup_text = BeautifulSoup(html, "lxml").get_text(separator="\n", strip=True)
                ai_data = await extract_review_details_ai(groq, soup_text, logger)
                
                if ai_data.get("content_html") and len(ai_data["content_html"]) >= 100:
                    logger.info("Deep AI extraction successful for %s", source_url)
                    detail.content_html = ai_data["content_html"]
                    if not detail.title and ai_data.get("title"):
                        detail.title = ai_data["title"]
                    if not detail.rating and ai_data.get("rating"):
                        detail.rating = ai_data["rating"]
                    
                    # Always take AI pros/cons if they look better or if original is empty
                    if ai_data.get("pros"):
                        detail.pros = ai_data["pros"]
                    if ai_data.get("cons"):
                        detail.cons = ai_data["cons"]
                    
                    if not detail.product_name and ai_data.get("product_name"):
                        detail.product_name = ai_data["product_name"]
                    
                    # Category/Subcategory Fallback
                    if not detail.category_name and ai_data.get("category_name"):
                        detail.category_name = ai_data["category_name"]
                        logger.info("AI inferred category: %s", detail.category_name)
                    if not detail.subcategory_name and ai_data.get("subcategory_name"):
                        detail.subcategory_name = ai_data["subcategory_name"]
                else:
                    if not detail.content_html or len(detail.content_html) < 100:
                        return await _skip("Content too short")

            if not detail.image_urls:
                return await _skip("No review images")
                
            if not detail.product_image_url:
                return await _skip("No product image")
            
            logger.info("Quality check passed: %d chars, %d images, product image OK", 
                       len(detail.content_html), len(detail.image_urls))

            try:
                category_ids = await _ensure_category_ids_async(
                    http,
                    supabase,
                    category_map,
                    detail,
                    config.source_base_url,
                    groq,
                    config,
                    uploader,
                    logger,
                    dry_run,
                )
                cat_id = category_ids.get("category_id")
                if not cat_id:
                    raise ValueError(f"Category ID missing for {detail.category_name}")
            except Exception as e:
                logger.error("Failed to ensure categories/product: %s", e)
                retries = int(item.get("retries") or 0) + 1
                await asyncio.to_thread(mark_failed, supabase, source_url, retries, f"Metadata error: {e}")
                return False

            author_id = profile_pool.pick()

            full_title = detail.title or ""
            if detail.product_name and detail.product_name.lower() not in full_title.lower():
                full_title = f"{detail.product_name} - {full_title}"

            review_payload = {
                "source_url": detail.source_url,
                "source": "irecommend",
                "slug": detail.source_slug,
                "title": full_title,
                "excerpt": detail.excerpt,
                "content_html": detail.content_html,
                "category_id": cat_id,
                "sub_category_id": category_ids.get("sub_category_id") or cat_id,
                "product_id": category_ids.get("product_id"),
                "user_id": author_id,
                "rating_avg": detail.rating or 0,
                "rating_count": detail.rating_count or 0,
                "votes_up": detail.like_up or 0,
                "votes_down": detail.like_down or 0,
                "photo_urls": [],
                "photo_count": 0,
                "pros": detail.pros or [],
                "cons": detail.cons or [],
                "created_at": (detail.published_at or datetime.now(timezone.utc).isoformat()),
                "status": "published",
            }

            review_id = None
            if not dry_run:
                review_id = await asyncio.to_thread(upsert_review, supabase, review_payload)
            
            # Process Images
            if detail.image_urls:
                logger.info("Processing %d images for %s", len(detail.image_urls), source_url)
                photos = await _process_images_async(http, uploader, config, detail.image_urls, review_id, detail.source_slug, logger, dry_run)
                if photos and review_id and not dry_run:
                    await asyncio.to_thread(update_review_photos, supabase, review_id, photos)
                    logger.info("Saved %d photos for review %s", len(photos), review_id)

            # Translate (allow partial failure)
            translation_error = None
            try:
                translations = await translate_review(
                    groq, 
                    detail.title, 
                    detail.content_html, 
                    detail.category_name, 
                    config.langs, 
                    logger,
                    pros_ru=detail.pros,
                    cons_ru=detail.cons
                )
            except Exception as te:
                translation_error = str(te)
                logger.warning("Translation skipped: reason=%s source_url=%s", translation_error, source_url)
                translations = {}
            
            translation_payloads = []
            for lang, data in translations.items():
                base_slug = slugify(data["slug"], max_length=80, fallback=detail.title)
                rich_content = data["content_html"]

                # Inject Pros/Cons in a format the frontend parser understands
                # It expects a section starting with "Pros:" or "Cons:" followed by lines starting with Dash/Bullet
                # and sections separated by double newlines.
                pros_cons_text = ""
                if data.get("pros"):
                    pros_list = "\n".join([f"- {p}" for p in data["pros"]])
                    pros_cons_text += f"<p>Pros:<br>{pros_list}</p>"
                if data.get("cons"):
                    cons_list = "\n".join([f"- {c}" for c in data["cons"]])
                    if pros_cons_text: pros_cons_text += "<br><br>"
                    pros_cons_text += f"<p>Cons:<br>{cons_list}</p>"
                
                if pros_cons_text:
                    rich_content = f'<div class="pros-cons-block">{pros_cons_text}</div>' + rich_content

                if data.get("summary"):
                    rich_content = f'<div class="editor-summary-card"><h3>Editor\'s Summary</h3><p>{data["summary"]}</p></div>' + rich_content
                
                if data.get("faq"):
                    faq_items = "".join([f'<li><strong>{f["question"]}</strong><p>{f["answer"]}</p></li>' for f in data["faq"]])
                    rich_content += f'<div class="faq-card"><h3>Featured FAQ</h3><ul>{faq_items}</ul></div>'
                
                translation_payloads.append({
                    "lang": lang,
                    "title": data["title"],
                    "content_html": clean_html(rich_content),
                    "meta_title": data["meta_title"],
                    "meta_description": data["meta_description"],
                    "slug": base_slug,
                })

            if review_id and not dry_run:
                if translation_payloads:
                    try:
                        await asyncio.to_thread(upsert_review_translations, supabase, review_id, translation_payloads, logger)
                    except Exception as exc:
                        logger.error("Translation upsert failed for %s: %s", source_url, exc)
                elif not translation_error:
                    logger.warning("Translation empty for %s", source_url)
                content_hash = sha1_text(f"{detail.title}|{detail.content_html}")
                await asyncio.to_thread(mark_processed, supabase, source_url, content_hash)
            
            logger.info("Successfully processed: %s", source_url)
            return True

        except Exception as exc:
            logger.error("Failed processing %s: %s", source_url, exc)
            # If it's a conflict error we already tried to resolve but maybe failed again
            retries = int(item.get("retries") or 0) + 1
            await asyncio.to_thread(mark_failed, supabase, source_url, retries, str(exc))
            return False

async def run_once_async(config: Config, dry_run: bool, run_id: Optional[str] = None) -> None:
    run_id = run_id or uuid.uuid4().hex[:8]
    logger = setup_logging(config.log_file, run_id=run_id)
    http = HttpClient(
        timeout_seconds=config.http_timeout_seconds,
        max_retries=config.http_max_retries,
        user_agent=config.user_agent,
        logger=logger,
        proxy=config.http_proxy,
    )
    
    supabase = SupabaseClient(
        url=config.supabase_url,
        key=config.supabase_service_role_key,
        logger=logger,
        dry_run=dry_run,
    )
    groq = GroqClient(api_key=config.groq_api_key, model=config.groq_model, logger=logger)
    
    uploader = None
    if not dry_run:
        uploader = R2Uploader(
            endpoint=config.r2_endpoint,
            region=config.r2_region,
            access_key_id=config.r2_access_key_id,
            secret_access_key=config.r2_secret_access_key,
            bucket=config.r2_bucket,
            public_base_url=config.r2_public_base_url,
            logger=logger,
        )

    profile_pool = ProfilePool(supabase, config.random_user_pool_size, logger)
    await asyncio.to_thread(profile_pool.load_or_create)

    # Load categories
    rows = await asyncio.to_thread(supabase.select, "categories", "id, source_url")
    category_map = {row["source_url"]: row["id"] for row in rows if row.get("source_url")}

    new_sources = await asyncio.to_thread(fetch_new_sources, supabase, config.max_new_reviews_per_loop)
    
    if len(new_sources) < config.max_new_reviews_per_loop:
        logger.info("Discovering new content (Sync wrapped)...")

        def _sync_discovery_flow():
            # 1. Catalog
            catalog_urls = [f"{config.source_base_url}/catalog", config.source_base_url]
            categories = []
            for curl in catalog_urls:
                try:
                    html = http.get(curl).text
                    found = discover_catalog_categories(html, config.source_base_url, logger)
                    categories.extend(found)
                    if found: break
                except Exception as e:
                    logger.warning("Catalog discovery failed: %s", e)
            
            if not categories:
                return 0

            # Upsert root categories
            root_payload = []
            for c in categories:
                root_payload.append({
                    "source_url": c.get("source_url"),
                    "parent_id": None,
                    "source_key": c.get("source_key"),
                    "name": c.get("name"),
                })
            
            cat_map = upsert_categories(supabase, root_payload, logger)
            
            # 2. Subcategories
            subcategories = discover_subcategories(http, config, categories, logger)
            sub_payload = []
            for sc in subcategories:
                p_url = sc.get("parent_url")
                sub_payload.append({
                    "source_url": sc.get("source_url"),
                    "parent_id": cat_map.get(p_url) if p_url else None,
                    "source_key": sc.get("source_key"),
                    "name": sc.get("name"),
                })
            
            if sub_payload:
                cat_map.update(upsert_categories(supabase, sub_payload, logger))

            # 3. Reviews Discovery (Nested)
            cat_urls = [x.get("source_url") for x in categories + subcategories if x.get("source_url")]
            all_review_urls = set()
            product_urls = set()

            # First pass: Get links from category pages
            for c_url in cat_urls:
                for page_url in build_page_urls(c_url, config.category_pages_to_scan):
                    try:
                        p_html = http.get(page_url).text
                        found_links = discover_review_links(p_html, config.source_base_url, logger)
                        for link in found_links:
                            if "-n" in link:
                                all_review_urls.add(link)
                            else:
                                product_urls.add(link)
                    except Exception as e:
                        logger.warning("Page scan failed %s: %s", page_url, e)

            # Second pass: Visit product pages to find deep review links
            logger.info("Deep discovery: Scanning %d product pages for reviews...", len(product_urls))
            # Limit to a reasonable number to avoid infinite scan
            for p_idx, p_url in enumerate(list(product_urls)[:50]): 
                try:
                    p_html = http.get(p_url).text
                    deep_links = discover_review_links(p_html, config.source_base_url, logger)
                    for d_link in deep_links:
                        if "-n" in d_link:
                            all_review_urls.add(d_link)
                    if p_idx % 10 == 0:
                        logger.info("Deep scan progress: %d/%d", p_idx, len(product_urls))
                except Exception as e:
                    logger.warning("Deep scan failed for %s: %s", p_url, e)

            unique_reviews = sorted(list(all_review_urls))
            logger.info("Discovery complete. Total unique deep reviews found: %d", len(unique_reviews))
            
            # 4. Upsert sources
            items = []
            for url in unique_reviews:
                 slug = urlparse(url).path.rstrip("/").split("/")[-1]
                 items.append({"source_url": url, "source_slug": slug})
            
            if items:
                upsert_source_map(supabase, items, logger)
            return len(unique_reviews)

        # Run discovery in thread to avoid blocking main loop
        new_count = await asyncio.to_thread(_sync_discovery_flow)
        logger.info("Discovery finished. Found %d new reviews.", new_count)
        
        # Refresh sources
        new_sources = await asyncio.to_thread(fetch_new_sources, supabase, config.max_new_reviews_per_loop)

    logger.info("Items to process: %d", len(new_sources))
    
    # Sequential processing with delays for gentle proxy usage
    successful = 0
    failed = 0
    for idx, item in enumerate(new_sources):
        logger.info("Processing item %d/%d", idx + 1, len(new_sources))
        
        try:
            result = await _process_review_item_async(
                item, http, supabase, groq, uploader, profile_pool, category_map, config, logger, dry_run, asyncio.Semaphore(1)
            )
            if result:
                successful += 1
            else:
                failed += 1
        except Exception as e:
            logger.error("Unexpected error processing item: %s", e)
            failed += 1
        
        # Wait 5 seconds between items to be gentle on proxy
        if idx < len(new_sources) - 1:
            logger.info("Waiting 5 seconds before next item...")
            await asyncio.sleep(5)
    
    logger.info("Processing complete: %d successful, %d failed", successful, failed)


async def main_async() -> None:
    parser = argparse.ArgumentParser(description="iRecommend ingestor (Async)")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    config = Config.from_env()
    if args.once:
        await run_once_async(config, args.dry_run)
    else:
        while True:
            run_id = uuid.uuid4().hex[:8]
            logger = setup_logging(config.log_file, run_id=run_id)
            start = datetime.now(timezone.utc)
            try:
                await run_once_async(config, args.dry_run, run_id=run_id)
            except Exception as e:
                logger.error("Loop error: %s", e)
            elapsed = (datetime.now(timezone.utc) - start).total_seconds()
            wait_for = sleep_jitter(config.loop_min_seconds, config.loop_max_seconds)
            logger.info("Cycle finished in %.1fs, sleeping for %.1fs", elapsed, wait_for)
            await asyncio.sleep(wait_for)


if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main_async())
