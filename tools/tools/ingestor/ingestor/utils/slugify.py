import re
import unicodedata
from typing import Optional

from .hashing import short_hash

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
    out = []
    for ch in text:
        lower = ch.lower()
        if lower in _CYRILLIC_MAP:
            mapped = _CYRILLIC_MAP[lower]
            out.append(mapped)
        else:
            out.append(ch)
    return "".join(out)


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
