import logging
import asyncio
from typing import Dict, List, Optional

from ..utils.slugify import slugify
from ..utils.text_clean import clean_html, normalize_whitespace
from .groq_client import GroqClient
from .json_parse import parse_json_strict
from . import google_translate
from .prompts import (
    SYSTEM_PROMPT,
    EXTRACTION_SYSTEM_PROMPT,
    QUALITY_SYSTEM_PROMPT,
    LANGUAGE_STYLES,
    build_repair_prompt,
    build_translation_prompt,
    build_category_translation_prompt,
    build_vision_prompt,
    build_sentiment_enrichment_prompt,
    build_product_translation_prompt,
    build_extraction_prompt,
    build_content_translation_prompt,
    build_chunked_translation_prompt,
    build_title_translation_prompt,
    build_native_polish_prompt,
    build_metadata_prompt,
    build_metadata_polish_prompt,
    build_native_quality_prompt,
    build_product_polish_prompt,
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

LANGUAGE_SUFFIXES = {
    "tr": "-yorumlari",
    "en": "-reviews",
    "de": "-test",
    "es": "-opiniones",
    "fr": "-avis",
    "it": "-opinioni",
    "ru": "-otzyvy",
    "pt": "-avaliacao",
    "nl": "-review",
}

DIRECT_TRANSLATION_LANGS = set(LANGUAGE_STYLES.keys()) - {"en"}
CHUNK_THRESHOLD = 6000
CHUNK_SIZE = 3500
MAX_RETRIES = 3
ENABLE_NATIVE_POLISH = True
ENABLE_METADATA_POLISH = True
ENABLE_SENTIMENT_ENRICHMENT = True
MAX_QUALITY_PASSES = 2
MAX_METADATA_ATTEMPTS = 2
MIN_NATIVE_SCORE = 8.4
MIN_TRANSLATION_SMELL_SCORE = 8.2
MIN_FLUENCY_SCORE = 8.2
MIN_PROS = 5
MIN_CONS = 5
MIN_FAQ = 6

_LANG_BASE_TEMPS = {
    "en": 0.35,
    "tr": 0.5,
    "de": 0.4,
    "es": 0.55,
}

_MIN_LENGTH_RATIO = {
    "en": 0.9,
    "tr": 0.95,
    "de": 0.95,
    "es": 0.95,
}

_MIN_DESC_RATIO = {
    "en": 0.9,
    "tr": 0.95,
    "de": 0.95,
    "es": 0.95,
}


def _temperature_for(lang: str, purpose: str) -> float:
    base = _LANG_BASE_TEMPS.get(lang, 0.45)
    if purpose == "metadata":
        return min(base + 0.1, 0.65)
    if purpose == "polish":
        return max(base - 0.05, 0.2)
    if purpose == "title":
        return min(base + 0.05, 0.6)
    if purpose == "analysis":
        return max(base - 0.15, 0.2)
    return base

def create_localized_slug(text: str, lang: str, max_length: int = 80, fallback: str = None) -> str:
    slug = slugify(text, max_length=max_length, fallback=fallback)
    if not slug:
        return ""
    
    suffix = LANGUAGE_SUFFIXES.get(lang)
    if suffix and not slug.endswith(suffix):
        # Truncate to make room for suffix if needed
        allowed_len = max_length - len(suffix)
        if len(slug) > allowed_len:
            slug = slug[:allowed_len].rstrip("-")
        slug = f"{slug}{suffix}"
        
    return slug


# Common placeholder patterns that LLM might output literally
_PLACEHOLDER_PATTERNS = [
    "polished native title",
    "polished native content",
    "catchy, natural title",
    "catchy title",
    "your rewritten review",
    "<rewritten title",
    "<rewritten html",
    "do not output this placeholder",
    "natural native voice",
    "...",
]


def _contains_cyrillic(text: str) -> bool:
    """Check if text contains Cyrillic characters."""
    if not text:
        return False
    import re
    return bool(re.search(r'[\u0400-\u04FF]', text))


def _is_placeholder_title(title: str) -> bool:
    """Check if a title looks like a template placeholder the LLM output literally."""
    if not title:
        return True
    title_lower = title.lower().strip()
    for pattern in _PLACEHOLDER_PATTERNS:
        if pattern in title_lower:
            return True
    # Also check for very short/generic titles
    if len(title_lower) < 5:
        return True
    # Also reject if title contains Cyrillic (should be translated)
    if _contains_cyrillic(title):
        return True
    return False


def _normalize_payload(payload: dict, lang: str, fallback_title: str) -> dict:
    data = {key: (payload.get(key) or "") for key in _REQUIRED_KEYS}
    # Sanitize title to prevent JSON leakage
    raw_title = normalize_whitespace(str(data["title"]))
    if '", "content_html":' in raw_title:
         raw_title = raw_title.split('", "content_html":')[0]
    if '", "' in raw_title: # Generic catch for other JSON fields leaking into title
         raw_title = raw_title.split('", "')[0]
    cleaned_title = raw_title.strip('"').strip()
    
    # Check if title is valid (not placeholder and not Cyrillic)
    if _is_placeholder_title(cleaned_title):
        # Don't use Russian fallback - use fallback only if it's already Latin
        if fallback_title and not _contains_cyrillic(fallback_title):
            data["title"] = fallback_title
        else:
            # Mark as needing a proper translation - use a flag that upstream can handle
            data["title"] = ""  # Empty will trigger retry logic
            data["_title_needs_translation"] = True
    else:
        data["title"] = cleaned_title

    data["content_html"] = clean_html(str(data["content_html"]))
    data["meta_title"] = normalize_whitespace(str(data["meta_title"])) or data["title"]
    data["meta_description"] = normalize_whitespace(str(data["meta_description"]))
    data["og_title"] = normalize_whitespace(str(data["og_title"])) or data["meta_title"]
    data["og_description"] = normalize_whitespace(str(data["og_description"])) or data["meta_description"]

    slug_source = data["slug"] or data["title"]
    data["slug"] = create_localized_slug(slug_source, lang, max_length=80, fallback=fallback_title)

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
    
    # Robust FAQ normalization
    raw_faq = payload.get("faq")
    cleaned_faq = []
    if isinstance(raw_faq, list):
        for item in raw_faq:
            if isinstance(item, dict) and 'question' in item and 'answer' in item:
                 cleaned_faq.append({
                     "question": str(item['question']),
                     "answer": str(item['answer'])
                 })
    data["faq"] = cleaned_faq

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
    repaired_raw = await asyncio.to_thread(client.chat_json, SYSTEM_PROMPT, repair_prompt, 0.1)
    repaired = parse_json_strict(repaired_raw)
    if repaired is None:
        logger.error("Failed to parse JSON after repair. Repaired raw: %s", repaired_raw[:500] + "...")
        raise ValueError("Failed to parse JSON after repair")
    return repaired


def _split_html(content: str, chunk_size: int) -> List[str]:
    if not content:
        return []
    chunks = []
    remaining = content
    while remaining:
        if len(remaining) <= chunk_size:
            chunks.append(remaining)
            break
        split_point = remaining.rfind("</p>", 0, chunk_size)
        if split_point == -1:
            split_point = remaining.rfind(" ", 0, chunk_size)
        if split_point == -1:
            split_point = chunk_size
        else:
            split_point += 4 if remaining[split_point:split_point + 4] == "</p>" else 1
        chunks.append(remaining[:split_point])
        remaining = remaining[split_point:]
    return chunks


def _clean_faq(raw_faq: object) -> List[dict]:
    cleaned: List[dict] = []
    if isinstance(raw_faq, list):
        for item in raw_faq:
            if isinstance(item, dict) and "question" in item and "answer" in item:
                cleaned.append({
                    "question": str(item["question"]),
                    "answer": str(item["answer"]),
                })
    return cleaned


def _apply_image_alt_tags(content_html: str, title: str, alt_tags: List[str], logger: logging.Logger) -> str:
    if not content_html or not alt_tags:
        return content_html
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(content_html, "lxml")
        images = soup.find_all("img")
        for idx, img in enumerate(images):
            if idx < len(alt_tags):
                img["alt"] = alt_tags[idx]
            else:
                img["alt"] = f"{title} - {alt_tags[idx % len(alt_tags)]}"
        if soup.body:
            return soup.body.decode_contents()
        return str(soup)
    except Exception as e:
        logger.warning("Failed to inject alt tags into HTML: %s", e)
        return content_html


def _text_length(html: str) -> int:
    if not html:
        return 0
    import re
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return len(text)


def _sample_for_qa(content_html: str, max_chars: int = 6000) -> str:
    if not content_html:
        return ""
    if len(content_html) <= max_chars:
        return content_html
    head = content_html[: max_chars // 2]
    tail = content_html[-(max_chars // 2):]
    return f"{head}\n...\n{tail}"


def _min_content_length(lang: str, source_html: str) -> int:
    base_len = _text_length(source_html)
    if base_len == 0:
        return 0
    ratio = _MIN_LENGTH_RATIO.get(lang, 0.9)
    return max(120, int(base_len * ratio))


def _min_description_length(lang: str, source_text: str) -> int:
    if not source_text:
        return 0
    ratio = _MIN_DESC_RATIO.get(lang, 0.9)
    return max(80, int(len(source_text) * ratio))


def _min_summary_length(source_html: str) -> int:
    base_len = _text_length(source_html)
    if base_len == 0:
        return 160
    return max(180, min(420, int(base_len * 0.08)))


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
    title_ru = title_ru or ""
    content_html_ru = content_html_ru or ""
    
    async def _translate_with_retry(prompt: str, label: str, temperature: float, attempt: int = 0) -> Optional[dict]:
        try:
            raw = await asyncio.to_thread(client.chat_json, SYSTEM_PROMPT, prompt, temperature)
            parsed = await _parse_or_repair(client, raw, logger)
            return parsed
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                logger.warning(
                    "Translation attempt %d/%d failed for %s: %s. Retrying...",
                    attempt + 1,
                    MAX_RETRIES,
                    label,
                    str(e)[:100],
                )
                await asyncio.sleep(2 * (attempt + 1))
                return await _translate_with_retry(prompt, label, temperature, attempt + 1)
            logger.error("All %d translation attempts failed for %s: %s", MAX_RETRIES, label, e)
            return None

    async def _translate_title(lang: str, title_source: str, source_lang_name: str) -> str:
        """Translate title with retry logic. Never returns Russian/Cyrillic."""
        max_title_attempts = 3
        
        for attempt in range(max_title_attempts):
            # Build prompt with stronger instructions on retry
            if attempt > 0:
                # Force a direct translation with explicit instruction
                style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
                direct_prompt = (
                    f"CRITICAL: Translate this title to {style_info['name']}. "
                    f"You MUST output an actual translated title, NOT a placeholder.\n\n"
                    f"Title to translate: {title_source!r}\n\n"
                    f"Output JSON: {{\"title\": \"<your {style_info['name']} translation here>\"}}\n\n"
                    f"Rules:\n"
                    f"- Output the actual translated title in {style_info['name']}\n"
                    f"- NO Cyrillic characters\n"
                    f"- NO placeholder text like 'Polished native title'\n"
                    f"- Keep brand names unchanged"
                )
                parsed = await _translate_with_retry(
                    direct_prompt, 
                    f"{lang}_title_retry{attempt}", 
                    min(_temperature_for(lang, "title") + 0.1 * attempt, 0.7)
                )
            else:
                prompt = build_title_translation_prompt(lang, title_source, source_lang_name)
                parsed = await _translate_with_retry(prompt, f"{lang}_title", _temperature_for(lang, "title"))
            
            if parsed and parsed.get("title"):
                translated = normalize_whitespace(str(parsed.get("title")))
                # Check if valid (not placeholder, not Cyrillic)
                if not _is_placeholder_title(translated):
                    return translated
                logger.warning(
                    "Title translation attempt %d/%d returned invalid title '%s', retrying...", 
                    attempt + 1, max_title_attempts, translated[:50]
                )
        
        # All Groq LLM retries failed - try Google Translate as fallback
        logger.warning("All %d Groq title attempts failed for '%s'. Trying Google Translate...", 
                     max_title_attempts, title_source[:50])
        try:
            google_result = await asyncio.to_thread(
                google_translate.translate_title,
                title_source,
                lang,
                "ru",  # Source language
                logger
            )
            if google_result and not _is_placeholder_title(google_result):
                logger.info("Google Translate successfully translated title to %s", lang)
                return google_result
            else:
                logger.warning("Google Translate returned invalid title: %s", 
                             google_result[:50] if google_result else "None")
        except Exception as e:
            logger.error("Google Translate fallback failed for title: %s", str(e)[:100])
        
        # All translation methods failed - use slugify transliteration as last resort
        logger.error("All translation methods failed for title '%s'. Using transliteration.", 
                     title_source[:50])
        from ..utils.slugify import slugify
        slug_title = slugify(title_source, max_length=60, fallback="Review")
        # Convert slug to title case
        fallback = slug_title.replace("-", " ").title()
        return fallback if fallback else "Product Review"

    async def _translate_content(
        lang: str,
        title_source: str,
        content_source: str,
        category: Optional[str],
        pros: Optional[List[str]],
        cons: Optional[List[str]],
        source_lang_name: str,
        min_chars: Optional[int],
        issues: Optional[List[str]],
        temperature: float,
    ) -> Optional[tuple]:
        content_length = len(content_source or "")
        if content_length > CHUNK_THRESHOLD:
            logger.info("Long content detected (%d chars), using chunked translation for %s", content_length, lang)
            translated_title = await _translate_title(lang, title_source, source_lang_name)
            chunks = _split_html(content_source, CHUNK_SIZE)
            if not chunks:
                return translated_title, content_source
            translated_chunks = []
            for i, chunk in enumerate(chunks):
                chunk_prompt = build_chunked_translation_prompt(lang, chunk, i + 1, len(chunks))
                result = await _translate_with_retry(
                    chunk_prompt,
                    f"{lang}_chunk_{i+1}",
                    temperature,
                )
                if result and result.get("translated_text"):
                    translated_chunks.append(result["translated_text"])
                else:
                    logger.warning("Chunk %d/%d translation failed for %s, using original", i + 1, len(chunks), lang)
                    translated_chunks.append(chunk)
            combined_content = "".join(translated_chunks)
            return translated_title, combined_content

        prompt = build_content_translation_prompt(
            lang,
            title_source,
            content_source,
            category,
            pros,
            cons,
            source_lang_name=source_lang_name,
            min_chars=min_chars,
            issues=issues,
        )
        parsed = await _translate_with_retry(prompt, f"{lang}_content", temperature)
        if not parsed:
            return None
        translated_title = normalize_whitespace(str(parsed.get("title") or ""))
        # Prevent placeholder titles - retry translation instead of falling back to Russian
        if _is_placeholder_title(translated_title):
            logger.warning("Detected placeholder title '%s' from content translation, retrying title separately", 
                         translated_title[:50] if translated_title else "")
            # Get a proper translated title
            translated_title = await _translate_title(lang, title_source, source_lang_name)
        translated_content = str(parsed.get("content_html") or content_source)
        return translated_title, translated_content

    async def _polish_content(
        lang: str,
        title: str,
        content_html: str,
        min_chars: Optional[int],
        issues: Optional[List[str]],
        temperature: Optional[float] = None,
    ) -> tuple:
        if not ENABLE_NATIVE_POLISH:
            return title, content_html
        temp = temperature if temperature is not None else _temperature_for(lang, "polish")
        prompt = build_native_polish_prompt(lang, title, content_html, min_chars=min_chars, issues=issues)
        parsed = await _translate_with_retry(prompt, f"{lang}_polish", temp)
        if parsed:
            polished_title = normalize_whitespace(str(parsed.get("title") or ""))
            polished_content = str(parsed.get("content_html") or content_html)
            # Prevent placeholder titles - keep the already-translated input title
            if _is_placeholder_title(polished_title):
                logger.warning("Detected placeholder title '%s' from polish step, keeping pre-polish title: %s", 
                             polished_title[:50] if polished_title else "", title[:50])
                # Keep the input title which should already be translated
                polished_title = title if not _is_placeholder_title(title) else ""
            return polished_title or title, polished_content
        return title, content_html

    async def _generate_metadata(
        lang: str,
        title: str,
        content_html: str,
        category: Optional[str],
        pros: Optional[List[str]],
        cons: Optional[List[str]],
        issues: Optional[List[str]],
    ) -> dict:
        min_summary_chars = _min_summary_length(content_html)
        summary = ""
        pros_list: List[str] = []
        cons_list: List[str] = []
        faq: List[dict] = []
        specs: dict = {}
        meta_title = title[:60]
        meta_description = title[:160]
        og_title = meta_title
        og_description = meta_description
        slug = ""
        alt_tags: List[str] = []

        for attempt in range(MAX_METADATA_ATTEMPTS):
            attempt_issues = list(issues or [])
            metadata_prompt = build_metadata_prompt(
                lang,
                title,
                content_html[:2000],
                category,
                pros,
                cons,
                min_summary_chars=min_summary_chars,
                min_pros=MIN_PROS,
                min_cons=MIN_CONS,
                min_faq=MIN_FAQ,
                issues=attempt_issues if attempt_issues else None,
            )
            metadata = await _translate_with_retry(
                metadata_prompt,
                f"{lang}_metadata",
                _temperature_for(lang, "metadata"),
            )
            if not metadata:
                continue

            summary = normalize_whitespace(str(metadata.get("summary") or ""))
            pros_list = [str(x) for x in metadata.get("pros", []) if x][:20]
            cons_list = [str(x) for x in metadata.get("cons", []) if x][:20]
            faq = _clean_faq(metadata.get("faq"))
            specs = metadata.get("specs") if isinstance(metadata.get("specs"), dict) else {}
            meta_title = normalize_whitespace(str(metadata.get("meta_title") or title))
            meta_description = normalize_whitespace(str(metadata.get("meta_description") or ""))
            og_title = normalize_whitespace(str(metadata.get("og_title") or meta_title))
            og_description = normalize_whitespace(str(metadata.get("og_description") or meta_description))
            slug = str(metadata.get("slug") or title)
            alt_tags = metadata.get("image_alt_tags") if isinstance(metadata.get("image_alt_tags"), list) else []

            insufficient = []
            if len(summary) < min_summary_chars:
                insufficient.append("summary too short")
            if len(pros_list) < MIN_PROS:
                insufficient.append("pros too few or too generic")
            if len(cons_list) < MIN_CONS:
                insufficient.append("cons too few or too generic")
            if len(faq) < MIN_FAQ:
                insufficient.append("faq too few or too short")
            if insufficient and attempt < MAX_METADATA_ATTEMPTS - 1:
                issues = (issues or []) + insufficient
                continue
            break

        if ENABLE_METADATA_POLISH:
            polish_prompt = build_metadata_polish_prompt(
                lang,
                title,
                summary,
                pros_list,
                cons_list,
                faq,
                meta_title,
                meta_description,
                og_title,
                og_description,
                issues=issues,
                min_summary_chars=min_summary_chars,
                min_pros=MIN_PROS,
                min_cons=MIN_CONS,
                min_faq=MIN_FAQ,
            )
            polished = await _translate_with_retry(
                polish_prompt,
                f"{lang}_metadata_polish",
                _temperature_for(lang, "polish"),
            )
            if polished:
                summary = normalize_whitespace(str(polished.get("summary") or summary))
                pros_polished = [str(x) for x in polished.get("pros", []) if x]
                cons_polished = [str(x) for x in polished.get("cons", []) if x]
                faq_polished = _clean_faq(polished.get("faq"))
                if pros_polished:
                    pros_list = pros_polished[:20]
                if cons_polished:
                    cons_list = cons_polished[:20]
                if faq_polished:
                    faq = faq_polished
                meta_title = normalize_whitespace(str(polished.get("meta_title") or meta_title))
                meta_description = normalize_whitespace(str(polished.get("meta_description") or meta_description))
                og_title = normalize_whitespace(str(polished.get("og_title") or og_title))
                og_description = normalize_whitespace(str(polished.get("og_description") or og_description))

        if ENABLE_SENTIMENT_ENRICHMENT:
            try:
                sentiment_prompt = build_sentiment_enrichment_prompt(lang, title, content_html)
                sentiment_data = await _translate_with_retry(
                    sentiment_prompt,
                    f"{lang}_sentiment",
                    _temperature_for(lang, "analysis"),
                ) or {}
                if sentiment_data.get("aspects"):
                    for k, v in sentiment_data["aspects"].items():
                        if isinstance(v, (int, float)):
                            specs[k] = f"{v}/10"
                        else:
                            specs[k] = str(v)
            except Exception as e:
                logger.warning("Sentiment analysis failed for %s: %s", lang, e)

        content_html = _apply_image_alt_tags(content_html, title, alt_tags, logger)

        return {
            "title": title,
            "content_html": content_html,
            "summary": summary,
            "specs": specs,
            "faq": faq,
            "pros": pros_list,
            "cons": cons_list,
            "meta_title": meta_title,
            "meta_description": meta_description,
            "og_title": og_title,
            "og_description": og_description,
            "slug": slug,
        }

    async def _translate_language(
        lang: str,
        title_source: str,
        content_source: str,
        source_lang_name: str,
        category: Optional[str],
        pros: Optional[List[str]],
        cons: Optional[List[str]],
    ) -> Optional[dict]:
        logger.info("Starting translation for language: %s", lang)
        min_content_chars = _min_content_length(lang, content_source)
        qa_issues: List[str] = []
        best_payload: Optional[dict] = None
        translated_title: Optional[str] = None
        translated_content: Optional[str] = None
        base_translated = False

        for attempt in range(MAX_QUALITY_PASSES):
            logger.info("Quality pass %d/%d for %s", attempt + 1, MAX_QUALITY_PASSES, lang)
            if not base_translated:
                temp = min(_temperature_for(lang, "translation") + (0.08 * attempt), 0.7)
                logger.info("Quality pass %d/%d for %s: translating", attempt + 1, MAX_QUALITY_PASSES, lang)
                content_result = await _translate_content(
                    lang,
                    title_source,
                    content_source,
                    category,
                    pros,
                    cons,
                    source_lang_name,
                    min_chars=min_content_chars if min_content_chars > 0 else None,
                    issues=qa_issues if qa_issues else None,
                    temperature=temp,
                )
                if not content_result:
                    logger.warning("Content translation failed for %s, attempting fallback", lang)
                    fallback_prompt = build_translation_prompt(
                        lang,
                        title_ru,
                        content_html_ru,
                        category_name_ru,
                        pros_ru,
                        cons_ru,
                        min_chars=min_content_chars if min_content_chars > 0 else None,
                        issues=qa_issues if qa_issues else None,
                    )
                    fallback_parsed = await _translate_with_retry(
                        fallback_prompt,
                        f"{lang}_fallback_full",
                        _temperature_for(lang, "translation"),
                    )
                    if fallback_parsed:
                        return _normalize_payload(fallback_parsed, lang, fallback_title=title_ru)
                    return None
                translated_title, translated_content = content_result
                base_translated = True
            else:
                logger.info("Quality pass %d/%d for %s: native rewrite", attempt + 1, MAX_QUALITY_PASSES, lang)

            translated_title, translated_content = await _polish_content(
                lang,
                translated_title or title_source,
                translated_content or content_source,
                min_chars=min_content_chars if min_content_chars > 0 else None,
                issues=qa_issues if qa_issues else None,
                temperature=min(_temperature_for(lang, "translation") + 0.1, 0.7) if attempt > 0 else None,
            )
            logger.info("Quality pass %d/%d for %s: metadata", attempt + 1, MAX_QUALITY_PASSES, lang)
            payload = await _generate_metadata(
                lang,
                translated_title or title_source,
                translated_content or content_source,
                category,
                pros,
                cons,
                qa_issues if qa_issues else None,
            )
            best_payload = payload

            translated_len = _text_length(payload.get("content_html", ""))
            if min_content_chars and translated_len < min_content_chars:
                qa_issues = ["content too short", "missing details"]
                if attempt < MAX_QUALITY_PASSES - 1:
                    logger.warning(
                        "Length guard failed for %s (min %d, got %d). Retrying.",
                        lang,
                        min_content_chars,
                        translated_len,
                    )
                    continue

            try:
                logger.info("Quality pass %d/%d for %s: QA", attempt + 1, MAX_QUALITY_PASSES, lang)
                qa_prompt = build_native_quality_prompt(
                    lang,
                    payload.get("title") or translated_title,
                    _sample_for_qa(payload.get("content_html") or translated_content),
                    payload.get("summary") or "",
                    payload.get("pros") or [],
                    payload.get("cons") or [],
                    payload.get("faq") or [],
                    min_content_chars=min_content_chars if min_content_chars > 0 else None,
                )
                qa_raw = await asyncio.to_thread(
                    client.chat_json,
                    QUALITY_SYSTEM_PROMPT,
                    qa_prompt,
                    _temperature_for(lang, "analysis"),
                )
                qa_parsed = await _parse_or_repair(client, qa_raw, logger)
                native_score = float(qa_parsed.get("native_score") or 0)
                fluency_score = float(qa_parsed.get("fluency_score") or 0)
                smell_score = float(qa_parsed.get("translation_smell_score") or 0)
                qa_issues = [str(x) for x in qa_parsed.get("issues", []) if x]
                needs_rewrite = bool(qa_parsed.get("rewrite"))
            except Exception as e:
                logger.warning("QA check failed for %s: %s", lang, e)
                keys_found = [k for k in ["summary", "faq", "specs", "pros", "cons"] if payload.get(k)]
                logger.info("Translation success for %s without QA. Structured data found: %s", lang, keys_found)
                return _normalize_payload(payload, lang, fallback_title=title_ru)

            if (
                native_score >= MIN_NATIVE_SCORE
                and fluency_score >= MIN_FLUENCY_SCORE
                and smell_score >= MIN_TRANSLATION_SMELL_SCORE
                and not needs_rewrite
            ):
                keys_found = [k for k in ["summary", "faq", "specs", "pros", "cons"] if payload.get(k)]
                logger.info("Translation success for %s. Structured data found: %s", lang, keys_found)
                return _normalize_payload(payload, lang, fallback_title=title_ru)

            if attempt < MAX_QUALITY_PASSES - 1:
                logger.warning(
                    "Quality gate failed for %s (pass %d/%d, native=%.1f, fluency=%.1f, smell=%.1f). Retrying with native rewrite.",
                    lang,
                    attempt + 1,
                    MAX_QUALITY_PASSES,
                    native_score,
                    fluency_score,
                    smell_score,
                )
                if not qa_issues:
                    qa_issues = ["literal translation", "unnatural phrasing"]
                continue

        if best_payload:
            keys_found = [k for k in ["summary", "faq", "specs", "pros", "cons"] if best_payload.get(k)]
            logger.info("Translation completed for %s with best-effort payload. Structured data found: %s", lang, keys_found)
            return _normalize_payload(best_payload, lang, fallback_title=title_ru)
        return None

    # 1) English first to keep an optional pivot reference
    try:
        en_result = await _translate_language(
            "en",
            title_ru,
            content_html_ru,
            "Russian",
            category_name_ru,
            pros_ru,
            cons_ru,
        )
        if en_result:
            results["en"] = en_result
            logger.info("English translation successful")
        else:
            logger.error("Failed to generate English translation after all retries")
    except Exception as e:
        logger.error("Failed to generate English translation: %s", e)

    # 2) Process other languages
    other_langs = [l for l in langs if l != "en"]

    async def _do_one(lang: str):
        try:
            if lang in DIRECT_TRANSLATION_LANGS:
                result = await _translate_language(
                    lang,
                    title_ru,
                    content_html_ru,
                    "Russian",
                    category_name_ru,
                    pros_ru,
                    cons_ru,
                )
                if not result and results.get("en"):
                    logger.info("Direct translation failed for %s, trying English pivot", lang)
                    result = await _translate_language(
                        lang,
                        results["en"].get("title", title_ru),
                        results["en"].get("content_html", content_html_ru),
                        "English",
                        category_name_ru,
                        None,
                        None,
                    )
            else:
                if results.get("en"):
                    logger.info("Using English pivot for %s", lang)
                    result = await _translate_language(
                        lang,
                        results["en"].get("title", title_ru),
                        results["en"].get("content_html", content_html_ru),
                        "English",
                        category_name_ru,
                        None,
                        None,
                    )
                else:
                    result = None
                if not result:
                    logger.info("Pivot failed or missing for %s, falling back to Russian", lang)
                    result = await _translate_language(
                        lang,
                        title_ru,
                        content_html_ru,
                        "Russian",
                        category_name_ru,
                        pros_ru,
                        cons_ru,
                    )
            return lang, result
        except Exception as e:
            logger.error("Failed to translate review to %s: %s", lang, e, exc_info=True)
            return lang, None

    if other_langs:
        logger.info("Processing other languages: %s", other_langs)
        items = await asyncio.gather(*[_do_one(l) for l in other_langs])
        for lang, res in items:
            if res:
                results[lang] = res

    logger.info("Translation complete. Languages generated: %s", list(results.keys()))
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
            raw = await asyncio.to_thread(client.chat_json, SYSTEM_PROMPT, prompt, _temperature_for(lang, "translation"))
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
    
    def _contains_cyrillic(text: str) -> bool:
        """Check if text contains Cyrillic characters."""
        if not text:
            return False
        import re
        return bool(re.search(r'[\u0400-\u04FF]', text))
    
    def _is_product_placeholder(name: str) -> bool:
        """Check if product name is a placeholder."""
        if not name:
            return True
        name_lower = name.lower().strip()
        placeholders = [
            "polished",
            "placeholder",
            "natural native",
            "...",
            "<",
            "do not output",
        ]
        for p in placeholders:
            if p in name_lower:
                return True
        if len(name_lower) < 3:
            return True
        return False

    async def _do_one(lang):
        try:
            min_desc_chars = _min_description_length(lang, description_ru or "")
            issues: List[str] = []
            best_payload = None

            for attempt in range(MAX_QUALITY_PASSES):
                # Add explicit Cyrillic fix instruction on retry
                if attempt > 0 and issues:
                    issues.append("CRITICAL: Remove ALL Cyrillic characters - transliterate to Latin")
                    
                prompt = build_product_translation_prompt(
                    lang,
                    name_ru,
                    description_ru,
                    category_name_ru,
                    min_description_chars=min_desc_chars if min_desc_chars > 0 else None,
                    issues=issues if issues else None,
                )
                raw = await asyncio.to_thread(
                    client.chat_json,
                    SYSTEM_PROMPT,
                    prompt,
                    _temperature_for(lang, "translation"),
                )
                parsed = await _parse_or_repair(client, raw, logger)

                name = normalize_whitespace(str(parsed.get("name") or ""))
                
                # Check for placeholder name - retry if invalid
                if _is_product_placeholder(name) or _contains_cyrillic(name):
                    logger.warning("Product translation returned invalid name '%s', will retry", name[:50] if name else "")
                    if attempt < MAX_QUALITY_PASSES - 1:
                        issues = ["product name is placeholder or contains Cyrillic", "translate name properly"]
                        continue
                    else:
                        # Try Google Translate as fallback before transliteration
                        logger.warning("Trying Google Translate for product name '%s'...", name_ru[:50])
                        try:
                            google_name = await asyncio.to_thread(
                                google_translate.translate_text,
                                name_ru,
                                lang,
                                "ru",
                                logger
                            )
                            if google_name and not _is_product_placeholder(google_name) and not _contains_cyrillic(google_name):
                                name = google_name
                                logger.info("Google Translate succeeded for product name: '%s'", name[:50])
                            else:
                                # Last resort - transliterate using slugify
                                name = slugify(name_ru, max_length=80, fallback="Product").replace("-", " ").title()
                                logger.warning("Using transliterated name as fallback: '%s'", name)
                        except Exception as e:
                            logger.error("Google Translate failed for product name: %s", str(e)[:100])
                            name = slugify(name_ru, max_length=80, fallback="Product").replace("-", " ").title()
                            logger.warning("Using transliterated name as fallback: '%s'", name)
                    
                description = normalize_whitespace(str(parsed.get("description") or ""))
                meta_title = normalize_whitespace(str(parsed.get("meta_title") or name))
                meta_description = normalize_whitespace(str(parsed.get("meta_description") or ""))
                slug = create_localized_slug(str(parsed.get("slug") or name), lang, max_length=80, fallback="product")

                if ENABLE_NATIVE_POLISH:
                    polish_prompt = build_product_polish_prompt(
                        lang,
                        name,
                        description,
                        meta_title,
                        meta_description,
                        issues=issues if issues else None,
                        min_description_chars=min_desc_chars if min_desc_chars > 0 else None,
                    )
                    polished_raw = await asyncio.to_thread(
                        client.chat_json,
                        SYSTEM_PROMPT,
                        polish_prompt,
                        _temperature_for(lang, "polish"),
                    )
                    polished = await _parse_or_repair(client, polished_raw, logger)
                    polished_name = normalize_whitespace(str(polished.get("name") or ""))
                    # Only use polished name if it's valid
                    if polished_name and not _is_product_placeholder(polished_name):
                        name = polished_name
                    description = normalize_whitespace(str(polished.get("description") or description))
                    meta_title = normalize_whitespace(str(polished.get("meta_title") or meta_title))
                    meta_description = normalize_whitespace(str(polished.get("meta_description") or meta_description))

                # Final Cyrillic check after polish
                if _contains_cyrillic(name):
                    logger.warning("Product name still contains Cyrillic after polish: '%s'. Attempting transliteration.", 
                                   name[:50])
                    # Transliterate as last resort
                    name = slugify(name, max_length=80, fallback="Product").replace("-", " ").title()
                    if _contains_cyrillic(name):
                        # If still Cyrillic (shouldn't happen with slugify), use generic
                        name = slugify(name_ru, max_length=80, fallback="Product").replace("-", " ").title()
                        logger.error("Forced transliteration for product: '%s'", name)

                if len(meta_description) > 170:
                    meta_description = meta_description[:160].rstrip()
                if not meta_description:
                    meta_description = name[:160]

                # Ensure we never have an empty or Cyrillic name
                if not name or _contains_cyrillic(name):
                    name = slugify(name_ru, max_length=80, fallback="Product").replace("-", " ").title()
                    
                best_payload = {
                    "lang": lang,
                    "name": name,
                    "description": description,
                    "meta_title": meta_title,
                    "meta_description": meta_description,
                    "slug": slug,
                }

                if min_desc_chars and len(description) < min_desc_chars and attempt < MAX_QUALITY_PASSES - 1:
                    issues = ["description too short", "missing details"]
                    continue
                return lang, best_payload

            return lang, best_payload
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
        raw = await asyncio.to_thread(client.chat_json, EXTRACTION_SYSTEM_PROMPT, prompt, 0.2)
        parsed = await _parse_or_repair(client, raw, logger)
        return parsed
    except Exception as e:
        logger.error("AI Extraction failed: %s", e)
        return {}
