import logging
from typing import Any, Dict, Iterable, List, Optional

from ..utils.hashing import short_hash
from ..utils.slugify import slugify
from .supabase_client import SupabaseClient


def fetch_categories_by_source_urls(
    supabase: SupabaseClient, source_urls: List[str]
) -> Dict[str, Any]:
    if not source_urls:
        return {}
    rows = supabase.select(
        "categories",
        columns="id, source_url",
        filters=[("in", "source_url", source_urls)],
    )
    return {row["source_url"]: row["id"] for row in rows}


def upsert_categories(
    supabase: SupabaseClient,
    categories: Iterable[Dict[str, Any]],
    logger: logging.Logger,
) -> Dict[str, Any]:
    unique_payload = {}
    source_urls = []
    for category in categories:
        url = category.get("source_url")
        if not url:
            continue
        unique_payload[url] = {
            "source_url": url,
            "parent_id": category.get("parent_id"),
            "source_key": category.get("source_key"),
            "name": category.get("name"),
        }
        source_urls.append(url)

    if unique_payload:
        payload = list(unique_payload.values())
        supabase.upsert("categories", payload, on_conflict="source_url")
        logger.info("Categories upserted: %s", len(payload))


    return fetch_categories_by_source_urls(supabase, source_urls)


def upsert_review(
    supabase: SupabaseClient,
    payload: Dict[str, Any],
) -> str:
    supabase.upsert("reviews", [payload], on_conflict="source_url")
    rows = supabase.select(
        "reviews",
        columns="id",
        filters=[("eq", "source_url", payload["source_url"])],
        limit=1,
    )
    if not rows:
        raise RuntimeError("Failed to fetch review after upsert")
    return rows[0]["id"]


def update_review_photos(
    supabase: SupabaseClient,
    review_id: str,
    photos: List[str],
) -> None:
    supabase.update(
        "reviews",
        {
            "photo_urls": photos,
            "photo_count": len(photos)
        },
        filters=[("eq", "id", review_id)],
    )



def upsert_review_translations(
    supabase: SupabaseClient,
    review_id: str,
    translations: Iterable[Dict[str, Any]],
    logger: logging.Logger,
) -> None:
    for translation in translations:
        payload = {
            "review_id": review_id,
            "lang": translation["lang"],
            "title": translation["title"],
            "content_html": translation["content_html"],
            "slug": translation["slug"],
            "meta_title": translation["meta_title"],
            "meta_description": translation["meta_description"],
            "excerpt": translation.get("meta_description", "")[:200], # Fallback excerpt
        }
        try:
            supabase.upsert(
                "review_translations",
                [payload],
                on_conflict="review_id,lang",
            )
        except RuntimeError as exc:
            msg = str(exc)
            if "review_translations_lang_slug_key" in msg or "duplicate key value" in msg:
                suffix = short_hash(payload["slug"] + review_id)
                payload["slug"] = f"{payload['slug']}-{suffix}"
                supabase.upsert(
                    "review_translations",
                    [payload],
                    on_conflict="review_id,lang",
                )
                logger.warning("Slug conflict resolved for %s", payload["lang"])
            else:
                raise

def upsert_category_translations(
    supabase: SupabaseClient,
    category_id: int,
    translations: Iterable[Dict[str, Any]],
    logger: logging.Logger,
) -> None:
    for translation in translations:
        payload = {
            "category_id": category_id,
            "lang": translation["lang"],
            "name": translation["name"],
            "slug": translation["slug"],
        }
        try:
            supabase.upsert(
                "category_translations",
                [payload],
                on_conflict="category_id,lang",
            )
        except RuntimeError as exc:
            msg = str(exc)
            if "category_translations_lang_slug_key" in msg or "duplicate key value" in msg:
                suffix = short_hash(payload["slug"] + str(category_id))
                payload["slug"] = f"{payload['slug']}-{suffix}"
                supabase.upsert(
                    "category_translations",
                    [payload],
                    on_conflict="category_id,lang",
                )
                logger.warning("Category slug conflict resolved for %s", payload["lang"])
            else:
                raise

def upsert_product(
    supabase: SupabaseClient,
    payload: Dict[str, Any],
) -> str:
    # Check if product exists by source_url (virtual) or slug
    name = payload.get("name", "Unknown Product")
    source_url = payload.get("source_url")
    base_slug = slugify(name) or f"product-{short_hash(source_url or name)}"
    
    # Try to find existing product
    filters = [("eq", "slug", base_slug)]
        
    rows = supabase.select("products", columns="id", filters=filters, limit=1)
    if rows:
        return rows[0]["id"]
    
    # Insert new product
    product_payload = {
        "slug": base_slug,
        "name": name,
        "description": payload.get("description"),
        "status": payload.get("status", "pending"),
    }
    supabase.upsert("products", [product_payload], on_conflict="slug")
    
    rows = supabase.select("products", columns="id", filters=[("eq", "slug", base_slug)], limit=1)
    return rows[0]["id"]

def upsert_product_translations(
    supabase: SupabaseClient,
    product_id: str,
    translations: Iterable[Dict[str, Any]],
    logger: logging.Logger,
) -> None:
    for translation in translations:
        name = translation.get("name") or "Unknown Product"
        payload = {
            "product_id": product_id,
            "lang": translation["lang"],
            "slug": translation.get("slug") or slugify(name),
            "name": name,
            "description": translation.get("description"),
            "meta_title": translation.get("meta_title"),
            "meta_description": translation.get("meta_description"),
        }
        try:
            supabase.upsert("product_translations", [payload], on_conflict="product_id,lang")
        except RuntimeError as exc:
            msg = str(exc)
            if "product_translations_slug_key" in msg or "duplicate key value" in msg:
                suffix = short_hash(payload["slug"] + str(product_id))
                payload["slug"] = f"{payload['slug']}-{suffix}"
                supabase.upsert("product_translations", [payload], on_conflict="product_id,lang")
                logger.warning("Product slug conflict resolved for %s", payload["lang"])
            else:
                raise

def upsert_product_image(
    supabase: SupabaseClient,
    product_id: str,
    image_url: str,
    logger: logging.Logger,
) -> None:
    payload = {
        "product_id": product_id,
        "url": image_url,
        "sort_order": 0,
    }
    try:
        supabase.upsert("product_images", [payload], on_conflict="product_id,url")
    except Exception as e:
        logger.error("Failed to upsert product image for %s: %s", product_id, e)

def link_product_to_category(
    supabase: SupabaseClient,
    product_id: str,
    category_id: int,
    logger: logging.Logger,
) -> None:
    payload = {
        "product_id": product_id,
        "category_id": category_id,
    }
    try:
        supabase.upsert("product_categories", [payload], on_conflict="product_id,category_id")
    except Exception as e:
        logger.error("Failed to link product %s to category %s: %s", product_id, category_id, e)
