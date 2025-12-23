import logging
import asyncio
from typing import Dict, List, Optional

from ..utils.slugify import slugify
from ..utils.text_clean import clean_html, normalize_whitespace
from .groq_client import GroqClient
from .json_parse import parse_json_strict
from .prompts import (
    SYSTEM_PROMPT,
    EXTRACTION_SYSTEM_PROMPT,
    build_repair_prompt,
    build_translation_prompt,
    build_category_translation_prompt,
    build_product_translation_prompt,
    build_extraction_prompt,
)


_REQUIRED_KEYS = {
    "title",
    "content_html",
    "meta_title",
    "meta_description",
    "og_title",
    "og_description",
    "slug",
    "faq",
    "summary",
    "pros",
    "cons",
}


def _normalize_payload(payload: dict, lang: str, fallback_title: str) -> dict:
    data = {key: (payload.get(key) or "") for key in _REQUIRED_KEYS}
    data["title"] = normalize_whitespace(str(data["title"])) or fallback_title
    data["content_html"] = clean_html(str(data["content_html"]))
    data["meta_title"] = normalize_whitespace(str(data["meta_title"])) or data["title"]
    data["meta_description"] = normalize_whitespace(str(data["meta_description"]))
    data["og_title"] = normalize_whitespace(str(data["og_title"])) or data["meta_title"]
    data["og_description"] = normalize_whitespace(str(data["og_description"])) or data["meta_description"]

    slug_source = data["slug"] or data["title"]
    data["slug"] = slugify(slug_source, max_length=80, fallback=fallback_title)

    if len(data["meta_description"]) > 170:
        data["meta_description"] = data["meta_description"][:160].rstrip()
    if len(data["og_description"]) > 170:
        data["og_description"] = data["og_description"][:160].rstrip()
    if not data["meta_description"]:
        data["meta_description"] = data["title"][:160]
    if not data["og_description"]:
        data["og_description"] = data["meta_description"]

    data["lang"] = lang
    
    # Ensure pros/cons/faq are correctly typed
    data["pros"] = [str(x) for x in payload.get("pros", []) if x][:20]
    data["cons"] = [str(x) for x in payload.get("cons", []) if x][:20]
    data["faq"] = payload.get("faq") if isinstance(payload.get("faq"), list) else []
    data["summary"] = normalize_whitespace(str(payload.get("summary") or ""))
    
    return data


async def _parse_or_repair(client: GroqClient, raw: str, logger: logging.Logger) -> dict:
    parsed = parse_json_strict(raw)
    if parsed is not None:
        return parsed
    logger.warning("Invalid JSON from Groq. Raw: %s", raw[:500] + "...")
    logger.warning("Retrying with repair prompt")
    repair_prompt = build_repair_prompt(raw)
    repaired_raw = await asyncio.to_thread(client.chat_json, SYSTEM_PROMPT, repair_prompt)
    repaired = parse_json_strict(repaired_raw)
    if repaired is None:
        logger.error("Failed to parse JSON after repair. Repaired raw: %s", repaired_raw[:500] + "...")
        raise ValueError("Failed to parse JSON after repair")
    return repaired


async def translate_review(
    client: GroqClient,
    title_ru: str,
    content_html_ru: str,
    category_name_ru: Optional[str],
    langs: List[str],
    logger: logging.Logger,
    pros_ru: Optional[List[str]] = None,
    cons_ru: Optional[List[str]] = None,
) -> Dict[str, dict]:
    results: Dict[str, dict] = {}

    async def _do_one(lang):
        try:
            prompt = build_translation_prompt(lang, title_ru, content_html_ru, category_name_ru, pros_ru, cons_ru)
            raw = await asyncio.to_thread(client.chat_json, SYSTEM_PROMPT, prompt)
            parsed = await _parse_or_repair(client, raw, logger)
            normalized = _normalize_payload(parsed, lang, fallback_title=title_ru)
            return lang, normalized
        except Exception as e:
            logger.error("Failed to translate review to %s: %s", lang, e)
            return lang, None

    items = await asyncio.gather(*[_do_one(l) for l in langs])
    for lang, res in items:
        if res:
            results[lang] = res
    return results

async def translate_category(
    client: GroqClient,
    name_ru: str,
    langs: List[str],
    logger: logging.Logger,
) -> Dict[str, dict]:
    results: Dict[str, dict] = {}

    async def _do_one(lang):
        try:
            prompt = build_category_translation_prompt(lang, name_ru)
            raw = await asyncio.to_thread(client.chat_json, SYSTEM_PROMPT, prompt)
            parsed = await _parse_or_repair(client, raw, logger)
            
            name = normalize_whitespace(str(parsed.get("name") or name_ru))
            slug = slugify(str(parsed.get("slug") or name), max_length=50, fallback=name_ru)
            return lang, {"lang": lang, "name": name, "slug": slug}
        except Exception as e:
            logger.error("Failed to translate category %s to %s: %s", name_ru, lang, e)
            return lang, None

    items = await asyncio.gather(*[_do_one(l) for l in langs])
    for lang, res in items:
        if res:
            results[lang] = res
    return results


async def translate_product(
    client: GroqClient,
    name_ru: str,
    description_ru: Optional[str],
    category_name_ru: Optional[str],
    langs: List[str],
    logger: logging.Logger,
) -> Dict[str, dict]:
    results: Dict[str, dict] = {}

    async def _do_one(lang):
        try:
            prompt = build_product_translation_prompt(lang, name_ru, description_ru, category_name_ru)
            raw = await asyncio.to_thread(client.chat_json, SYSTEM_PROMPT, prompt)
            parsed = await _parse_or_repair(client, raw, logger)

            name = normalize_whitespace(str(parsed.get("name") or name_ru))
            description = normalize_whitespace(str(parsed.get("description") or ""))
            meta_title = normalize_whitespace(str(parsed.get("meta_title") or name))
            meta_description = normalize_whitespace(str(parsed.get("meta_description") or ""))
            slug = slugify(str(parsed.get("slug") or name), max_length=80, fallback=name_ru)

            if len(meta_description) > 170:
                meta_description = meta_description[:160].rstrip()
            if not meta_description:
                meta_description = name[:160]

            return lang, {
                "lang": lang,
                "name": name,
                "description": description,
                "meta_title": meta_title,
                "meta_description": meta_description,
                "slug": slug,
            }
        except Exception as e:
            logger.error("Failed to translate product %s to %s: %s", name_ru, lang, e)
            return lang, None

    items = await asyncio.gather(*[_do_one(l) for l in langs])
    for lang, res in items:
        if res:
            results[lang] = res
    return results
async def extract_review_details_ai(
    client: GroqClient,
    html_text: str,
    logger: logging.Logger,
) -> dict:
    try:
        prompt = build_extraction_prompt(html_text)
        raw = await asyncio.to_thread(client.chat_json, EXTRACTION_SYSTEM_PROMPT, prompt)
        parsed = await _parse_or_repair(client, raw, logger)
        return parsed
    except Exception as e:
        logger.error("AI Extraction failed: %s", e)
        return {}
