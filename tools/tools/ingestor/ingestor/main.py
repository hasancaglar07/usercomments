import os
import asyncio
import logging
import argparse
import random
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import requests

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
from .llm.translate_and_seo import translate_product, translate_review, extract_review_details_ai
from .llm.category_matcher import match_category_ai
from .media.r2_upload import R2Uploader
from .media.image_fetch import fetch_image
from .media.image_process import process_image
from .utils.backoff import sleep_with_backoff
from .utils.hashing import sha1_bytes, sha1_text, short_hash
from .utils.slugify import slugify, contains_cyrillic, transliterate_name
from .utils.text_clean import clean_html, normalize_whitespace
from .utils.timing import sleep_jitter
from .utils.linker import inject_internal_links


async def _fetch_html_async(http: HttpClient, url: str, logger: logging.Logger) -> str:
    # Use thread for cloudscraper sync get
    def _fetch():
        response = http.get(url)
        # Force UTF-8 as irecommend uses it, sometimes apparent_encoding fails or detects differently
        response.encoding = 'utf-8'
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


def _preserve_original_url(existing_desc: Optional[str], new_desc: Optional[str]) -> Optional[str]:
    if not new_desc:
        return existing_desc
    if not existing_desc:
        return new_desc
    marker = "Original URL:"
    if marker in existing_desc and marker not in new_desc:
        suffix = existing_desc.split(marker, 1)[1].strip()
        if suffix:
            return f"{new_desc}\n\n{marker} {suffix}"
        return f"{new_desc}\n\n{marker}"
    return new_desc


def _purge_worker_cache(config: Config, review_id: Optional[str], logger: logging.Logger) -> None:
    if not review_id:
        return
    if not config.cache_purge_url or not config.cache_purge_secret:
        return
    try:
        response = requests.post(
            config.cache_purge_url,
            json={"reviewId": review_id},
            headers={"x-cache-purge-secret": config.cache_purge_secret},
            timeout=10,
        )
    except Exception as exc:
        logger.warning("Cache purge request failed: %s", exc)
        return
    if response.status_code >= 400:
        logger.warning(
            "Cache purge failed (%s): %s", response.status_code, response.text[:200]
        )


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
    semaphore = asyncio.Semaphore(max(1, config.max_concurrent_tasks))
    
    async def _process_one(img_url):
        async with semaphore:
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
    category_name_map: Dict[str, int],
    parent_map: Dict[int, int],
    ai_match_cache: Dict[str, Optional[int]],
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

    # 1. Ensure Category (Strict Match)
    cat_id = None
    if cat_url:
        cat_id = category_map.get(cat_url)

    if not cat_id and detail.category_name:
        norm = detail.category_name.strip().lower()
        cat_id = category_name_map.get(norm)
        
        # AI Match Fallback
        if not cat_id:
            if norm in ai_match_cache:
                cat_id = ai_match_cache[norm]
                if cat_id: logger.info("Category matched by AI CACHE: '%s' -> ID %s", detail.category_name, cat_id)
            elif config.groq_api_key:
                 cat_id = await match_category_ai(groq, detail.category_name, category_name_map, logger)
                 ai_match_cache[norm] = cat_id

        if cat_id:
            logger.info("Category matched: '%s' -> ID %s", detail.category_name, cat_id)
    
    # 2. Ensure Subcategory (Strict Match)
    sub_id = None
    if sub_url:
        sub_id = category_map.get(sub_url)

    if not sub_id and detail.subcategory_name:
        norm = detail.subcategory_name.strip().lower()
        sub_id = category_name_map.get(norm)

        # AI Match Fallback (Sub)
        if not sub_id:
            if norm in ai_match_cache:
                 sub_id = ai_match_cache[norm]
                 if sub_id: logger.info("Subcategory matched by AI CACHE: '%s' -> ID %s", detail.subcategory_name, sub_id)
            elif config.groq_api_key:
                 # Contextual Matching: "Electronics > Accessories"
                 query_name = detail.subcategory_name
                 if detail.category_name:
                     query_name = f"{detail.category_name} > {detail.subcategory_name}"
                     
                 sub_id = await match_category_ai(groq, query_name, category_name_map, logger)
                 ai_match_cache[norm] = sub_id

        if sub_id:
            logger.info("Subcategory matched: '%s' -> ID %s", detail.subcategory_name, sub_id)

    # STRICT CHECK: If no category match, abort immediately.
    # Do NOT create product if we don't know where to put it.
    if not cat_id and not sub_id:
        logger.warning(
            "Category mismatch (Strict Mode). Product creation aborted.\n"
            "  Source Category URL: %s\n"
            "  Source SubCategory URL: %s\n"
            "  Product: %s",
            cat_url, sub_url, prod_name
        )
        return {"category_id": None, "sub_category_id": None, "product_id": None}

    # 3. Ensure Product
    prod_id = None
    if prod_name:
        prod_url = detail.product_source_url
        if not prod_url:
            prod_url = f"{config.source_base_url}/product/{detail.source_slug}"
        
        # CRITICAL: Translate product name to English BEFORE creating product
        # This ensures we never have Cyrillic product names/slugs in the database
        final_prod_name = prod_name
        final_prod_desc = f"Product: {prod_name}"
        
        if contains_cyrillic(prod_name) and config.groq_api_key:
            logger.info("Product name contains Cyrillic, translating to English first: %s", prod_name[:50])
            try:
                # Get English translation before creating the product
                en_translation = await translate_product(
                    groq,
                    prod_name,
                    f"Product: {prod_name}",
                    detail.category_name,
                    ["en"],  # Only English needed here
                    logger,
                )
                if en_translation and en_translation.get("en"):
                    en_data = en_translation["en"]
                    final_prod_name = en_data.get("name") or prod_name
                    final_prod_desc = en_data.get("description") or f"Product: {final_prod_name}"
                    logger.info("Product name translated: %s -> %s", prod_name[:30], final_prod_name[:30])
            except Exception as tr_err:
                logger.warning("Pre-translation failed for product '%s': %s", prod_name[:30], tr_err)
        
        # FALLBACK: If still Cyrillic (translation failed), use transliteration
        if contains_cyrillic(final_prod_name):
            final_prod_name = transliterate_name(final_prod_name)
            final_prod_desc = f"Product: {final_prod_name}"
            logger.info("Transliterated product name: %s", final_prod_name[:50])
            
        prod_payload = {
            "name": final_prod_name,
            "source_url": prod_url,
            "description": final_prod_desc,
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
                # Check which languages are already translated for this product
                existing_translations = await asyncio.to_thread(
                    supabase.select,
                    "product_translations",
                    "lang",
                    [("eq", "product_id", prod_id)],
                )
                existing_langs = {row["lang"] for row in existing_translations}
                missing_langs = [l for l in config.langs if l not in existing_langs]
                
                if missing_langs:
                    logger.info("Missing product translations for: %s. Generating...", missing_langs)
                    try:
                        # Use existing English translation as source if available, otherwise Russian
                        source_name = prod_name
                        source_desc = prod_payload.get("description")
                        
                        # Optimization: If we have an EN translation, use it as pivot source?
                        # For now, we will just use the original Russian source for consistency, 
                        # or rely on translate_product handling. 
                        # translate_product currently takes RU source arguments. 
                        # Ideally we should refactor translate_product to support pivot, but for now 
                        # passing the original data is safer to avoid drift.

                        translations = await translate_product(
                            groq,
                            prod_name,
                            prod_payload.get("description"),
                            detail.category_name,
                            missing_langs,
                            logger,
                        )
                        
                        if translations:
                           await asyncio.to_thread(
                               upsert_product_translations,
                               supabase,
                               prod_id,
                               translations.values(),
                               logger,
                           )
                        
                        # Determine if we need to update the main product record (e.g. if EN was just generated)
                        # We prefer EN for the main slug/name.
                        main_lang_data = translations.get("en")
                        if main_lang_data:
                            existing_desc = None
                            try:
                                rows = await asyncio.to_thread(
                                    supabase.select,
                                    "products",
                                    "description",
                                    [("eq", "id", prod_id)],
                                    None,
                                    1,
                                )
                                if rows:
                                    existing_desc = rows[0].get("description") or ""
                            except Exception as exc:
                                logger.warning("Failed to fetch product description for %s: %s", prod_id, exc)
                            updated_desc = _preserve_original_url(existing_desc, main_lang_data.get("description"))
                            # ROBUST SLUG UPDATE: Retry loop to ensure we kill Cyrillic slugs
                            base_slug = main_lang_data["slug"]
                            for attempt in range(5):
                                target_slug = base_slug
                                if attempt > 0:
                                    target_slug = f"{base_slug}-{short_hash(uuid.uuid4().hex)}"
                                
                                try:
                                    await asyncio.to_thread(
                                        supabase.update,
                                        "products",
                                        {
                                            "name": main_lang_data["name"],
                                            "description": updated_desc,
                                            "slug": target_slug,
                                        },
                                        [("eq", "id", prod_id)]
                                    )
                                    logger.info("Updated main product record to %s (slug: %s)", main_lang_data["lang"], target_slug)
                                    break # Success
                                except Exception as update_err:
                                    msg = str(update_err).lower()
                                    if "duplicate" in msg or "slug" in msg or "23505" in msg:
                                       logger.warning("Main product slug conflict for %s. Retrying with suffix...", target_slug)
                                       continue # Try next attempt with suffix
                                    else:
                                        logger.error("Critical: Failed to update main product: %s", update_err)
                                        # Fallback: Last ditch effort - UPDATE NAME ONLY
                                        try:
                                            await asyncio.to_thread(
                                                supabase.update,
                                                "products",
                                                {
                                                    "name": main_lang_data["name"],
                                                    "description": main_lang_data["description"],
                                                },
                                                [("eq", "id", prod_id)]
                                            )
                                            logger.info("Fallback: Updated main product NAME only.")
                                        except:
                                            pass
                                        break
                                
                    except Exception as e:
                        logger.warning("Product translation failed: %s", e)

    # Hierarchy Correction
    final_cat_id = cat_id
    final_sub_id = sub_id or cat_id

    # If the "category" we found is actually a child (has a parent), fix it.
    if cat_id and cat_id in parent_map:
         final_sub_id = cat_id
         final_cat_id = parent_map[cat_id]
    
    # If explicit sub_id found, ensure cat_id is its parent if possible
    if sub_id and sub_id in parent_map:
         final_cat_id = parent_map[sub_id]

    updates["product_id"] = prod_id
    updates["sub_category_id"] = final_sub_id
    updates["category_id"] = final_cat_id

    return updates


async def _process_review_item_async(
    item: Dict[str, str],
    http: HttpClient,
    supabase: SupabaseClient,
    groq: GroqClient,
    uploader: Optional[R2Uploader],
    profile_pool: ProfilePool,
    category_map: Dict[str, int],
    category_name_map: Dict[str, int],
    parent_map: Dict[int, int],
    ai_match_cache: Dict[str, Optional[int]],
    config: Config,
    logger: logging.Logger,
    dry_run: bool,
    product_map: Dict[str, str],
    semaphore: asyncio.Semaphore,
) -> bool:
    async with semaphore:
        source_url = item["source_url"]
        logger.info("Starting processing: %s", source_url)
        await asyncio.to_thread(mark_processing, supabase, source_url)
        try:
            async def _mark_failed(reason: str) -> None:
                retries = int(item.get("retries") or 0) + 1
                await asyncio.to_thread(mark_failed, supabase, source_url, retries, reason)

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
                        logger.warning(
                            "Content still short after AI fallback (%d chars), continuing: %s",
                            len(detail.content_html or ""),
                            source_url,
                        )
            if detail.content_html:
                detail.excerpt = normalize_whitespace(
                    BeautifulSoup(detail.content_html, "lxml").get_text()
                )[:300]
            else:
                detail.excerpt = detail.excerpt or ""

            if not detail.title:
                detail.title = detail.product_name or detail.source_slug or "Untitled Review"
            if not detail.content_html:
                detail.content_html = f"<p>{detail.title}</p>"

            if not detail.product_image_url and detail.image_urls:
                detail.product_image_url = detail.image_urls[0]
                logger.info("Fallback: using first review image as product image for %s", source_url)

            if not detail.image_urls and detail.product_image_url:
                detail.image_urls = [detail.product_image_url]
                logger.info("Fallback: using product image as review image for %s", source_url)
            
            if not detail.image_urls and config.fallback_review_image_url:
                detail.image_urls = [config.fallback_review_image_url]
                logger.info("Fallback: using default review image for %s", source_url)

            if not detail.product_image_url and config.fallback_review_image_url:
                detail.product_image_url = config.fallback_review_image_url
                logger.info("Fallback: using default product image for %s", source_url)

            if not detail.image_urls:
                logger.warning("No review images for %s; continuing with empty photo list", source_url)
                
            if not detail.product_image_url:
                logger.warning("No product image for %s; continuing without product image", source_url)
            
            # QUALITY GATE
            # 1. Length Check
            content_len = len(detail.content_html or "")
            if content_len < 500:
                logger.warning("Quality Gate Failed: Content too short (%d chars). Skipping %s", content_len, source_url)
                await _mark_failed(f"Quality gate failed: content too short ({content_len} chars)")
                return False

            # 2. Image Check
            if not detail.image_urls and not detail.product_image_url:
                 # Try fallback from config if needed, but if strictly no images found:
                 if not config.fallback_review_image_url:
                     logger.warning("Quality Gate Failed: No images found. Skipping %s", source_url)
                     await _mark_failed("Quality gate failed: no images found")
                     return False
            
            logger.info(
                "Quality check PASSED: %d chars, %d review images, product image %s",
                content_len,
                len(detail.image_urls),
                "ok" if detail.product_image_url else "missing",
            )

            try:
                category_ids = await _ensure_category_ids_async(
                    http,
                    supabase,
                    category_map,
                    category_name_map,
                    parent_map,
                    ai_match_cache,
                    detail,
                    config.source_base_url,
                    groq,
                    config,
                    uploader,
                    logger,
                    dry_run,
                )
            except Exception as e:
                logger.error("Category/product enrichment failed, continuing without it: %s", e)
                category_ids = {"category_id": None, "sub_category_id": None, "product_id": None}

            cat_id = category_ids.get("category_id")
            if not cat_id:
                # Debug log to see why it failed
                cat_url_debug = _normalize_url(config.source_base_url, detail.category_url)
                sub_url_debug = _normalize_url(config.source_base_url, detail.subcategory_url)
                logger.warning(
                    "Missing/Unmatched category. SKIPPING.\n"
                    "  Source URL: %s\n"
                    "  Found Cat URL: %s\n"
                    "  Found Sub URL: %s\n"
                    "  Detail Cat Name: %s\n"
                    "  Detail Sub Name: %s\n"
                    "  Total DB Categories Loaded: %d",
                    source_url, cat_url_debug, sub_url_debug, detail.category_name, detail.subcategory_name, len(category_map)
                )
                await _mark_failed("Category mismatch: missing or unmatched category")
                return False

            try:
                author_id = profile_pool.pick(category_name=detail.category_name)
            except Exception as exc:
                logger.error("Profile pool unavailable, continuing without author: %s", exc)
                author_id = None

            full_title = detail.title or ""
            if detail.product_name and detail.product_name.lower() not in full_title.lower():
                full_title = f"{detail.product_name} - {full_title}"

            existing_created_at = None
            try:
                existing_rows = await asyncio.to_thread(
                    supabase.select,
                    "reviews",
                    "id, created_at",
                    [("eq", "source_url", detail.source_url)],
                    None,
                    1,
                )
                if existing_rows:
                    existing_created_at = existing_rows[0].get("created_at")
            except Exception as exc:
                logger.warning("Failed to check existing review timestamps: %s", exc)

            if existing_created_at:
                created_at = existing_created_at
            elif config.use_source_published_at and detail.published_at:
                created_at = detail.published_at
            else:
                created_at = datetime.now(timezone.utc).isoformat()

            review_payload = {
                "source_url": detail.source_url,
                "source_slug": detail.source_slug,
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
                "created_at": created_at,
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

            required_langs = config.langs or ["en"]
            missing_langs = [lang for lang in required_langs if lang not in translations]
            if missing_langs:
                fallback_title = detail.title or detail.product_name or detail.source_slug or "Untitled Review"
                fallback_excerpt = detail.excerpt or fallback_title
                fallback_content = detail.content_html or f"<p>{fallback_title}</p>"
                for lang in missing_langs:
                    translations[lang] = {
                        "title": fallback_title,
                        "content_html": fallback_content,
                        "meta_title": fallback_title[:60],
                        "meta_description": fallback_excerpt[:160],
                        "slug": slugify(fallback_title, max_length=80, fallback=fallback_title),
                        "summary": "",
                        "faq": [],
                        "pros": detail.pros or [],
                        "cons": detail.cons or [],
                    }
                logger.warning("Fallback translations created for %s", ", ".join(missing_langs))
            
            translation_payloads = []
            for lang, data in translations.items():
                base_slug = slugify(data["slug"], max_length=80, fallback=detail.title)
                
                # We no longer inject Pros/Cons/FAQ/Specs into HTML.
                # The frontend now renders these from structured fields in the DB.
                # This prevents "broken text" issues and allows for clean, localized UI components.
                
                raw_content = data["content_html"]
                
                translation_payloads.append({
                    "lang": lang,
                    "title": data["title"],
                    "content_html": clean_html(inject_internal_links(raw_content, product_map)),
                    "meta_title": data["meta_title"],
                    "meta_description": data["meta_description"],
                    "slug": base_slug,
                    "summary": data.get("summary"),
                    "faq": data.get("faq"),
                    "specs": data.get("specs"),
                    "pros": data.get("pros"),
                    "cons": data.get("cons"),
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
                await asyncio.to_thread(_purge_worker_cache, config, review_id, logger)
            
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
    groq = GroqClient(api_key=config.groq_api_key, model=config.groq_model, logger=logger, vision_model=config.groq_vision_model)
    
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

    # Check daily limit
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    try:
        daily_rows = await asyncio.to_thread(
            supabase.select, 
            "reviews", 
            "id", 
            [("gte", "created_at", today_start)]
        )
        daily_count = len(daily_rows)
        if daily_count >= config.daily_review_limit:
            logger.warning("Daily limit reached (%d/%d). Sleeping...", daily_count, config.daily_review_limit)
            return
        logger.info("Daily count: %d/%d", daily_count, config.daily_review_limit)
    except Exception as e:
        logger.error("Failed to check daily limit: %s", e)
        # We might want to continue or return. Let's continue but be cautious? 
        # User said "spam vermemesi için", so better safe than sorry?
        # But if DB check fails, maybe we shouldn't block everything. 
        # I'll continue for now.

    # Load categories
    rows = await asyncio.to_thread(supabase.select, "categories", "id, source_url, name, parent_id")
    category_map = {}
    category_name_map = {}
    parent_map = {} # ID -> Parent ID
    
    for row in rows:
        raw_url = row.get("source_url")
        cat_id = row["id"]
        name = row.get("name")
        parent_id = row.get("parent_id")
        
        if parent_id:
            parent_map[cat_id] = parent_id
        
        if raw_url:
            norm_url = _normalize_url(config.source_base_url, raw_url)
            if norm_url:
                category_map[norm_url] = cat_id
        
        if name:
            # Normalize name for better matching (lowercase, stripped)
            norm_name = name.strip().lower()
            category_name_map[norm_name] = cat_id
    
    logger.info("Loaded categories: %d URL, %d Name, %d Hierarchy Links", len(category_map), len(category_name_map), len(parent_map))

    # Load products for internal linking
    try:
        product_rows = await asyncio.to_thread(
            supabase.select, 
            "products", 
            "name, slug", 
            order=("created_at", "desc"), 
            limit=2000
        )
        product_map = {
            row["name"].strip().lower(): row["slug"]
            for row in product_rows
            if row.get("name") and row.get("slug")
        }
        logger.info("Loaded %d products for internal linking", len(product_map))
    except Exception as e:
        logger.warning("Failed to load products for internal linking: %s", e)
        product_map = {}

    # DIVERSITY UPDATE: Fetch larger pool to allow for shuffling/mixing
    # We ask for 5x the needed amount (or 100 minimum) to get a good mix of categories
    fetch_limit = max(100, config.max_new_reviews_per_loop * 5)
    
    raw_sources = await asyncio.to_thread(
        fetch_new_sources,
        supabase,
        fetch_limit,
        config.retry_failed_sources,
        config.max_source_retries,
    )
    
    # Smart Shuffle Logic
    # Group by 'category_signature' (derived from URL path segments)
    # e.g. /content/food/baby-food/nestle -> category_signature: "food/baby-food"
    grouped_sources = {}
    for item in raw_sources:
        url = item.get("source_url", "")
        # Extract a simplified signature from the URL path
        try:
            path_parts = urlparse(url).path.strip("/").split("/")
            # Attempt to use first 1-2 distinctive path segments as group key
            # Standard structure often: /content/[category]/[subcategory]/[product]
            if len(path_parts) >= 2:
                sig = "/".join(path_parts[:2])
            else:
                sig = "misc"
        except:
            sig = "misc"
            
        if sig not in grouped_sources:
            grouped_sources[sig] = []
        grouped_sources[sig].append(item)
    
    # Interleave sources (Round-Robin)
    new_sources = []
    keys = list(grouped_sources.keys())
    random.shuffle(keys) # Randomize starting category
    
    max_len = max([len(v) for v in grouped_sources.values()]) if grouped_sources else 0
    
    for i in range(max_len):
        for key in keys:
            if i < len(grouped_sources[key]):
                new_sources.append(grouped_sources[key][i])
                
    # Now trim to the actual limit we want to process
    remaining_daily = config.daily_review_limit - daily_count
    if remaining_daily <= 0:
        logger.info("Daily limit reached (checked again).")
        return

    # Cap new sources
    if len(new_sources) > remaining_daily:
        new_sources = new_sources[:remaining_daily]
    
    # Further cap by loop limit
    if len(new_sources) > config.max_new_reviews_per_loop:
        new_sources = new_sources[:config.max_new_reviews_per_loop]
    
    logger.info("Diversity Mix: Selected %d sources from %d raw candidates across %d categories", len(new_sources), len(raw_sources), len(grouped_sources))
    
    if len(new_sources) < config.max_new_reviews_per_loop:
        logger.info("Discovering new content from detailed scan of EXISTING categories...")

        def _sync_discovery_flow():
            # Prioritize top-level categories for broader variety as requested
            top_cat_urls = [u for u, cid in category_map.items() if cid not in parent_map]
            sub_cat_urls = [u for u, cid in category_map.items() if cid in parent_map]
            
            random.shuffle(top_cat_urls)
            random.shuffle(sub_cat_urls)
            
            # Select 3 top categories and 2 subcategories for good mix
            targets = top_cat_urls[:3] + sub_cat_urls[:2]
            random.shuffle(targets)
            
            # Using a list of lists to interleave URLs from different categories
            links_by_category: List[List[str]] = []
            product_urls = set()

            logger.info("Scanning %d selected categories (Top+Sub) for varied content...", len(targets))
            for idx, c_url in enumerate(targets):
                # Limit already applied by slicing targets
                
                cat_links = set()
                
                # Hybrid Discovery:
                # 1. Scan standard pages (Relevance/Popular)
                page_urls_popular = build_page_urls(c_url, config.category_pages_to_scan, sort_new=False)
                # 2. Scan fresh pages (Newest)
                page_urls_fresh = build_page_urls(c_url, 1, sort_new=True) # Scan 1st page of 'new' only
                
                # Combine unique URLs
                page_urls = list(dict.fromkeys(page_urls_popular + page_urls_fresh))
                
                for p_idx, page_url in enumerate(page_urls):
                    try:
                        logger.info("Scanning category %d/%d: %s (Page %d/%d) %s", 
                                    idx + 1, len(targets), c_url, p_idx + 1, len(page_urls), 
                                    "[Fresh]" if "new=1" in page_url else "[Popular]")
                        p_html = http.get(page_url).text
                        found_links = discover_review_links(p_html, config.source_base_url, logger)
                        for link in found_links:
                            if "-n" in link:
                                cat_links.add(link)
                            else:
                                product_urls.add(link)
                        # Gentle delay between pages to avoid bot detection
                        time.sleep(random.uniform(2, 4))
                    except Exception as e:
                        logger.warning("Page scan failed %s: %s", page_url, e)
                        time.sleep(random.uniform(5, 10))  # Extra delay on error
                
                if cat_links:
                    links_by_category.append(list(cat_links))
                
                # Delay between categories to be gentle
                time.sleep(random.uniform(3, 6))

            # Interleave the cat_links to ensure variety in source_map ordering
            interleaved_reviews = []
            max_links = max([len(l) for l in links_by_category]) if links_by_category else 0
            for i in range(max_links):
                for cat_list in links_by_category:
                    if i < len(cat_list):
                        interleaved_reviews.append(cat_list[i])

            # Also deep scan some products across varied categories (limited to avoid bot detection)
            if product_urls:
                deep_scan_limit = 8  # Reduced from 20 to avoid Cloudflare 521
                logger.info("Deep discovery: Scanning up to %d product pages for missing reviews...", deep_scan_limit)
                p_list = list(product_urls)
                random.shuffle(p_list)
                for p_idx, p_url in enumerate(p_list[:deep_scan_limit]):
                    try:
                        p_html = http.get(p_url).text
                        deep_links = discover_review_links(p_html, config.source_base_url, logger)
                        for d_link in deep_links:
                            if "-n" in d_link and d_link not in interleaved_reviews:
                                interleaved_reviews.append(d_link)
                        logger.info("Deep scan progress: %d/%d", p_idx + 1, deep_scan_limit)
                        # Gentle delay between product pages
                        time.sleep(random.uniform(3, 6))
                    except Exception as e:
                        logger.warning("Deep scan failed for %s: %s", p_url, e)
                        time.sleep(random.uniform(8, 15))  # Longer delay on error

            logger.info("Discovery complete. Total unique reviews found (interleaved): %d", len(interleaved_reviews))
            
            # Upsert sources
            items = []
            for url in interleaved_reviews:
                 slug = urlparse(url).path.rstrip("/").split("/")[-1]
                 items.append({"source_url": url, "source_slug": slug})
            
            if items:
                upsert_source_map(supabase, items, logger)
            return len(interleaved_reviews)

        # Run discovery in thread to avoid blocking main loop
        new_count = await asyncio.to_thread(_sync_discovery_flow)
        logger.info("Discovery finished. Found %d new reviews.", new_count)
        
        # Refresh sources
        new_sources = await asyncio.to_thread(
            fetch_new_sources,
            supabase,
            config.max_new_reviews_per_loop,
            config.retry_failed_sources,
            config.max_source_retries,
        )
        if len(new_sources) > remaining_daily:
            new_sources = new_sources[:remaining_daily]

    logger.info("Items to process: %d", len(new_sources))
    
    # Sequential processing with delays for gentle proxy usage
    successful = 0
    failed = 0
    
    # Initialize AI Match Cache for this run
    ai_match_cache: Dict[str, Optional[int]] = {}
    semaphore = asyncio.Semaphore(1)

    for idx, item in enumerate(new_sources):
        logger.info("Processing item %d/%d", idx + 1, len(new_sources))
        
        try:
            result = await _process_review_item_async(
                item, http, supabase, groq, uploader, profile_pool, category_map, category_name_map, parent_map, ai_match_cache, config, logger, dry_run, product_map, semaphore
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
            min_wait = max(0.0, config.loop_min_seconds - elapsed)
            max_wait = max(0.0, config.loop_max_seconds - elapsed)
            wait_for = sleep_jitter(min_wait, max_wait)
            logger.info("Cycle finished in %.1fs, sleeping for %.1fs", elapsed, wait_for)
            await asyncio.sleep(wait_for)


if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main_async())
