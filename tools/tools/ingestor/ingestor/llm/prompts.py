from typing import List, Optional

# Language-specific tone and style guidelines
LANGUAGE_STYLES = {
    "en": {
        "name": "English",
        "tone": "casual, relatable, and conversational",
        "style": "Write as if you're a friendly neighbor sharing their honest experience. Use contractions (I'm, don't, it's), everyday vocabulary, and occasional humor. Be direct but warm. Americans appreciate honesty and practical insights.",
        "example_phrases": "I gotta say, Here's the deal, Not gonna lie, Game changer, Worth every penny, Total letdown",
    },
    "tr": {
        "name": "Turkish", 
        "tone": "samimi, sıcak ve arkadaşça",
        "style": "Sanki yakın bir arkadaşına deneyimini anlatıyormuş gibi yaz. Günlük konuşma dilini kullan, resmi olma. 'Ben şahsen', 'Vallahi', 'Bak şimdi' gibi ifadeler kullanabilirsin. Türk okuyucular samimiyete ve gerçekçiliğe değer verir. Abartılı satış diline kaçma.",
        "example_phrases": "Açıkçası, Şunu söyleyeyim, Vallahi, Bence, Yani kısacası, Tam bir hayal kırıklığı, Kesinlikle tavsiye ederim",
    },
    "de": {
        "name": "German",
        "tone": "sachlich, vertrauenswürdig und gründlich",
        "style": "Schreibe wie ein erfahrener Nutzer, der seine ehrliche Meinung teilt. Deutsche Leser schätzen detaillierte Informationen und faktenbasierte Bewertungen. Sei präzise aber nicht steif. Verwende gelegentlich umgangssprachliche Ausdrücke um authentisch zu wirken.",
        "example_phrases": "Ehrlich gesagt, Was mich überzeugt hat, Das muss ich sagen, Fazit, Mein Tipp, Definitiv empfehlenswert",
    },
    "es": {
        "name": "Spanish",
        "tone": "expresivo, apasionado y cercano",
        "style": "Escribe como si estuvieras hablando con un amigo en un café. Los hispanohablantes aprecian la calidez y la emoción genuina. Usa expresiones coloquiales, ¡signos de exclamación!, y transmite tu entusiasmo o frustración real. Sé auténtico y personal.",
        "example_phrases": "¡Ojo con esto!, La verdad es que, Para ser sincero/a, ¡Me encanta!, Qué decepción, Totalmente recomendado",
    },
}

SYSTEM_PROMPT = (
    "You are an expert content localizer and native-level copywriter. "
    "Your job is NOT to translate - it's to RECREATE content as if a native speaker wrote it originally. "
    "The output must feel 100% authentic, human, and natural - never robotic or 'translated'. "
    "Always output a single JSON object that matches the requested schema. "
    "Do not include commentary or extra keys."
)

EXTRACTION_SYSTEM_PROMPT = (
    "You are an expert data extractor. Your task is to extract product review details from provided text. "
    "Output only a single valid JSON object. Do not include any explanation."
)

def build_translation_prompt(
    lang: str,
    title_ru: str,
    content_html_ru: str,
    category_name_ru: Optional[str],
    pros_ru: Optional[List[str]] = None,
    cons_ru: Optional[List[str]] = None,
) -> str:
    category_line = category_name_ru or ""
    pros_line = ", ".join(pros_ru) if pros_ru else "None"
    cons_line = ", ".join(cons_ru) if cons_ru else "None"
    
    # Get language-specific style guide
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
    
    return (
        f"You are a native {style_info['name']} content creator who writes authentic product reviews.\n\n"
        f"🎯 YOUR MISSION: Recreate this Russian review in {style_info['name']} as if YOU personally wrote it.\n"
        f"This is NOT translation - it's LOCALIZATION. The final text must feel 100% native and human.\n\n"
        
        f"📝 TONE & STYLE FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Style: {style_info['style']}\n"
        f"- Example phrases to use: {style_info['example_phrases']}\n\n"
        
        f"Context Category: {category_line}\n"
        f"Input Pros: {pros_line}\n"
        f"Input Cons: {cons_line}\n\n"
        
        "Input Data (Russian - just for reference, don't translate literally):\n"
        "{\n"
        f"  \"title_ru\": {title_ru!r},\n"
        f"  \"content_html_ru\": {content_html_ru!r}\n"
        "}\n\n"
        
        "🚨 CRITICAL RULES:\n"
        "1. REWRITE, DON'T TRANSLATE: Read the Russian, understand the meaning, then write fresh content in your own words.\n"
        "2. SOUND HUMAN: Use natural speech patterns, contractions, and expressions native speakers actually use.\n"
        "3. KEEP THE STORY: Preserve all personal experiences, specific details, and the reviewer's genuine opinions.\n"
        "4. NO AI SMELL: Avoid robotic phrases like 'It is worth noting', 'One thing to mention', 'In conclusion'.\n"
        "5. BE AUTHENTIC: Write as if you're sharing with a friend, not writing a formal report.\n\n"
        
        "📋 Content Structure:\n"
        "- content_html: The review body ONLY. Use semantic HTML (h3, h4, p, strong, ul, li).\n"
        "- summary: 3-5 sentence expert opinion in the same natural voice.\n"
        "- pros: At least 5 advantages, written naturally (not 'High quality' but 'The quality is actually impressive').\n"
        "- cons: At least 5 disadvantages, honest and specific.\n"
        "- faq: 4-6 questions real people would ask, with helpful answers.\n"
        "- specs: Technical specifications if mentioned (empty object if none).\n\n"
        
        "Output JSON schema (MANDATORY):\n"
        "{\n"
        "  \"title\": \"Catchy, click-worthy title\",\n"
        "  \"content_html\": \"Your rewritten review in natural voice\",\n"
        "  \"summary\": \"Expert opinion summary\",\n"
        "  \"specs\": {},\n"
        "  \"faq\": [{\"question\": \"...\", \"answer\": \"...\"}],\n"
        "  \"pros\": [\"Natural-sounding advantage\"],\n"
        "  \"cons\": [\"Honest disadvantage\"],\n"
        "  \"meta_title\": \"SEO title (max 60 chars)\",\n"
        "  \"meta_description\": \"Compelling description (max 160 chars)\",\n"
        "  \"og_title\": \"Social share title\",\n"
        "  \"og_description\": \"Social share description\",\n"
        "  \"slug\": \"url-friendly-keywords\"\n"
        "}\n\n"
        
        "Technical Rules:\n"
        "- Keep brand names and model numbers exactly as in source.\n"
        "- Output ONLY raw JSON. No markdown code blocks.\n"
        "- Escape all double quotes within strings.\n"
        "- Ensure strictly valid JSON syntax."
    )



def build_pivot_translation_prompt(lang: str, en_data: dict) -> str:
    # Get language-specific style guide
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
    
    # Use only relevant fields to reduce context size
    source_json = {
        "title": en_data.get("title"),
        "content_html": en_data.get("content_html"),
        "summary": en_data.get("summary"),
        "pros": en_data.get("pros"),
        "cons": en_data.get("cons"),
        "faq": en_data.get("faq"),
        "specs": en_data.get("specs"),
    }
    
    return (
        f"You are a native {style_info['name']} content creator who writes authentic product reviews.\n\n"
        f"🎯 YOUR MISSION: Rewrite this English content in {style_info['name']} as if YOU originally wrote it.\n"
        f"This is NOT translation - it's LOCALIZATION. The text must feel 100% native and human.\n\n"
        
        f"📝 TONE & STYLE FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Style: {style_info['style']}\n"
        f"- Use phrases like: {style_info['example_phrases']}\n\n"
        
        "Input JSON (English - use as reference, don't translate literally):\n"
        f"{source_json}\n\n"
        
        "🚨 CRITICAL RULES:\n"
        "1. REWRITE in your own words - don't just swap words from English.\n"
        "2. SOUND HUMAN: Use natural speech patterns native speakers actually use.\n"
        "3. AVOID AI PHRASES: No 'It is worth noting', 'In conclusion', 'One thing to mention'.\n"
        "4. BE AUTHENTIC: Write as if sharing with a friend, not writing a report.\n"
        "5. KEEP ALL DETAILS: Preserve personal experiences, specific facts, and opinions.\n\n"
        
        "Output JSON schema:\n"
        "{\n"
        "  \"title\": \"Catchy title in natural voice\",\n"
        "  \"content_html\": \"Your rewritten content - must sound native\",\n"
        "  \"summary\": \"Natural expert opinion\",\n"
        "  \"specs\": {\"Key\": \"Value\"},\n"
        "  \"faq\": [{\"question\": \"...\", \"answer\": \"...\"}],\n"
        "  \"pros\": [\"Natural-sounding advantages\"],\n"
        "  \"cons\": [\"Honest disadvantages\"],\n"
        "  \"meta_title\": \"SEO title (max 60 chars)\",\n"
        "  \"meta_description\": \"Compelling description (max 160 chars)\",\n"
        "  \"slug\": \"url-friendly-keywords\"\n"
        "}\n\n"
        
        "Technical Rules:\n"
        "- Keep brand names exactly as in source.\n"
        "- Output ONLY raw JSON. No markdown.\n"
        "- Ensure valid JSON syntax."
    )


def build_repair_prompt(raw_output: str) -> str:
    return (
        "Your previous response was invalid JSON. "
        "Fix the syntax errors (missing brackets, unescaped quotes, trailing commas).\n"
        "Return ONLY a valid raw JSON object. NO markdown formatting.\n\n"
        "Invalid output:\n"
        f"{raw_output}\n"
    )

def build_category_translation_prompt(lang: str, category_name_ru: str) -> str:
    return (
        "Translate Russian category name into the target language and generate a slug.\n"
        f"Target language: {lang}\n"
        f"Category (Russian): {category_name_ru}\n\n"
        "Output JSON schema (no extra keys):\n"
        "{\n"
        "  \"name\": \"...\",\n"
        "  \"slug\": \"...\"\n"
        "}\n\n"
        "Rules:\n"
        "- Natural translation.\n"
        "- slug must be lowercase, hyphenated, latin only, max 50 chars.\n"
        "- Output only the JSON object."
    )


def build_product_translation_prompt(
    lang: str,
    name_ru: str,
    description_ru: Optional[str],
    category_name_ru: Optional[str],
) -> str:
    category_line = category_name_ru or ""
    description_line = description_ru or ""
    return (
        "Translate Russian product name/description into the target language and generate SEO fields.\n"
        f"Target language: {lang}\n"
        f"Category (Russian): {category_line}\n\n"
        "Input JSON:\n"
        "{\n"
        f"  \"name_ru\": {name_ru!r},\n"
        f"  \"description_ru\": {description_line!r}\n"
        "}\n\n"
        "Output JSON schema (no extra keys):\n"
        "{\n"
        "  \"name\": \"...\",\n"
        "  \"description\": \"...\",\n"
        "  \"meta_title\": \"...\",\n"
        "  \"meta_description\": \"...\",\n"
        "  \"slug\": \"...\"\n"
        "}\n\n"
        "Rules:\n"
        "- Natural translation.\n"
        "- Keep brand/product names as-is.\n"
        "- Description should be short and neutral; do not invent specs.\n"
        "- meta_description should be about 150-160 characters.\n"
        "- slug must be lowercase, hyphenated, latin only, max 80 chars.\n"
        "- Output only the JSON object."
    )
def build_extraction_prompt(text: str) -> str:
    return (
        "You are an expert data analyst and content extractor. Analyze the following raw webpage text and extract a high-quality review dataset.\n\n"
        "Text Context:\n"
        f"{text[:15000]}\n\n"
        "Extraction Tasks:\n"
        "1. TITLE: Extract the specific review title.\n"
        "2. CONTENT: Extract the full body of the review. Clean up any boilerplate but keep the human narrative. Preserve basic structure.\n"
        "3. PROS & CONS: Identify at least 3 pros and 3 cons mentioned in the text. If not explicitly listed, infer them from the sentiment.\n"
        "4. PRODUCT INFO: Identify the product name, its main category, and its specific subcategory.\n"
        "5. RATING: Find the star rating (usually 1 to 5).\n\n"
        "Output JSON schema:\n"
        "{\n"
        "  \"title\": \"...\",\n"
        "  \"content_html\": \"...\",\n"
        "  \"rating\": 5.0,\n"
        "  \"pros\": [\"...\", ...],\n"
        "  \"cons\": [\"...\", ...],\n"
        "  \"product_name\": \"...\",\n"
        "  \"category_name\": \"...\",\n"
        "  \"subcategory_name\": \"...\"\n"
        "}\n\n"
        "Rules:\n"
        "- If a specific piece of info is missing, use your best inference from the context.\n"
        "- Ensure the content_html is clean but comprehensive.\n"
        "- Output ONLY JSON."
    )


def build_chunked_translation_prompt(lang: str, chunk: str, chunk_num: int, total_chunks: int) -> str:
    """Build prompt for translating a single chunk of content."""
    # Get language-specific style guide
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES.get("en", {"name": lang.upper(), "tone": "natural", "style": "Write naturally"}))
    
    return (
        f"You are a native {style_info['name']} content creator rewriting a product review.\n"
        f"This is chunk {chunk_num} of {total_chunks}.\n\n"
        
        f"📝 STYLE FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Write as if YOU experienced this personally\n\n"
        
        "🚨 CRITICAL RULES:\n"
        "1. REWRITE in natural language - don't do word-for-word translation.\n"
        "2. PRESERVE all personal experiences, specific details, and opinions.\n"
        "3. KEEP all HTML tags exactly as they are (<p>, <strong>, <h3>, etc.).\n"
        "4. SOUND HUMAN: Use expressions native speakers actually use.\n"
        "5. AVOID AI PHRASES: No 'It is worth noting', 'In conclusion', 'One must consider'.\n"
        "6. Keep brand names, product names, and numbers unchanged.\n\n"
        
        "Content to rewrite:\n"
        f"{chunk}\n\n"
        
        "Output JSON schema:\n"
        "{\n"
        "  \"translated_text\": \"<your rewritten HTML content in natural voice>\"\n"
        "}\n\n"
        
        "Technical rules:\n"
        "- Output ONLY the JSON object, no markdown.\n"
        "- Ensure valid JSON syntax.\n"
        "- The content must be complete - do not truncate."
    )


def build_metadata_prompt(lang: str, title: str, content_preview: str, category: Optional[str], pros: Optional[List[str]], cons: Optional[List[str]]) -> str:
    """Build prompt for generating SEO metadata, FAQs, and pros/cons in target language."""
    # Get language-specific style guide  
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES.get("en", {"name": lang.upper(), "tone": "natural", "style": "Write naturally", "example_phrases": ""}))
    
    pros_line = ", ".join(pros) if pros else "None provided"
    cons_line = ", ".join(cons) if cons else "None provided"
    
    return (
        f"You are a native {style_info['name']} content creator writing authentic product review metadata.\n\n"
        
        f"📝 STYLE FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Use phrases like: {style_info.get('example_phrases', '')}\n\n"
        
        f"Review Context:\n"
        f"- Title: {title}\n"
        f"- Category: {category or 'General'}\n"
        f"- Content Preview: {content_preview[:1200]}...\n"
        f"- Original Pros: {pros_line}\n"
        f"- Original Cons: {cons_line}\n\n"
        
        "🚨 CRITICAL RULES:\n"
        "1. WRITE NATURALLY: Everything must sound like a real person wrote it.\n"
        "2. AVOID AI PHRASES: No 'It is worth noting', 'In terms of', 'One must consider'.\n"
        "3. BE SPECIFIC: Pros/cons should be specific observations, not generic statements.\n"
        "4. SOUND AUTHENTIC: Write as if sharing honest opinions with a friend.\n\n"
        
        "Output JSON schema:\n"
        "{\n"
        f"  \"title\": \"Catchy, engaging title in {style_info['name']}\",\n"
        "  \"summary\": \"3-5 sentence expert opinion in natural voice\",\n"
        "  \"pros\": [\"Specific advantage 1\", \"Specific advantage 2\", ...at least 5],\n"
        "  \"cons\": [\"Honest disadvantage 1\", \"Honest disadvantage 2\", ...at least 5],\n"
        "  \"faq\": [{\"question\": \"Real question people ask\", \"answer\": \"Helpful answer\"}, ...4-6 items],\n"
        "  \"specs\": {},\n"
        "  \"meta_title\": \"SEO-optimized title (max 60 chars)\",\n"
        "  \"meta_description\": \"Compelling description (max 160 chars)\",\n"
        "  \"og_title\": \"Social share title\",\n"
        "  \"og_description\": \"Social share description\",\n"
        "  \"slug\": \"url-friendly-keywords-latin-only\"\n"
        "}\n\n"
        
        "Technical rules:\n"
        "- Output ONLY raw JSON, no markdown.\n"
        "- Ensure valid JSON syntax."
    )

