import argparse
import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set
from urllib.parse import urlparse

import httpx

from dotenv import load_dotenv

from ingestor.crawl.review_detail_parser import extract_product_name
from ingestor.db.supabase_client import SupabaseClient
from ingestor.db.upsert import upsert_product_translations
from ingestor.llm.groq_client import GroqClient
from ingestor.llm.translate_and_seo import translate_product
from ingestor.utils.hashing import short_hash
from ingestor.utils.slugify import (
    contains_cyrillic,
    latinize_text,
    looks_like_transliterated_russian,
    slugify,
)
from ingestor.utils.text_clean import normalize_whitespace


PAGE_SIZE = 500
PROCESSED_TRACKING_FILE = Path(__file__).parent / "backfill_processed.json"


def _load_processed_products() -> Dict[str, str]:
    """Load previously processed products from tracking file."""
    if not PROCESSED_TRACKING_FILE.exists():
        return {}
    try:
        with open(PROCESSED_TRACKING_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_processed_product(product_id: str, status: str = "ok") -> None:
    """Save a processed product to tracking file."""
    processed = _load_processed_products()
    processed[product_id] = f"{status}|{datetime.now(timezone.utc).isoformat()}"
    try:
        with open(PROCESSED_TRACKING_FILE, "w", encoding="utf-8") as f:
            json.dump(processed, f, indent=2)
    except Exception:
        pass


def _is_already_processed(product_id: str) -> bool:
    """Check if product was already processed."""
    processed = _load_processed_products()
    return product_id in processed

REVIEW_NAME_SUFFIXES = {
    "en": "Reviews",
    "tr": "Yorumlar",
    "de": "Test",
    "es": "Opiniones",
    "fr": "Avis",
    "it": "Opinioni",
    "pt": "Avalia\u00e7\u00f5es",
    "nl": "Review",
}

REVIEW_SLUG_SUFFIXES = {
    "en": "reviews",
    "tr": "yorumlar",
    "de": "test",
    "es": "opiniones",
    "fr": "avis",
    "it": "opinioni",
    "pt": "avaliacao",
    "nl": "review",
}

REVIEW_SLUG_KEYWORDS = {
    "en": ["review", "reviews"],
    "tr": ["yorum", "yorumlar", "yorumlari"],
    "de": ["test", "tests"],
    "es": ["opinion", "opiniones", "resena", "resenas"],
    "fr": ["avis", "revue", "critiques"],
    "it": ["opinione", "opinioni", "recensione", "recensioni"],
    "pt": ["avaliacao", "avaliacoes", "review"],
    "nl": ["review", "reviews"],
}

REVIEW_KEYWORDS_ALL = sorted({kw for items in REVIEW_SLUG_KEYWORDS.values() for kw in items})

PLACEHOLDER_NAME_RE = re.compile(r"^Product(?: Reviews)? [a-f0-9]{8}(?:\s+\w+)*$", re.IGNORECASE)
PLACEHOLDER_SLUG_RE = re.compile(r"^product(?:-reviews)?-[a-f0-9]{8}(?:-[a-z0-9]+)*$", re.IGNORECASE)
_HANDLE_RE = re.compile(r"^[\\w]{4,}$", re.UNICODE)

GENERIC_SOURCE_TOKENS = {
    "review",
    "reviews",
    "rating",
    "ratings",
    "test",
    "tests",
    "opiniones",
    "opinion",
    "avis",
    "revue",
    "opinioni",
    "opinione",
    "avaliacao",
    "avaliacoes",
    "product",
    "service",
    "company",
}


def _load_langs() -> List[str]:
    langs_raw = os.getenv("LANGS", "en,tr,de,es")
    langs = [lang.strip().lower() for lang in langs_raw.split(",") if lang.strip()]
    if "en" not in langs:
        langs.insert(0, "en")
    seen: Set[str] = set()
    langs = [lang for lang in langs if not (lang in seen or seen.add(lang))]
    return [lang for lang in langs if lang != "ar"]


def _row_has_cyrillic(row: Dict[str, Optional[str]], keys: Iterable[str]) -> bool:
    for key in keys:
        value = row.get(key) or ""
        if contains_cyrillic(str(value)) or looks_like_transliterated_russian(str(value)):
            return True
    return False


def _product_slug_from_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    slug = urlparse(url).path.rstrip("/").split("/")[-1]
    if not slug:
        return None
    slug = re.sub(r"-n\d+$", "", slug)
    return slug or None


def _source_slug_tokens(slug: str) -> List[str]:
    tokens: List[str] = []
    for part in (slug or "").split("-"):
        part = part.strip().lower()
        if not part:
            continue
        if part in GENERIC_SOURCE_TOKENS:
            continue
        if len(part) < 3 and not any(ch.isdigit() for ch in part):
            continue
        tokens.append(part)
    return tokens


def _translation_mismatch_with_source_slug(
    source_slug: Optional[str],
    name: Optional[str],
    slug: Optional[str],
) -> bool:
    if not source_slug or not name:
        return False
    if looks_like_transliterated_russian(source_slug.replace("-", " ")):
        return False
    tokens = _source_slug_tokens(source_slug)
    if not tokens:
        return False
    haystack = latinize_text(f"{name} {slug or ''}").lower()
    if not haystack:
        return True
    if any(ch.isdigit() for ch in source_slug) and not any(ch.isdigit() for ch in haystack):
        return True
    return not any(token in haystack for token in tokens)


def _looks_like_handle(name: Optional[str]) -> bool:
    if not name:
        return False
    normalized = normalize_whitespace(str(name))
    if not normalized:
        return False
    if any(sep in normalized for sep in (" ", "-", "_")):
        return "_" in normalized
    if normalized.lower() != normalized:
        return False
    if not _HANDLE_RE.match(normalized):
        return False
    return normalized.isascii()


def _truncate_text(value: Optional[str], limit: int = 80) -> str:
    text = normalize_whitespace(str(value or ""))
    if len(text) <= limit:
        return text
    return f"{text[: max(0, limit - 3)]}..."


def _format_change(key: str, before: Optional[str], after: Optional[str]) -> Optional[str]:
    before_text = normalize_whitespace(str(before or ""))
    after_text = normalize_whitespace(str(after or ""))
    if before_text == after_text:
        return None
    if key == "description":
        return f"description_len: {len(before_text)} -> {len(after_text)}"
    return f"{key}: '{_truncate_text(before_text)}' -> '{_truncate_text(after_text)}'"


def _log_translation_changes(
    logger: logging.Logger,
    product_id: str,
    lang: str,
    before: Optional[Dict[str, Optional[str]]],
    after: Dict[str, Optional[str]],
    dry_run: bool,
    context: str,
) -> None:
    changes: List[str] = []
    for key in ("name", "slug", "meta_title", "meta_description", "description"):
        changes.append(_format_change(key, (before or {}).get(key), after.get(key)))
    changes = [change for change in changes if change]
    if not changes:
        return
    prefix = "DRY RUN" if dry_run else "UPDATED"
    logger.info(
        "%s %s %s [%s]: %s",
        prefix,
        context,
        product_id,
        lang,
        "; ".join(changes),
    )


def _log_product_changes(
    logger: logging.Logger,
    product_id: str,
    before: Dict[str, Optional[str]],
    updates: Dict[str, Optional[str]],
    dry_run: bool,
) -> None:
    changes: List[str] = []
    for key, value in updates.items():
        changes.append(_format_change(key, before.get(key), value))
    changes = [change for change in changes if change]
    if not changes:
        return
    prefix = "DRY RUN" if dry_run else "UPDATED"
    logger.info("%s product %s: %s", prefix, product_id, "; ".join(changes))


async def _fetch_product_name_from_source(
    source_url: str,
    logger: logging.Logger,
) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(source_url)
            if response.status_code >= 400:
                logger.warning(
                    "Source fetch failed for %s: status %s",
                    source_url,
                    response.status_code,
                )
                return None
            name = extract_product_name(response.text or "")
            return normalize_whitespace(name or "")
    except Exception as exc:
        logger.warning("Source fetch failed for %s: %s", source_url, exc)
        return None


def _strip_review_suffix_tokens(name: str, lang: str) -> str:
    keywords = REVIEW_KEYWORDS_ALL
    if not keywords:
        return name
    normalized = normalize_whitespace(name or "")
    if not normalized:
        return name
    parts = normalized.split()
    if not parts:
        return normalized
    keyword_set = {k.lower() for k in keywords}
    removed = False
    while parts:
        token = parts[-1]
        token_norm = latinize_text(token).lower()
        token_norm = re.sub(r"[^a-z0-9]+", "", token_norm)
        if token_norm in keyword_set:
            parts.pop()
            removed = True
            continue
        break
    if not removed:
        return normalized
    stripped = " ".join(parts).strip()
    return stripped or normalized


def _ensure_review_suffix_name(name: str, lang: str) -> str:
    if not name:
        return name
    suffix = REVIEW_NAME_SUFFIXES.get(lang)
    if not suffix:
        return normalize_whitespace(name)
    normalized = normalize_whitespace(name)
    if not normalized:
        return name
    base = _strip_review_suffix_tokens(normalized, lang)
    if not base:
        return suffix
    return f"{base} {suffix}"


def _normalize_review_slug(slug: str, lang: str) -> str:
    if not slug:
        return slug
    suffix = REVIEW_SLUG_SUFFIXES.get(lang)
    if not suffix:
        return slug
    keywords = REVIEW_KEYWORDS_ALL
    parts = [part for part in slug.lower().split("-") if part]
    while parts and parts[-1] in keywords:
        parts.pop()
    base = "-".join(parts)
    if not base:
        return suffix
    return f"{base}-{suffix}"


def _needs_review_suffix_fix(name: str, slug: str, lang: str) -> bool:
    if not lang or lang == "ru":
        return False
    normalized_name = normalize_whitespace(name or "")
    normalized_slug = (slug or "").strip().lower()
    if normalized_name:
        target_name = _ensure_review_suffix_name(normalized_name, lang)
        if target_name and target_name != normalized_name:
            return True
    if normalized_slug:
        target_slug = _normalize_review_slug(normalized_slug, lang)
        if target_slug and target_slug != normalized_slug:
            return True
    return False


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


def _ensure_unique_product_slug(
    supabase: SupabaseClient,
    product_id: str,
    base_slug: str,
) -> str:
    candidate = base_slug
    for attempt in range(5):
        rows = supabase.select(
            "products",
            columns="id",
            filters=[("eq", "slug", candidate)],
            limit=1,
        )
        if not rows or rows[0].get("id") == product_id:
            return candidate
        candidate = f"{base_slug}-{short_hash(f'{product_id}-{attempt}-{base_slug}')}"
    return candidate


async def _translate_for_product(
    groq: GroqClient,
    product_id: str,
    source_name: str,
    source_desc: Optional[str],
    category_name: Optional[str],
    langs: List[str],
    logger: logging.Logger,
) -> Dict[str, dict]:
    translations = await translate_product(
        groq,
        source_name,
        source_desc,
        category_name,
        langs,
        logger,
    )
    logger.info(
        "AI translations ready for product %s: %s",
        product_id,
        ", ".join(sorted(translations.keys())),
    )
    return translations


async def backfill_async(limit: int, include_missing: bool, dry_run: bool, force: bool = False) -> None:
    load_dotenv()
    logger = logging.getLogger("backfill_products")
    logger.setLevel(logging.INFO)
    logger.addHandler(logging.StreamHandler())

    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    groq_key = os.getenv("GROQ_API_KEY", "")
    groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    if not supabase_url or not supabase_key or not groq_key:
        raise SystemExit(
            "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or GROQ_API_KEY in .env"
        )

    supabase = SupabaseClient(supabase_url, supabase_key, logger, dry_run=dry_run)
    groq = GroqClient(api_key=groq_key, model=groq_model, logger=logger)
    target_langs = _load_langs()
    target_lang_set = set(target_langs)

    logger.info("Scanning product_translations for Cyrillic/suffix issues...")
    bad_langs_by_product: Dict[str, Set[str]] = {}
    suffix_fix_by_product: Dict[str, Set[str]] = {}
    existing_langs_by_product: Dict[str, Set[str]] = {}
    translation_samples_by_product: Dict[str, Dict[str, Dict[str, Optional[str]]]] = {}
    offset = 0
    while True:
        response = (
            supabase.client.table("product_translations")
            .select(
                "product_id, lang, name, description, slug, meta_title, meta_description"
            )
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            break
        for row in rows:
            product_id = row.get("product_id")
            lang = (row.get("lang") or "").lower()
            if not product_id or not lang:
                continue
            existing_langs_by_product.setdefault(product_id, set()).add(lang)
            if _row_has_cyrillic(
                row,
                ["name", "description", "slug", "meta_title", "meta_description"],
            ):
                bad_langs_by_product.setdefault(product_id, set()).add(lang)
            name_value = str(row.get("name") or "")
            slug_value = str(row.get("slug") or "")
            if PLACEHOLDER_NAME_RE.match(name_value) or PLACEHOLDER_SLUG_RE.match(slug_value):
                bad_langs_by_product.setdefault(product_id, set()).add(lang)
            if _needs_review_suffix_fix(
                row.get("name") or "",
                row.get("slug") or "",
                lang,
            ):
                suffix_fix_by_product.setdefault(product_id, set()).add(lang)
            if lang in target_lang_set:
                translation_samples_by_product.setdefault(product_id, {})[lang] = {
                    "name": row.get("name"),
                    "slug": row.get("slug"),
                    "meta_title": row.get("meta_title"),
                    "meta_description": row.get("meta_description"),
                    "description": row.get("description"),
                }
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    logger.info("Scanning products table for Cyrillic base fields and source URL mismatches...")
    products_with_cyrillic: Set[str] = set()
    products_with_placeholder: Set[str] = set()
    products_with_mismatch: Set[str] = set()
    mismatch_langs_by_product: Dict[str, Set[str]] = {}
    offset = 0
    while True:
        response = (
            supabase.client.table("products")
            .select("id, name, description, slug, source_url")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            break
        for row in rows:
            product_id = row.get("id")
            if not product_id:
                continue
            if _row_has_cyrillic(row, ["name", "description", "slug"]):
                products_with_cyrillic.add(product_id)
            if PLACEHOLDER_NAME_RE.match(str(row.get("name") or "")) or PLACEHOLDER_SLUG_RE.match(
                str(row.get("slug") or "")
            ):
                products_with_placeholder.add(product_id)
            source_slug = _product_slug_from_url(row.get("source_url"))
            if source_slug:
                if _translation_mismatch_with_source_slug(
                    source_slug,
                    row.get("name"),
                    row.get("slug"),
                ):
                    products_with_mismatch.add(product_id)
                samples = translation_samples_by_product.get(product_id, {})
                for lang, sample in samples.items():
                    if _translation_mismatch_with_source_slug(
                        source_slug,
                        sample.get("name"),
                        sample.get("slug"),
                    ):
                        products_with_mismatch.add(product_id)
                        mismatch_langs_by_product.setdefault(product_id, set()).add(lang)
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    target_products = sorted(
        set(bad_langs_by_product)
        | products_with_cyrillic
        | products_with_placeholder
        | set(suffix_fix_by_product)
        | products_with_mismatch
    )
    logger.info("Found %d products to backfill.", len(target_products))
    
    # Filter out already processed products unless force is used
    if not force:
        already_processed = _load_processed_products()
        original_count = len(target_products)
        target_products = [p for p in target_products if p not in already_processed]
        skipped_count = original_count - len(target_products)
        if skipped_count > 0:
            logger.info("Skipping %d already processed products. Use --force to reprocess.", skipped_count)
        logger.info("Remaining products to process: %d", len(target_products))

    processed = 0
    success_count = 0
    skip_count = 0
    error_count = 0
    
    for product_id in target_products:
        if limit and processed >= limit:
            break
        processed += 1

        product_rows = supabase.select(
            "products",
            columns="id, name, description, slug, source_url",
            filters=[("eq", "id", product_id)],
            limit=1,
        )
        if not product_rows:
            continue
        product_row = product_rows[0]
        translations = supabase.select(
            "product_translations",
            columns="lang, name, description, slug, meta_title, meta_description",
            filters=[("eq", "product_id", product_id)],
        )
        existing_by_lang: Dict[str, Dict[str, Optional[str]]] = {}
        for row in translations:
            lang = (row.get("lang") or "").lower()
            if not lang:
                continue
            existing_by_lang[lang] = {
                "name": row.get("name"),
                "description": row.get("description"),
                "slug": row.get("slug"),
                "meta_title": row.get("meta_title"),
                "meta_description": row.get("meta_description"),
            }

        primary_hint = next(
            (
                row
                for row in translations
                if (row.get("lang") or "").lower() in ("en", "tr", "de", "es")
            ),
            None,
        )
        primary_lang_hint = (primary_hint or {}).get("lang")
        primary_lang_hint = (primary_lang_hint or "").lower() or None

        existing_langs = {
            (row.get("lang") or "").lower() for row in translations if row.get("lang")
        }
        bad_langs = bad_langs_by_product.get(product_id, set())
        suffix_langs = suffix_fix_by_product.get(product_id, set())
        source_slug = _product_slug_from_url(product_row.get("source_url"))
        base_mismatch = _translation_mismatch_with_source_slug(
            source_slug,
            product_row.get("name"),
            product_row.get("slug"),
        )
        mismatch_langs = set(mismatch_langs_by_product.get(product_id, set()))
        if source_slug:
            for row in translations:
                lang = (row.get("lang") or "").lower()
                if not lang or lang == "ru" or lang not in target_lang_set:
                    continue
                base_name = _strip_review_suffix_tokens(
                    str(row.get("name") or ""), lang
                )
                if _looks_like_handle(base_name):
                    mismatch_langs.add(lang)
                if _translation_mismatch_with_source_slug(
                    source_slug,
                    row.get("name"),
                    row.get("slug"),
                ):
                    mismatch_langs.add(lang)
        if base_mismatch and source_slug:
            logger.info(
                "Source URL mismatch for %s: source_slug=%s name='%s'",
                product_id,
                source_slug,
                _truncate_text(product_row.get("name")),
            )
        if mismatch_langs and source_slug:
            logger.info(
                "Source URL mismatch translations for %s: %s",
                product_id,
                ", ".join(sorted(mismatch_langs)),
            )
        langs_to_fix: Set[str] = {
            lang for lang in bad_langs if lang in target_lang_set and lang != "ru"
        }
        if mismatch_langs:
            langs_to_fix.update(mismatch_langs)
        if include_missing:
            langs_to_fix.update(
                lang
                for lang in target_langs
                if lang != "ru" and lang not in existing_langs
            )

        langs_to_normalize: Set[str] = {
            lang
            for lang in suffix_langs
            if lang in target_lang_set and lang != "ru" and lang not in langs_to_fix
        }

        base_needs_cyrillic = _row_has_cyrillic(product_row, ["name", "description", "slug"])
        base_needs_placeholder = PLACEHOLDER_NAME_RE.match(str(product_row.get("name") or "")) or PLACEHOLDER_SLUG_RE.match(
            str(product_row.get("slug") or "")
        )
        base_name_plain = _strip_review_suffix_tokens(
            str(product_row.get("name") or ""), primary_lang_hint or "en"
        )
        base_needs_handle = _looks_like_handle(base_name_plain)
        base_needs_fix = base_needs_cyrillic or base_needs_placeholder or _needs_review_suffix_fix(
            product_row.get("name") or "",
            product_row.get("slug") or "",
            primary_lang_hint or "en",
        )
        if base_needs_handle:
            base_needs_fix = True
        if base_mismatch:
            base_needs_fix = True

        if base_needs_cyrillic and not langs_to_fix and "en" in target_lang_set:
            langs_to_fix.add("en")
        if base_mismatch and not langs_to_fix:
            if primary_lang_hint and primary_lang_hint in target_lang_set:
                langs_to_fix.add(primary_lang_hint)
            elif "en" in target_lang_set:
                langs_to_fix.add("en")

        if not langs_to_fix and not langs_to_normalize and not base_needs_fix:
            continue

        ru_translation = next(
            (row for row in translations if row.get("lang") == "ru"), None
        )
        fallback_translation = next(
            (row for row in translations if row.get("name")), None
        )

        source_name = (
            (ru_translation or {}).get("name")
            or product_row.get("name")
            or (fallback_translation or {}).get("name")
        )
        source_desc = (
            (ru_translation or {}).get("description")
            or product_row.get("description")
            or (fallback_translation or {}).get("description")
        )
        source_name = normalize_whitespace(source_name or "")
        if not source_name:
            logger.warning("Skipping %s: missing source name", product_id)
            continue
        force_retranslate = bool(mismatch_langs or base_mismatch or base_needs_handle)
        if force_retranslate and product_row.get("source_url"):
            fetched_name = await _fetch_product_name_from_source(
                product_row.get("source_url"), logger
            )
            if fetched_name:
                if normalize_whitespace(fetched_name) != source_name:
                    logger.info(
                        "Using source_url product name for %s: '%s' (was '%s')",
                        product_id,
                        _truncate_text(fetched_name),
                        _truncate_text(source_name),
                    )
                source_name = normalize_whitespace(fetched_name)

        translations_map: Dict[str, dict] = {}
        primary_lang: Optional[str] = None
        if langs_to_fix:
            translations_map = await _translate_for_product(
                groq,
                product_id,
                source_name,
                source_desc,
                None,
                sorted(langs_to_fix),
                logger,
            )
            if translations_map:
                primary_lang = next(
                    (lang for lang in ["en", "tr", "de", "es"] if lang in translations_map),
                    None,
                )
                for lang, payload in translations_map.items():
                    _log_translation_changes(
                        logger,
                        product_id,
                        lang,
                        existing_by_lang.get(lang),
                        payload,
                        dry_run,
                        "translate",
                    )
                if dry_run:
                    logger.info(
                        "DRY RUN: would update %d translations for %s",
                        len(translations_map),
                        product_id,
                    )
                else:
                    upsert_product_translations(
                        supabase, product_id, translations_map.values(), logger
                    )

        if langs_to_normalize:
            normalized_updates = []
            for row in translations:
                lang = (row.get("lang") or "").lower()
                if not lang or lang not in langs_to_normalize:
                    continue
                name = row.get("name") or ""
                slug = row.get("slug") or ""
                meta_title = row.get("meta_title") or ""
                normalized_name = _ensure_review_suffix_name(name, lang) if name else name
                normalized_slug = _normalize_review_slug(slug, lang) if slug else slug
                normalized_meta_title = (
                    _ensure_review_suffix_name(meta_title, lang) if meta_title else meta_title
                )
                if (
                    normalized_name == name
                    and normalized_slug == slug
                    and normalized_meta_title == meta_title
                ):
                    continue
                normalized_updates.append(
                    {
                        "lang": lang,
                        "name": normalized_name or name,
                        "description": row.get("description"),
                        "slug": normalized_slug or slug,
                        "meta_title": normalized_meta_title or meta_title,
                        "meta_description": row.get("meta_description"),
                    }
                )

            if normalized_updates:
                for update in normalized_updates:
                    lang = (update.get("lang") or "").lower()
                    _log_translation_changes(
                        logger,
                        product_id,
                        lang,
                        existing_by_lang.get(lang),
                        update,
                        dry_run,
                        "normalize",
                    )
                if dry_run:
                    logger.info(
                        "DRY RUN: would normalize %d translations for %s",
                        len(normalized_updates),
                        product_id,
                    )
                else:
                    upsert_product_translations(
                        supabase, product_id, normalized_updates, logger
                    )

        primary_translation = (
            translations_map.get("en")
            or translations_map.get("tr")
            or translations_map.get("de")
            or translations_map.get("es")
        )
        if not primary_translation:
            primary_translation = next(
                (row for row in translations if row.get("lang") == "en"), None
            )
            if primary_translation:
                primary_lang = "en"
        if not primary_translation:
            primary_translation = next((row for row in translations if row.get("name")), None)
            if primary_translation:
                primary_lang = (primary_translation.get("lang") or "").lower() or None

        base_suffix_fix = False
        if primary_translation:
            base_suffix_fix = _needs_review_suffix_fix(
                product_row.get("name") or "",
                product_row.get("slug") or "",
                primary_lang or "en",
            )
            base_needs_fix = base_needs_fix or base_suffix_fix

        updates: Dict[str, str] = {}
        if base_needs_fix and primary_translation:
            candidate_name = normalize_whitespace(primary_translation.get("name") or "")
            candidate_desc = normalize_whitespace(
                primary_translation.get("description") or ""
            )
            if candidate_name and not contains_cyrillic(candidate_name) and not looks_like_transliterated_russian(candidate_name):
                candidate_lang = primary_lang or "en"
                candidate_name = _ensure_review_suffix_name(candidate_name, candidate_lang)
                if _row_has_cyrillic(product_row, ["name"]) or base_suffix_fix or base_needs_placeholder:
                    updates["name"] = candidate_name
                if _row_has_cyrillic(product_row, ["slug"]) or base_suffix_fix or base_needs_placeholder:
                    base_slug = slugify(
                        candidate_name, max_length=80, fallback=candidate_name
                    )
                    if base_slug:
                        updates["slug"] = _ensure_unique_product_slug(
                            supabase,
                            product_id,
                            base_slug,
                        )
            if candidate_desc and not contains_cyrillic(candidate_desc):
                if contains_cyrillic(product_row.get("description") or ""):
                    updates["description"] = _preserve_original_url(
                        product_row.get("description"), candidate_desc
                    )

        if updates:
            _log_product_changes(logger, product_id, product_row, updates, dry_run)
            if dry_run:
                logger.info("DRY RUN: would update products %s -> %s", product_id, updates)
            else:
                supabase.update("products", updates, filters=[("eq", "id", product_id)])

        # Track this product as successfully processed (unless dry run)
        if not dry_run:
            _save_processed_product(product_id, "ok")
            success_count += 1
        
        await asyncio.sleep(0.4)

    # Final summary
    logger.info("=" * 60)
    logger.info("Backfill finished.")
    logger.info("  Total scanned: %d", processed)
    logger.info("  Successfully processed: %d", success_count)
    if not force:
        logger.info("  Previously processed (skipped): check log above")
    logger.info("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill product translations to remove Cyrillic content."
    )
    parser.add_argument("--limit", type=int, default=0, help="Limit number of products to process")
    parser.add_argument("--dry-run", action="store_true", help="Don't make any changes, just show what would be done")
    parser.add_argument("--include-missing", action="store_true", help="Also add missing language translations")
    parser.add_argument("--force", action="store_true", help="Reprocess already processed products")
    parser.add_argument("--reset-tracking", action="store_true", help="Clear the processed products tracking file")
    args = parser.parse_args()
    
    if args.reset_tracking:
        if PROCESSED_TRACKING_FILE.exists():
            PROCESSED_TRACKING_FILE.unlink()
            print(f"Tracking file cleared: {PROCESSED_TRACKING_FILE}")
        else:
            print("No tracking file to clear.")
        return
    
    asyncio.run(backfill_async(args.limit, args.include_missing, args.dry_run, args.force))


if __name__ == "__main__":
    main()
