"""
Google Translate API client for fallback translations.
Used when Groq LLM translation fails.
"""
import logging
import requests
from typing import Optional

# Google Cloud Translation API key
GOOGLE_TRANSLATE_API_KEY = "AIzaSyDB3JSeNAXnmkh66zasTl9xgkqfc1XSyf4"
GOOGLE_TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2"

# Language code mapping (our codes -> Google Translate codes)
LANG_CODE_MAP = {
    "en": "en",
    "tr": "tr",
    "de": "de",
    "es": "es",
    "fr": "fr",
    "it": "it",
    "pt": "pt",
    "nl": "nl",
    "ru": "ru",
}


def translate_text(
    text: str,
    target_lang: str,
    source_lang: str = "ru",
    logger: Optional[logging.Logger] = None,
) -> Optional[str]:
    """
    Translate text using Google Translate API.
    
    Args:
        text: Text to translate
        target_lang: Target language code (e.g., 'en', 'tr', 'de')
        source_lang: Source language code (default: 'ru' for Russian)
        logger: Optional logger instance
        
    Returns:
        Translated text or None if translation fails
    """
    if not text or not text.strip():
        return text
        
    log = logger or logging.getLogger(__name__)
    
    try:
        # Map our language codes to Google's codes
        target = LANG_CODE_MAP.get(target_lang, target_lang)
        source = LANG_CODE_MAP.get(source_lang, source_lang)
        
        payload = {
            "key": GOOGLE_TRANSLATE_API_KEY,
            "q": text,
            "source": source,
            "target": target,
            "format": "text",
        }
        
        response = requests.post(
            GOOGLE_TRANSLATE_URL,
            data=payload,
            timeout=30,
        )
        
        if response.status_code == 200:
            data = response.json()
            translations = data.get("data", {}).get("translations", [])
            if translations:
                translated = translations[0].get("translatedText", "")
                if translated:
                    log.info("Google Translate: Successfully translated to %s (%d chars)", 
                             target_lang, len(translated))
                    return translated
                    
        log.warning("Google Translate API returned status %d: %s", 
                   response.status_code, response.text[:200])
        return None
        
    except requests.exceptions.Timeout:
        log.error("Google Translate API timeout")
        return None
    except requests.exceptions.RequestException as e:
        log.error("Google Translate API request failed: %s", str(e)[:100])
        return None
    except Exception as e:
        log.error("Google Translate unexpected error: %s", str(e)[:100])
        return None


def translate_title(
    title: str,
    target_lang: str,
    source_lang: str = "ru",
    logger: Optional[logging.Logger] = None,
) -> Optional[str]:
    """Translate a title using Google Translate."""
    return translate_text(title, target_lang, source_lang, logger)


def translate_html_content(
    html_content: str,
    target_lang: str,
    source_lang: str = "ru",
    logger: Optional[logging.Logger] = None,
) -> Optional[str]:
    """
    Translate HTML content using Google Translate.
    Note: Google Translate preserves HTML tags when format is 'html'.
    """
    if not html_content or not html_content.strip():
        return html_content
        
    log = logger or logging.getLogger(__name__)
    
    try:
        target = LANG_CODE_MAP.get(target_lang, target_lang)
        source = LANG_CODE_MAP.get(source_lang, source_lang)
        
        payload = {
            "key": GOOGLE_TRANSLATE_API_KEY,
            "q": html_content,
            "source": source,
            "target": target,
            "format": "html",  # Preserve HTML tags
        }
        
        response = requests.post(
            GOOGLE_TRANSLATE_URL,
            data=payload,
            timeout=60,  # Longer timeout for HTML content
        )
        
        if response.status_code == 200:
            data = response.json()
            translations = data.get("data", {}).get("translations", [])
            if translations:
                translated = translations[0].get("translatedText", "")
                if translated:
                    log.info("Google Translate: HTML translated to %s (%d chars)", 
                             target_lang, len(translated))
                    return translated
                    
        log.warning("Google Translate HTML API returned status %d", response.status_code)
        return None
        
    except Exception as e:
        log.error("Google Translate HTML error: %s", str(e)[:100])
        return None


def translate_batch(
    texts: list,
    target_lang: str,
    source_lang: str = "ru",
    logger: Optional[logging.Logger] = None,
) -> list:
    """
    Translate multiple texts in a single API call (more efficient).
    
    Args:
        texts: List of texts to translate
        target_lang: Target language code
        source_lang: Source language code
        logger: Optional logger
        
    Returns:
        List of translated texts (same order as input)
    """
    if not texts:
        return []
        
    log = logger or logging.getLogger(__name__)
    
    # Filter empty texts but keep track of positions
    non_empty = [(i, t) for i, t in enumerate(texts) if t and t.strip()]
    if not non_empty:
        return texts
    
    try:
        target = LANG_CODE_MAP.get(target_lang, target_lang)
        source = LANG_CODE_MAP.get(source_lang, source_lang)
        
        payload = {
            "key": GOOGLE_TRANSLATE_API_KEY,
            "q": [t for _, t in non_empty],
            "source": source,
            "target": target,
            "format": "text",
        }
        
        response = requests.post(
            GOOGLE_TRANSLATE_URL,
            data=payload,
            timeout=60,
        )
        
        if response.status_code == 200:
            data = response.json()
            translations = data.get("data", {}).get("translations", [])
            
            # Build result list
            result = list(texts)  # Copy original
            for (orig_idx, _), trans in zip(non_empty, translations):
                translated = trans.get("translatedText", "")
                if translated:
                    result[orig_idx] = translated
                    
            log.info("Google Translate: Batch translated %d items to %s", 
                     len(translations), target_lang)
            return result
            
        log.warning("Google Translate batch API returned status %d", response.status_code)
        return texts  # Return original on failure
        
    except Exception as e:
        log.error("Google Translate batch error: %s", str(e)[:100])
        return texts  # Return original on failure
