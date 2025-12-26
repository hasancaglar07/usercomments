import random
from typing import Optional


def sleep_jitter(min_seconds: int, max_seconds: int, label: Optional[str] = None) -> float:
    if max_seconds < min_seconds:
        max_seconds = min_seconds
    return random.uniform(min_seconds, max_seconds)
