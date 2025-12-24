import re
from typing import Iterable

from bs4 import BeautifulSoup

_ALLOWED_TAGS = {
    "p",
    "br",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "a",
    "blockquote",
    "div",
    "h2",
    "h3",
    "h4",
}

_ALLOWED_ATTRS = {
    "a": {"href", "title", "rel", "target"},
    "div": {"class"},
}

_REMOVE_TAGS = {"script", "style", "noscript", "iframe"}


def _strip_empty_tags(soup: BeautifulSoup) -> None:
    # Use a list to avoid modifying the tree while iterating
    tags = soup.find_all(True)
    for tag in tags:
        # Check if tag is still in the tree
        if not tag.parent:
            continue
            
        if tag.name in _REMOVE_TAGS:
            tag.decompose()
            continue
            
        if tag.name not in _ALLOWED_TAGS:
            tag.unwrap()
            continue
            
        allowed_attrs = _ALLOWED_ATTRS.get(tag.name, set())
        tag.attrs = {k: v for k, v in tag.attrs.items() if k in allowed_attrs}



def clean_html(html: str) -> str:
    if not html:
        return ""
    soup = BeautifulSoup(html, "lxml")
    _strip_empty_tags(soup)

    root = soup.body if soup.body else soup
    parts: Iterable[str] = (str(child) for child in root.contents)
    return "".join(parts).strip()


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()
