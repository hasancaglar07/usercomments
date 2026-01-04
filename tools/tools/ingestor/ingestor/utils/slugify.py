import re
import unicodedata
from typing import Optional

from .hashing import short_hash

# Cyrillic character range for detection
_CYRILLIC_RANGE = range(0x0400, 0x04FF + 1)

# Cyrillic transliteration map using unicode escapes to keep files ASCII-only.
_CYRILLIC_MAP = {
    "\u0430": "a",
    "\u0431": "b",
    "\u0432": "v",
    "\u0433": "g",
    "\u0434": "d",
    "\u0435": "e",
    "\u0451": "e",
    "\u0436": "zh",
    "\u0437": "z",
    "\u0438": "i",
    "\u0439": "i",
    "\u043a": "k",
    "\u043b": "l",
    "\u043c": "m",
    "\u043d": "n",
    "\u043e": "o",
    "\u043f": "p",
    "\u0440": "r",
    "\u0441": "s",
    "\u0442": "t",
    "\u0443": "u",
    "\u0444": "f",
    "\u0445": "h",
    "\u0446": "ts",
    "\u0447": "ch",
    "\u0448": "sh",
    "\u0449": "sh",
    "\u044a": "",
    "\u044b": "y",
    "\u044c": "",
    "\u044d": "e",
    "\u044e": "yu",
    "\u044f": "ya",
}


def _transliterate(text: str) -> str:
    """Transliterate Cyrillic characters to Latin equivalents."""
    out = []
    for ch in text:
        lower = ch.lower()
        if lower in _CYRILLIC_MAP:
            mapped = _CYRILLIC_MAP[lower]
            out.append(mapped)
        else:
            out.append(ch)
    return "".join(out)


def contains_cyrillic(text: str) -> bool:
    """Check if text contains any Cyrillic characters."""
    if not text:
        return False
    return any(ord(ch) in _CYRILLIC_RANGE for ch in text)


def transliterate_name(text: str) -> str:
    """Transliterate Cyrillic text to Latin for product names (preserves spaces and structure)."""
    if not text:
        return text
    if not contains_cyrillic(text):
        return text
    result = _transliterate(text)
    # Clean up but preserve spaces and some structure
    result = result.strip()
    return result if result else text


def slugify(text: str, max_length: int = 80, fallback: Optional[str] = None) -> str:
    if not text:
        base = fallback or "item"
        return f"{base}-{short_hash(base)}"

    text = _transliterate(text)
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")

    if max_length and len(text) > max_length:
        text = text[:max_length].rstrip("-")

    if not text:
        base = fallback or "item"
        return f"{base}-{short_hash(base)}"

    return text


def latinize_text(text: str) -> str:
    """
    Convert text to pure Latin characters by transliterating Cyrillic
    and removing diacritics.
    """
    if not text:
        return ""
    result = _transliterate(text)
    result = unicodedata.normalize("NFKD", result)
    result = result.encode("ascii", "ignore").decode("ascii")
    return result


# Common Russian word patterns that appear after transliteration
_RUSSIAN_TRANSLITERATED_PATTERNS = [
    r"\bsprei\b",       # спрей (spray)
    r"\btabletk[ai]\b", # таблетки (tablets)
    r"\bkrem\b",        # крем (cream)
    r"\bmaslo\b",       # масло (oil)
    r"\bshampun\b",     # шампунь (shampoo)
    r"\bmaska\b",       # маска (mask)
    r"\bserum\b",       # сыворотка (serum - same in both)
    r"\bgel\b",         # гель (gel)
    r"\bbalzam\b",      # бальзам (balm)
    r"\bloson\b",       # лосьон (lotion)
    r"\bkosmetik[ai]?\b", # косметика (cosmetics)
    r"\bzdorov[ey]?\b", # здоровье (health)
    r"\bkrasot[ay]?\b", # красота (beauty)
    r"\botzyv[yi]?\b",  # отзывы (reviews)
    r"\bobzor\b",       # обзор (review)
    r"\btest\b",        # тест (test)
    r"\bpomad[ay]?\b",  # помада (lipstick)
    r"\btush\b",        # тушь (mascara)
    r"\bpudr[ay]?\b",   # пудра (powder)
    r"\brumyan[ay]?\b", # румяна (blush)
    r"\bkonsiler\b",    # консилер (concealer)
    r"\bfond?(?:an)?t?\b", # фонд/фондан (fond/fondant - makeup term from context)
]

_RUSSIAN_PATTERN_RE = re.compile(
    "|".join(_RUSSIAN_TRANSLITERATED_PATTERNS),
    re.IGNORECASE
)


def looks_like_transliterated_russian(text: str) -> bool:
    """
    Check if text looks like transliterated Russian (Latin characters but
    Russian words). This catches cases like "Grammidin s anestetikom" which
    is Russian transliterated to Latin.
    """
    if not text:
        return False
    
    # If it still has Cyrillic, it's not transliterated
    if contains_cyrillic(text):
        return False
    
    latinized = latinize_text(text).lower()
    if not latinized:
        return False
    
    # Check for common Russian transliterated patterns
    if _RUSSIAN_PATTERN_RE.search(latinized):
        return True
    
    # Check for common Russian word endings that survive transliteration
    # -stvo, -nost, -tel, -nie, -tsy, etc.
    russian_endings = [
        "stvo", "nost", "tel", "nie", "tsy", "tsi", "ski", "skiy",
        "skaya", "ovich", "evich", "ovna", "evna", "chik", "shchik",
        "nik", "ik", "ok", "ek", "yuk", "chuk", "enko", "ova", "eva"
    ]
    words = latinized.split()
    russian_word_count = 0
    for word in words:
        word_clean = re.sub(r"[^a-z]", "", word)
        if len(word_clean) >= 4:
            for ending in russian_endings:
                if word_clean.endswith(ending) and len(word_clean) > len(ending) + 2:
                    russian_word_count += 1
                    break
    
    # If more than 30% of words look Russian, flag it
    if words and russian_word_count / len(words) >= 0.3:
        return True
    
    return False
