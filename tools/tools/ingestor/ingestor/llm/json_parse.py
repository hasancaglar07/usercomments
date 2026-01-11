import json
import re
import ast
from typing import Any, Optional


def parse_json_strict(raw: str) -> Optional[dict]:
    if not raw:
        return None
    
    # Pre-clean: Remove markdown code blocks
    cleaned = raw.strip()
    
    # Handle markdown code blocks
    if "```" in cleaned:
        # Try to extract content between ```json and ``` or just ``` and ```
        parts = cleaned.split("```")
        # Usually parts[1] is the content.
        # If there are multiple blocks, we might need the one that looks like JSON.
        candidate = None
        for i in range(1, len(parts), 2):
            chunk = parts[i].strip()
            if chunk.startswith("json"):
                chunk = chunk[4:].strip()
            # Simple check if it looks like an object
            if chunk.startswith("{") and chunk.endswith("}"):
                candidate = chunk
                break
        
        if candidate:
            cleaned = candidate
        else:
            # Fallback: simple split if the loop didn't find a bounded JSON structure
            # taking the first block is usually the best guess
            if len(parts) >= 2:
                candidate = parts[1]
                if candidate.lstrip().startswith("json"):
                    candidate = candidate.lstrip()[4:]
                cleaned = candidate.strip()

    cleaned = cleaned.strip()
    
    # 1. Try standard parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # 2. Extract outermost braces
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = cleaned[start : end + 1]
    else:
        candidate = cleaned

    # 3. Regex Fixes
    # Fix trailing commas: , followed by ] or }
    candidate = re.sub(r",\s*([\]}])", r"\1", candidate)
    
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # 4. Fallback: Python literal eval
    try:
        # Convert null -> None, true -> True, false -> False
        # Be careful not to replace them inside strings ideally, but this is a rough fallback
        py_candidate = candidate.replace("null", "None").replace("true", "True").replace("false", "False")
        return ast.literal_eval(py_candidate)
    except (ValueError, SyntaxError, MemoryError, RecursionError):
        pass

    # 5. Fallback for single-key JSON with unescaped quotes or newlines (common in LLM output)
    # Example: {"translated_text": "<div class="foo">...</div>"}
    # Capture key group 1, value group 2
    match = re.match(r'^\s*\{\s*"([^"]+)"\s*:\s*"(.*)"\s*\}\s*$', cleaned, re.DOTALL)
    if match:
        key = match.group(1)
        content = match.group(2)
        
        # Escape unescaped double quotes
        # Use a simplified approach: Replace " with \" unless it's already escaped
        # We match any " that is preceded by \ (negative lookbehind)
        content_fixed = re.sub(r'(?<!\\)"', r'\\"', content)
        
        # Escape literal control characters which are invalid in JSON strings
        content_fixed = content_fixed.replace('\n', '\\n').replace('\r', '').replace('\t', '\\t')

        try:
             return json.loads(f'{{"{key}": "{content_fixed}"}}')
        except json.JSONDecodeError:
             pass

    # 6. Salvage large HTML payloads when JSON is missing closing brace or has trailing junk.
    match = re.search(r'"(translated_text|content_html)"\s*:\s*"', cleaned)
    if match:
        key = match.group(1)
        content = cleaned[match.end():].strip()
        if content.endswith("}"):
            content = re.sub(r'"\s*}\s*$', '', content, flags=re.DOTALL).strip()
        content_fixed = re.sub(r'(?<!\\)"', r'\\"', content)
        content_fixed = content_fixed.replace('\n', '\\n').replace('\r', '').replace('\t', '\\t')
        try:
            return json.loads(f'{{"{key}": "{content_fixed}"}}')
        except json.JSONDecodeError:
            pass

    return None
