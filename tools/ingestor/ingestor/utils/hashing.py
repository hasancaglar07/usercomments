import hashlib


def sha1_text(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def sha1_bytes(data: bytes) -> str:
    return hashlib.sha1(data).hexdigest()


def short_hash(text: str, length: int = 8) -> str:
    return sha1_text(text)[:length]
