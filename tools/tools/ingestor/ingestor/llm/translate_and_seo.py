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
    build_vision_prompt,
    build_sentiment_enrichment_prompt,
    build_product_translation_prompt,
    build_pivot_translation_prompt,
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
    "specs",
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
    data["specs"] = payload.get("specs") if isinstance(payload.get("specs"), dict) else {}
    data["summary"] = normalize_whitespace(str(payload.get("summary") or ""))
    
    return data


async def _parse_or_repair(client: GroqClient, raw: str, logger: logging.Logger) -> dict:
    parsed = parse_json_strict(raw)
    if parsed is not None:
        return parsed
    logger.warning("Invalid JSON from Groq. Raw response follows:\n%s", raw)
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
    
    # Content length threshold for chunking (characters)
    CHUNK_THRESHOLD = 4000
    MAX_RETRIES = 3
    
    async def _translate_with_retry(prompt: str, lang: str, attempt: int = 0) -> Optional[dict]:
        """Translate with retry logic"""
        try:
            raw = await asyncio.to_thread(client.chat_json, SYSTEM_PROMPT, prompt)
            parsed = await _parse_or_repair(client, raw, logger)
            return parsed
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                logger.warning("Translation attempt %d/%d failed for %s: %s. Retrying...", 
                             attempt + 1, MAX_RETRIES, lang, str(e)[:100])
                await asyncio.sleep(2 * (attempt + 1))  # Progressive delay
                return await _translate_with_retry(prompt, lang, attempt + 1)
            else:
                logger.error("All %d translation attempts failed for %s: %s", MAX_RETRIES, lang, e)
                return None
    
    async def _translate_chunked(lang: str, title: str, content: str, category: str, pros: list, cons: list) -> Optional[dict]:
        """Translate long content by splitting into chunks"""
        # For very long content, split into sections and translate separately
        from .prompts import build_chunked_translation_prompt, build_metadata_prompt
        
        # Split content into ~3000 char chunks
        chunks = []
        remaining = content
        chunk_size = 3000
        
        while remaining:
            if len(remaining) <= chunk_size:
                chunks.append(remaining)
                break
            
            # Try to split at paragraph boundary
            split_point = remaining.rfind('</p>', 0, chunk_size)
            if split_point == -1:
                split_point = remaining.rfind(' ', 0, chunk_size)
            if split_point == -1:
                split_point = chunk_size
            else:
                split_point += 4 if remaining[split_point:split_point+4] == '</p>' else 1
            
            chunks.append(remaining[:split_point])
            remaining = remaining[split_point:]
        
        logger.info("Splitting content into %d chunks for %s translation", len(chunks), lang)
        
        # Translate each chunk
        translated_chunks = []
        for i, chunk in enumerate(chunks):
            chunk_prompt = build_chunked_translation_prompt(lang, chunk, i + 1, len(chunks))
            result = await _translate_with_retry(chunk_prompt, f"{lang}_chunk_{i+1}")
            if result and result.get("translated_text"):
                translated_chunks.append(result["translated_text"])
            else:
                logger.warning("Chunk %d/%d translation failed for %s, using original", i+1, len(chunks), lang)
                translated_chunks.append(chunk)
        
        # Combine translated chunks
        combined_content = "".join(translated_chunks)
        
        # SUPER INTELLIGENCE: Sentiment Analysis
        sentiment_data = {}
        try:
            sentiment_prompt = build_sentiment_enrichment_prompt(lang, title, combined_content)
            sentiment_data = await _translate_with_retry(sentiment_prompt, f"{lang}_sentiment") or {}
        except Exception as e:
            logger.warning("Sentiment analysis failed for %s: %s", lang, e)

        # Now generate metadata, FAQs, pros/cons separately
        metadata_prompt = build_metadata_prompt(lang, title, combined_content[:2000], category, pros, cons)
        metadata = await _translate_with_retry(metadata_prompt, f"{lang}_metadata")
        
        if metadata:
            metadata["content_html"] = combined_content
            
            # Enrich specs with gathered sentiment aspects
            if sentiment_data and sentiment_data.get("aspects"):
                if "specs" not in metadata:
                    metadata["specs"] = {}
                # Format aspects as "Aspect: 9/10"
                for k, v in sentiment_data["aspects"].items():
                     metadata["specs"][k] = f"{v}/10"
                
                # Add overall sentiment if not present
                if sentiment_data.get("key_emotion"):
                    metadata["specs"]["Verdict"] = sentiment_data["key_emotion"]
            
            # SUPER INTELLIGENCE: Inject Alt Tags into HTML images
            alt_tags = metadata.get("image_alt_tags", [])
            if alt_tags and combined_content:
                try:
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(combined_content, "lxml")
                    images = soup.find_all("img")
                    for idx, img in enumerate(images):
                        if idx < len(alt_tags):
                            img["alt"] = alt_tags[idx]
                        else:
                            # Cycle through tags or use generic
                            img["alt"] = f"{title} - {alt_tags[idx % len(alt_tags)]}"
                    
                    # Log the injection
                    # logger.info("Injected %d SEO alt tags into content images", len(images))
                    
                    # Update content_html with injected alt tags
                    metadata["content_html"] = str(soup)
                    # Use semantic cleaning if needed, but str(soup) usually is fine for body
                    # Strip <html><body> wrappers if any
                    if soup.body:
                        metadata["content_html"] = soup.body.decode_contents()
                        
                except Exception as e:
                    logger.warning("Failed to inject alt tags into HTML: %s", e)

            return metadata
        else:
            # Return minimal structure with translated content
            return {
                "title": title,
                "content_html": combined_content,
                "summary": "",
                "specs": {},
                "faq": [],
                "pros": pros or [],
                "cons": cons or [],
                "meta_title": title[:60],
                "meta_description": title[:160],
                "og_title": title[:60],
                "og_description": title[:160],
                "slug": ""
            }
    
    # 1. Pivot Strategy: Always do English first
    try:
        content_length = len(content_html_ru or "")
        
        if content_length > CHUNK_THRESHOLD:
            logger.info("Long content detected (%d chars), using chunked translation for EN", content_length)
            en_parsed = await _translate_chunked("en", title_ru, content_html_ru, category_name_ru, pros_ru, cons_ru)
        else:
            en_prompt = build_translation_prompt("en", title_ru, content_html_ru, category_name_ru, pros_ru, cons_ru)
            en_parsed = await _translate_with_retry(en_prompt, "en")
        
        if en_parsed:
            en_normalized = _normalize_payload(en_parsed, "en", fallback_title=title_ru)
            results["en"] = en_normalized
            logger.info("English pivot translation successful")
        else:
            logger.error("Critical: Failed to generate English pivot translation after all retries")
    except Exception as e:
        logger.error("Critical: Failed to generate English pivot translation: %s", e)

    # 2. Process other languages
    other_langs = [l for l in langs if l != "en"]
    
    async def _do_one(lang):
        try:
            content_length = len(content_html_ru or "")
            
            # If we have valid English data, use it as pivot source
            if "en" in results and results["en"]:
                en_content_length = len(results["en"].get("content_html", ""))
                
                if en_content_length > CHUNK_THRESHOLD:
                    logger.info("Long content (%d chars), using chunked translation for %s", en_content_length, lang)
                    parsed = await _translate_chunked(
                        lang, 
                        results["en"].get("title", title_ru),
                        results["en"].get("content_html", content_html_ru),
                        category_name_ru,
                        results["en"].get("pros", pros_ru),
                        results["en"].get("cons", cons_ru)
                    )
                else:
                    prompt = build_pivot_translation_prompt(lang, results["en"])
                    parsed = await _translate_with_retry(prompt, lang)
            else:
                # Fallback to direct translation from Russian
                if content_length > CHUNK_THRESHOLD:
                    logger.info("Long content (%d chars), using chunked translation for %s (direct)", content_length, lang)
                    parsed = await _translate_chunked(lang, title_ru, content_html_ru, category_name_ru, pros_ru, cons_ru)
                else:
                    prompt = build_translation_prompt(lang, title_ru, content_html_ru, category_name_ru, pros_ru, cons_ru)
                    parsed = await _translate_with_retry(prompt, lang)
            
            if parsed:
                normalized = _normalize_payload(parsed, lang, fallback_title=title_ru)
                return lang, normalized
            else:
                logger.error("Failed to translate review to %s after all attempts", lang)
                return lang, None
        except Exception as e:
            logger.error("Failed to translate review to %s: %s", lang, e)
            return lang, None

    if other_langs:
        items = await asyncio.gather(*[_do_one(l) for l in other_langs])
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
