import logging
import json
from typing import Dict, List, Optional
from .groq_client import GroqClient

async def match_category_ai(
    groq: GroqClient,
    target_category_name: str,
    available_categories: Dict[str, int],  # Name -> ID
    logger: logging.Logger
) -> Optional[int]:
    """
    Uses AI to find the best match for 'target_category_name' within 'available_categories'.
    Returns the ID of the matched category, or None.
    """
    
    # Prepare a simplified list of candidates for the AI
    # We send a list of names. 
    # To save tokens, maybe just send names.
    candidates = list(available_categories.keys())
    
    if not candidates:
        return None

    prompt = f"""
    You are an intelligent category matching assistant.
    
    Task: Match the target category (which may be in Russian) to the most appropriate category from the provided list (which may be in English, Turkish, etc).
    
    Target Category: "{target_category_name}"
    
    Available Categories List:
    {json.dumps(candidates, ensure_ascii=False)}
    
    Instructions:
    1. Analyze the semantic meaning of the Target Category.
    2. Find the single best match in the Available Categories List.
    3. Return ONLY the JSON object with the matched category name from the list. 
       Format: {{"matched_name": "Exact Name From List"}}
    4. If absolutely no semantic match exists, return {{"matched_name": null}}
    5. Do not output any explanation, only the JSON.
    """

    try:
        import asyncio
        response = await asyncio.to_thread(
            groq.chat,
            messages=[
                {"role": "system", "content": "You are a precise JSON classifier."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0
        )
        
        if not response:
            return None
            
        # Clean response (remove markdown code blocks if present)
        clean_resp = response.replace("```json", "").replace("```", "").strip()
        
        data = json.loads(clean_resp)
        matched_name = data.get("matched_name")
        
        if matched_name and matched_name in available_categories:
            logger.info("AI MATCHED: '%s' -> '%s'", target_category_name, matched_name)
            return available_categories[matched_name]
        
        logger.warning("AI could not find a suitable match for: %s", target_category_name)
        return None

    except Exception as e:
        logger.error("AI category matching failed: %s", e)
        return None
