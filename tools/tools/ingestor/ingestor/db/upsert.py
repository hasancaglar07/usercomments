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
            "summary": translation.get("summary"),
            "faq": translation.get("faq"),
            "specs": translation.get("specs"),
            "pros": translation.get("pros"),
            "cons": translation.get("cons"),
        }
        
        # Suffix slug with review identifier to ensure uniqueness across the board
        original_slug = payload["slug"]
        for attempt in range(10):
            try:
                supabase.upsert(
                    "review_translations",
                    [payload],
                    on_conflict="review_id,lang",
                )
                break
            except Exception as exc:
                msg = str(exc).lower()
                if "duplicate" in msg or "slug" in msg or "23505" in msg:
                    # Append a unique hash based on review_id, lang, and attempt
                    # Adding a larger chunk of review_id to ensure global uniqueness
                    entropy = f"{review_id}-{translation['lang']}-{attempt}-{original_slug}"
                    suffix = short_hash(entropy)
                    payload["slug"] = f"{original_slug}-{suffix}"
                    logger.warning("Slug conflict for %s (attempt %d/10), retrying with %s", 
                                   translation["lang"], attempt + 1, payload["slug"])
                else:
                    raise
        else:
            raise RuntimeError(f"Failed to upsert review translation after retries (lang={translation['lang']})")

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
        original_slug = payload["slug"]
        for attempt in range(10):
            try:
                supabase.upsert(
                    "category_translations",
                    [payload],
                    on_conflict="category_id,lang",
                )
                break
            except Exception as exc:
                msg = str(exc).lower()
                if "duplicate" in msg or "slug" in msg or "23505" in msg:
                    # Append unique hash for category lang unique slug
                    entropy = f"cat-{category_id}-{translation['lang']}-{attempt}-{original_slug}"
                    suffix = short_hash(entropy)
                    payload["slug"] = f"{original_slug}-{suffix}"
                    logger.warning("Category slug conflict for %s (attempt %d/10), retrying with %s", 
                                   translation["lang"], attempt + 1, payload["slug"])
                else:
                    raise
        else:
            raise RuntimeError(f"Failed to upsert category translation after retries (lang={translation['lang']})")

def upsert_product(
    supabase: SupabaseClient,
    payload: Dict[str, Any],
) -> str:
    # Check if product exists by source_url (column or legacy description marker) or slug
    name = payload.get("name", "Unknown Product")
    source_url = payload.get("source_url")
    base_slug = slugify(name) or f"product-{short_hash(source_url or name)}"

    def _is_missing_column(exc: Exception, column: str) -> bool:
        message = str(exc).lower()
        return column.lower() in message and "does not exist" in message

    use_source_url_column = True
    if source_url:
        try:
            rows = supabase.select(
                "products",
                columns="id",
                filters=[("eq", "source_url", source_url)],
                limit=1,
            )
            if rows:
                return rows[0]["id"]
        except Exception as exc:
            if _is_missing_column(exc, "source_url"):
                use_source_url_column = False

        try:
            rows = supabase.select(
                "products",
                columns="id",
                filters=[("ilike", "description", f"%{source_url}%")],
                limit=1,
            )
            if rows:
                if use_source_url_column:
                    try:
                        supabase.update(
                            "products",
                            {"source_url": source_url},
                            filters=[("eq", "id", rows[0]["id"])],
                        )
                    except Exception:
                        pass
                return rows[0]["id"]
        except Exception:
            pass

    # 2. Try to find existing product by Slug
    rows = supabase.select("products", columns="id", filters=[("eq", "slug", base_slug)], limit=1)
    if rows:
        return rows[0]["id"]

    # 3. Fallback: Try match by Name (Exact Name Match)
    rows_name = supabase.select("products", columns="id", filters=[("eq", "name", name)], limit=1)
    if rows_name:
        return rows_name[0]["id"]
    
    # 4. Insert new product
    base_desc = payload.get("description") or f"Product: {name}"
    if source_url and not use_source_url_column:
        full_desc = f"{base_desc}\n\nOriginal URL: {source_url}"
    else:
        full_desc = base_desc

    product_payload = {
        "slug": base_slug,
        "name": name,
        "description": full_desc,
        "status": payload.get("status", "published"),
    }
    if source_url and use_source_url_column:
        product_payload["source_url"] = source_url
    
    try:
        supabase.upsert("products", [product_payload], on_conflict="slug")
    except Exception as e:
        handled = False
        if source_url and use_source_url_column and _is_missing_column(e, "source_url"):
            product_payload.pop("source_url", None)
            supabase.upsert("products", [product_payload], on_conflict="slug")
            use_source_url_column = False
            handled = True
        if not handled:
            # Retry with hashed slug if conflict
            if source_url:
                product_payload["slug"] = f"{base_slug}-{short_hash(source_url)}"
                supabase.upsert("products", [product_payload], on_conflict="slug")
            else:
                raise e
    
    # Fetch back ID
    # Use strict match first if we just inserted with URL
    if source_url and use_source_url_column:
        try:
            rows = supabase.select(
                "products",
                columns="id",
                filters=[("eq", "source_url", source_url)],
                limit=1,
            )
            if rows:
                return rows[0]["id"]
        except Exception:
            pass
    if source_url and not use_source_url_column:
        rows = supabase.select("products", columns="id", filters=[("ilike", "description", f"%{source_url}%")], limit=1)
        if rows:
            return rows[0]["id"]

    rows = supabase.select("products", columns="id", filters=[("eq", "name", name)], limit=1)
    if rows:
        return rows[0]["id"]

    # Iterate to find what we just inserted if slug was modified
    rows = supabase.select("products", columns="id", order=("created_at", "desc"), limit=1)
    if rows and rows[0]["name"] == name: # Sanity check
         return rows[0]["id"]

    raise RuntimeError(f"Failed to upsert product: {name}")

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
        original_slug = payload["slug"]
        for attempt in range(10):
            try:
                supabase.upsert("product_translations", [payload], on_conflict="product_id,lang")
                break
            except Exception as exc:
                msg = str(exc).lower()
                if "duplicate" in msg or "slug" in msg or "23505" in msg:
                    # Append unique hash for product lang unique slug
                    entropy = f"prod-{product_id}-{translation['lang']}-{attempt}-{original_slug}"
                    suffix = short_hash(entropy)
                    payload["slug"] = f"{original_slug}-{suffix}"
                    logger.warning("Product slug conflict for %s (attempt %d/10), retrying with %s", 
                                   translation["lang"], attempt + 1, payload["slug"])
                else:
                    raise
        else:
            raise RuntimeError(f"Failed to upsert product translation after retries (lang={translation['lang']})")

def upsert_product_image(
    supabase: SupabaseClient,
    product_id: str,
    image_url: str,
    logger: logging.Logger,
) -> None:
    # Check if already exists
    rows = supabase.select("product_images", columns="id", filters=[("eq", "product_id", product_id), ("eq", "url", image_url)])
    if rows:
        return
        
    payload = {
        "product_id": product_id,
        "url": image_url,
        "sort_order": 0,
    }
    try:
        supabase.insert("product_images", [payload])
    except Exception as e:
        logger.error("Failed to insert product image for %s: %s", product_id, e)

def link_product_to_category(
    supabase: SupabaseClient,
    product_id: str,
    category_id: Optional[int],
    logger: logging.Logger,
) -> None:
    if category_id is None:
        logger.warning("Skip product-category link: missing category_id for product %s", product_id)
        return
    payload = {
        "product_id": product_id,
        "category_id": category_id,
    }
    try:
        supabase.upsert("product_categories", [payload], on_conflict="product_id,category_id")
    except Exception as e:
        logger.error("Failed to link product %s to category %s: %s", product_id, category_id, e)
