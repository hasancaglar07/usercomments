import json
import re
import ast
from typing import Any, Optional


def parse_json_strict(raw: str) -> Optional[dict]:
    if not raw:
        return None
    
    # Pre-clean: Remove markdown code blocks
    cleaned = raw.strip()
    if "```" in cleaned:
        # Match anything between ```json and ``` or just ``` and ```
        # Use simple split approach which is often more robust than complex regex for this specific case
        parts = cleaned.split("```")
        # Usually parts[1] is the content, parts[0] is empty or text before
        if len(parts) >= 3:
            # parts[1] might be "json\n{...}"
            candidate = parts[1]
            if candidate.lstrip().startswith("json"):
                candidate = candidate.lstrip()[4:]
            cleaned = candidate
        else:
            # Fallback cleanup for simple code blocks if split method yielded weird results
            lines = cleaned.splitlines()
            if lines[0].strip().startswith("```") and lines[-1].strip().startswith("```"):
                cleaned = "\n".join(lines[1:-1])

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
    # Fix trailing commas
    candidate = re.sub(r",\s*([\]}])", r"\1", candidate)
    
    # Fix unescaped newlines inside strings (simple heuristic)
    # This is risky but often needed for HTML content. 
    # Better to NOT do aggressive regex on content if we can avoid it.
    
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # 4. Fallback: Python literal eval (often LLMs output Python dicts with single quotes or True/False)
    try:
        # Convert null to None, true to True, false to False for python eval
        py_candidate = candidate.replace("null", "None").replace("true", "True").replace("false", "False")
        return ast.literal_eval(py_candidate)
    except (ValueError, SyntaxError):
        pass

    # 5. Fallback for single-key JSON with unescaped quotes or newlines (common in LLM output)
    # Example: {"translated_text": "<div class="foo">...</div>"}
    # We capture the key and the content, then manually escape quotes and newlines.
    match = re.match(r'^\s*\{\s*"([^"]+)"\s*:\s*"(.*)"\s*\}\s*$', cleaned, re.DOTALL)
    if match:
        key = match.group(1)
        content = match.group(2)
        
        # Fix 1: Escape unescaped double quotes to \"
        # We match any " that is preceded by \ (negative lookbehind)
        content_fixed = re.sub(r'(?<!\\)"', r'\\"', content)
        
        # Fix 2: Escape literal control characters which are invalid in JSON strings
        content_fixed = content_fixed.replace('\n', '\\n').replace('\r', '').replace('\t', '\\t')

        try:
             return json.loads(f'{{"{key}": "{content_fixed}"}}')
        except json.JSONDecodeError:
             pass

    return None
