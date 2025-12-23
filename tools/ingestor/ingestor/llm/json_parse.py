import json
from typing import Any, Optional


def parse_json_strict(raw: str) -> Optional[dict]:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    candidate = raw[start : end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None
