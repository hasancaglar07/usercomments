from typing import List, Optional

# Language-specific tone and style guidelines
LANGUAGE_STYLES = {
    "en": {
        "name": "English",
        "tone": "casual, relatable, and conversational",
        "style": "Write as if you're a friendly neighbor sharing their honest experience. Use contractions (I'm, don't, it's), everyday vocabulary, and occasional humor. Be direct but warm. Americans appreciate honesty and practical insights.",
        "do_notes": "Keep it concrete and specific. Vary sentence length. Use natural emphasis like short punchy lines. Avoid filler.",
        "example_phrases": "I gotta say, Here's the deal, Not gonna lie, Game changer, Worth every penny, Total letdown",
        "avoid_phrases": "It is worth noting, In conclusion, One thing to mention, In terms of, Overall, Furthermore",
        "local_terms": "value for money, shipping, build quality, ease of use, customer support, return, battery life",
        "native_example": "I used it for a week and the build quality surprised me. The buttons feel solid and the battery lasts longer than I expected.",
    },
    "tr": {
        "name": "Turkish",
        "tone": "samimi, sıcak ve arkadaşça",
        "style": "Sanki yakın bir arkadaşına deneyimini anlatıyormuş gibi yaz. Günlük konuşma dilini kullan, resmi olma. Türk okuyucular samimiyete ve gerçekçiliğe değer verir. Abartılı satış diline kaçma. Uydurma kelimeler kullanma (örn: 'Oğlata' diye bir kelime yok). Bebek maması terimlerini doğru kullan (örn: 'Porridge' -> 'Kaşık Maması' veya 'Muhallebi', 'Oatmeal' -> 'Yulaf Ezmesi').",
        "do_notes": "Kısa ve orta cümleleri karıştır. Gereksiz giriş/sonuç kalıplarından kaçın. Doğrudan deneyim anlat. Abartılı ya da robotik ifadeler kullanma.",
        "example_phrases": "Açıkçası, Şunu söyleyeyim, Bence, Yani kısacası, Tam bir hayal kırıklığı, Kesinlikle tavsiye ederim",
        "avoid_phrases": "Sonuç olarak, Genel olarak, Bu noktada, Öne çıkan, İtiraf etmeliyim ki, Bununla birlikte",
        "local_terms": "fiyat/performans, kargo, paketleme, malzeme kalitesi, kullanım kolaylığı, iade, müşteri hizmetleri, pil ömrü",
        "native_example": "Bir haftadır kullanıyorum, malzeme kalitesi beni şaşırttı. Tuşlar sağlam, pil de beklediğimden uzun gidiyor.",
    },
    "de": {
        "name": "German",
        "tone": "sachlich, vertrauenswürdig und gründlich",
        "style": "Schreibe wie ein erfahrener Nutzer, der seine ehrliche Meinung teilt. Deutsche Leser schätzen detaillierte Informationen und faktenbasierte Bewertungen. Sei präzise aber nicht steif. Verwende gelegentlich umgangssprachliche Ausdrücke um authentisch zu wirken.",
        "do_notes": "Klar und strukturiert, aber menschlich. Konkrete Beobachtungen statt Floskeln. Variiere die Satzlänge.",
        "example_phrases": "Ehrlich gesagt, Was mich überzeugt hat, Das muss ich sagen, Mein Tipp, Definitiv empfehlenswert",
        "avoid_phrases": "Abschließend, Es ist erwähnenswert, Im Allgemeinen, In Bezug auf, Nichtsdestotrotz",
        "local_terms": "Preis-Leistung, Lieferung, Verarbeitung, Bedienung, Rückgabe, Kundensupport, Akkulaufzeit",
        "native_example": "Ich nutze es seit einer Woche und die Verarbeitung hat mich positiv überrascht. Die Tasten fühlen sich stabil an und der Akku hält länger als erwartet.",
    },
    "es": {
        "name": "Spanish",
        "tone": "expresivo, apasionado y cercano",
        "style": "Escribe como si estuvieras hablando con un amigo en un café. Los hispanohablantes aprecian la calidez y la emoción genuina. Usa expresiones coloquiales y transmite tu entusiasmo o frustración real. Sé auténtico y personal.",
        "do_notes": "Natural y directo. Evita frases de traducción literal. Usa detalles concretos y sensaciones reales.",
        "example_phrases": "La verdad es que, Para ser sincero/a, Me encantó, Qué decepción, Totalmente recomendado",
        "avoid_phrases": "Cabe destacar, En conclusión, En términos de, Vale la pena mencionar, En general",
        "local_terms": "relación calidad-precio, envío, acabado, facilidad de uso, devolución, atención al cliente, duración de la batería",
        "native_example": "Lo uso desde hace una semana y el acabado me sorprendió para bien. Los botones se sienten firmes y la batería dura más de lo esperado.",
    },
}

SYSTEM_PROMPT = (
    "You are an expert content localizer and native-level copywriter. "
    "Your job is NOT to translate - it's to RECREATE content as if a native speaker wrote it originally. "
    "Keep all factual details, and do not add or remove information. "
    "Be SEO-aware: use natural, search-intent friendly phrasing (no keyword stuffing). "
    "The output must feel 100% authentic, human, and natural - never robotic or 'translated'. "
    "Always output a single JSON object that matches the requested schema. "
    "Do not include commentary or extra keys."
)

QUALITY_SYSTEM_PROMPT = (
    "You are a strict native-language editor and QA judge. "
    "Evaluate naturalness, fluency, and translation artifacts. "
    "Output a single JSON object only."
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
    min_chars: Optional[int] = None,
    issues: Optional[List[str]] = None,
) -> str:
    category_line = category_name_ru or ""
    pros_line = ", ".join([str(x) for x in pros_ru if x]) if pros_ru else "None"
    cons_line = ", ".join([str(x) for x in cons_ru if x]) if cons_ru else "None"
    
    # Get language-specific style guide
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
    
    return (
        f"You are a native {style_info['name']} content creator who writes authentic product reviews.\n\n"
        f"🎯 YOUR MISSION: Recreate this Russian review in {style_info['name']} as if YOU personally wrote it.\n"
        f"This is NOT translation - it's LOCALIZATION. The final text must feel 100% native and human.\n\n"
        
        f"📝 TONE & STYLE FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Style: {style_info['style']}\n"
        f"- Do: {style_info.get('do_notes', '')}\n"
        f"- Example phrases to use (sparingly): {style_info['example_phrases']}\n"
        f"- Avoid phrases: {style_info.get('avoid_phrases', '')}\n"
        f"- Local terms to prefer when relevant: {style_info.get('local_terms', '')}\n"
        f"- Native example (do not copy): {style_info.get('native_example', '')}\n\n"
        
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
        "4. NO AI SMELL: Avoid robotic phrases and literal translation artifacts.\n"
        "5. BE AUTHENTIC: Write as if you're sharing with a friend, not writing a formal report.\n"
        "6. USE LOCAL FLOW: Keep natural word order and local phrasing; avoid calques.\n"
        "7. CORRECT TERMINOLOGY: Use correct local terms for products (e.g. 'Baby Porridge' -> 'Kaşık Maması' in TR, 'Brei' in DE). Do not invent words.\n"
        "8. DO NOT OVERUSE CATCHPHRASES: At most 1-2 per review.\n"
        "9. LENGTH: Do not shorten or summarize; preserve full detail.\n"
        "10. SEO: Use natural, search-intent phrasing and include product/category terms already present in the source (no keyword stuffing).\n\n"
        
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
        "- Brand names/models: If in English/Latin, keep as-is. If in Russian, TRANSLITERATE or TRANSLATE to Latin.\n"
        "- NO CYRILLIC in output.\n"
        "- Output ONLY raw JSON. No markdown code blocks.\n"
        "- CRITICAL: You MUST escape ALL double quotes inside string values with a backslash. Example: \"<div class=\\\"my-class\\\">\"\n"
        "- Ensure strictly valid JSON syntax. Do not output invalid control characters.\n"
        + (f"- Minimum content length: {min_chars} characters (plain text, excluding HTML tags).\n" if min_chars else "")
        + (f"- Fix these issues if present: {', '.join(issues)}.\n" if issues else "")
    )


def build_title_translation_prompt(
    lang: str,
    title_source: str,
    source_lang_name: str,
) -> str:
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
    return (
        f"You are a native {style_info['name']} copywriter.\n\n"
        f"Task: Rewrite the review title from {source_lang_name} into {style_info['name']} "
        "as if it was written by a native speaker.\n\n"
        f"📝 STYLE FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Style: {style_info['style']}\n"
        f"- Do: {style_info.get('do_notes', '')}\n"
        f"- Avoid phrases: {style_info.get('avoid_phrases', '')}\n\n"
        f"- Local terms to prefer when relevant: {style_info.get('local_terms', '')}\n"
        f"- Native example (do not copy): {style_info.get('native_example', '')}\n\n"
        "Rules:\n"
        "- Rewrite, do not translate word-for-word.\n"
        "- Keep brand names, product names, and numbers unchanged.\n"
        "- No new facts. No missing facts.\n"
        "- No Cyrillic in output.\n\n"
        "Input title:\n"
        f"{title_source!r}\n\n"
        "Output JSON schema:\n"
        "{\n"
        "  \"title\": \"...\"\n"
        "}\n\n"
        "Technical rules:\n"
        "- Output ONLY raw JSON, no markdown.\n"
        "- Escape double quotes inside strings.\n"
        "- Ensure valid JSON syntax."
    )


def build_content_translation_prompt(
    lang: str,
    title_source: str,
    content_html_source: str,
    category_name_source: Optional[str],
    pros_source: Optional[List[str]],
    cons_source: Optional[List[str]],
    source_lang_name: str = "Russian",
    min_chars: Optional[int] = None,
    issues: Optional[List[str]] = None,
) -> str:
    category_line = category_name_source or ""
    pros_line = ", ".join([str(x) for x in pros_source if x]) if pros_source else "None"
    cons_line = ", ".join([str(x) for x in cons_source if x]) if cons_source else "None"
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
    return (
        f"You are a native {style_info['name']} content creator who writes authentic product reviews.\n\n"
        f"🎯 YOUR MISSION: Recreate this {source_lang_name} review in {style_info['name']} as if YOU wrote it.\n"
        "This is NOT translation - it's localization. The text must feel 100% native.\n\n"
        f"📝 TONE & STYLE FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Style: {style_info['style']}\n"
        f"- Do: {style_info.get('do_notes', '')}\n"
        f"- Example phrases (use sparingly): {style_info['example_phrases']}\n"
        f"- Avoid phrases: {style_info.get('avoid_phrases', '')}\n\n"
        f"- Local terms to prefer when relevant: {style_info.get('local_terms', '')}\n"
        f"- Native example (do not copy): {style_info.get('native_example', '')}\n\n"
        f"Context Category: {category_line}\n"
        f"Input Pros: {pros_line}\n"
        f"Input Cons: {cons_line}\n\n"
        f"Input Data ({source_lang_name} - for reference, do not translate literally):\n"
        "{\n"
        f"  \"title\": {title_source!r},\n"
        f"  \"content_html\": {content_html_source!r}\n"
        "}\n\n"
        "🚨 CRITICAL RULES:\n"
        "1. REWRITE, DON'T TRANSLATE: Understand meaning, then write fresh content.\n"
        "2. SOUND HUMAN: Natural speech patterns, local phrasing, no literal calques.\n"
        "3. KEEP THE STORY: Preserve all personal experiences and opinions.\n"
        "4. KEEP HTML TAGS: Preserve all HTML tags exactly as-is.\n"
        "5. You may add sentences inside existing tags to improve flow and detail, but do not add new tags.\n"
        "6. KEEP FACTS: Keep numbers, dates, and brand names unchanged.\n"
        "7. NO CYRILLIC in output.\n"
        "8. DO NOT OVERUSE catchphrases (max 1-2).\n"
        "9. LENGTH: Do not shorten or summarize; preserve full detail.\n"
        "10. SEO: Use natural, search-intent phrasing and include product/category terms already present in the source (no keyword stuffing).\n\n"
        "Output JSON schema (MANDATORY):\n"
        "{\n"
        "  \"title\": \"Catchy, natural title\",\n"
        "  \"content_html\": \"Your rewritten review in native voice\"\n"
        "}\n\n"
        "Technical Rules:\n"
        "- Output ONLY raw JSON. No markdown.\n"
        "- Escape all double quotes inside string values.\n"
        "- Ensure strictly valid JSON syntax.\n"
        + (f"- Minimum content length: {min_chars} characters (plain text, excluding HTML tags).\n" if min_chars else "")
        + (f"- Fix these issues if present: {', '.join(issues)}.\n" if issues else "")
    )


def build_native_polish_prompt(
    lang: str,
    title: str,
    content_html: str,
    min_chars: Optional[int] = None,
    issues: Optional[List[str]] = None,
) -> str:
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
    return (
        f"You are a native {style_info['name']} editor polishing a review for native fluency.\n\n"
        f"📝 STYLE FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Style: {style_info['style']}\n"
        f"- Do: {style_info.get('do_notes', '')}\n"
        f"- Avoid phrases: {style_info.get('avoid_phrases', '')}\n\n"
        f"- Local terms to prefer when relevant: {style_info.get('local_terms', '')}\n"
        f"- Native example (do not copy): {style_info.get('native_example', '')}\n\n"
        "Rules:\n"
        "- Keep ALL facts, numbers, and product names unchanged.\n"
        "- Keep HTML tags exactly as-is.\n"
        "- Remove any translation smell; make it read like a native wrote it.\n"
        "- You may rewrite sentences fully for native flow, but keep the same meaning and detail level.\n"
        "- Do not add new info or remove details.\n"
        "- Do not shorten; preserve length and granularity.\n"
        "- If the text feels thin, add short clarifying sentences using only existing facts.\n"
        "- SEO: natural search-intent phrasing, no keyword stuffing.\n"
        "- No Cyrillic in output.\n\n"
        "Input JSON:\n"
        "{\n"
        f"  \"title\": {title!r},\n"
        f"  \"content_html\": {content_html!r}\n"
        "}\n\n"
        "Output JSON schema:\n"
        "{\n"
        "  \"title\": \"<rewritten title in natural native voice - DO NOT output this placeholder>\",\n"
        "  \"content_html\": \"<rewritten HTML content - DO NOT output this placeholder>\"\n"
        "}\n\n"
        "⚠️ WARNING: You MUST replace the placeholders with actual content. Do NOT output '<...>' or 'Polished native title' literally.\n\n"
        "Technical rules:\n"
        "- Output ONLY raw JSON, no markdown.\n"
        "- Escape double quotes inside strings.\n"
        "- Ensure valid JSON syntax.\n"
        + (f"- Minimum content length: {min_chars} characters (plain text).\n" if min_chars else "")
        + (f"- Fix these issues if present: {', '.join(issues)}.\n" if issues else "")
    )


def build_metadata_polish_prompt(
    lang: str,
    title: str,
    summary: str,
    pros: List[str],
    cons: List[str],
    faq: List[dict],
    meta_title: str,
    meta_description: str,
    og_title: str,
    og_description: str,
    issues: Optional[List[str]] = None,
    min_summary_chars: Optional[int] = None,
    min_pros: Optional[int] = None,
    min_cons: Optional[int] = None,
    min_faq: Optional[int] = None,
) -> str:
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
    return (
        f"You are a native {style_info['name']} editor polishing review metadata.\n\n"
        f"📝 STYLE FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Style: {style_info['style']}\n"
        f"- Do: {style_info.get('do_notes', '')}\n"
        f"- Avoid phrases: {style_info.get('avoid_phrases', '')}\n\n"
        f"- Local terms to prefer when relevant: {style_info.get('local_terms', '')}\n"
        f"- Native example (do not copy): {style_info.get('native_example', '')}\n\n"
        "Rules:\n"
        "- Keep the meaning and facts unchanged.\n"
        "- Remove translation smell; make it read like a native wrote it.\n"
        "- Keep the same structure (summary, pros, cons, faq, meta fields).\n"
        "- Do not add new claims.\n\n"
        "Input JSON:\n"
        "{\n"
        f"  \"title\": {title!r},\n"
        f"  \"summary\": {summary!r},\n"
        f"  \"pros\": {pros!r},\n"
        f"  \"cons\": {cons!r},\n"
        f"  \"faq\": {faq!r},\n"
        f"  \"meta_title\": {meta_title!r},\n"
        f"  \"meta_description\": {meta_description!r},\n"
        f"  \"og_title\": {og_title!r},\n"
        f"  \"og_description\": {og_description!r}\n"
        "}\n\n"
        "Output JSON schema:\n"
        "{\n"
        "  \"summary\": \"...\",\n"
        "  \"pros\": [\"...\"],\n"
        "  \"cons\": [\"...\"],\n"
        "  \"faq\": [{\"question\": \"...\", \"answer\": \"...\"}],\n"
        "  \"meta_title\": \"...\",\n"
        "  \"meta_description\": \"...\",\n"
        "  \"og_title\": \"...\",\n"
        "  \"og_description\": \"...\"\n"
        "}\n\n"
        "Technical rules:\n"
        "- Output ONLY raw JSON, no markdown.\n"
        "- Escape double quotes inside strings.\n"
        "- Ensure valid JSON syntax.\n"
        + (f"- Minimum summary length: {min_summary_chars} characters.\n" if min_summary_chars else "")
        + (f"- Minimum pros count: {min_pros}.\n" if min_pros else "")
        + (f"- Minimum cons count: {min_cons}.\n" if min_cons else "")
        + (f"- Minimum FAQ count: {min_faq}.\n" if min_faq else "")
        + (f"- Fix these issues if present: {', '.join(issues)}.\n" if issues else "")
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
        f"- Do: {style_info.get('do_notes', '')}\n"
        f"- Use phrases like (sparingly): {style_info['example_phrases']}\n"
        f"- Avoid phrases: {style_info.get('avoid_phrases', '')}\n"
        f"- Local terms to prefer when relevant: {style_info.get('local_terms', '')}\n"
        f"- Native example (do not copy): {style_info.get('native_example', '')}\n\n"
        
        "Input JSON (English - use as reference, don't translate literally):\n"
        f"{source_json}\n\n"
        
        "🚨 CRITICAL RULES:\n"
        "1. REWRITE in your own words - don't just swap words from English.\n"
        "2. SOUND HUMAN: Use natural speech patterns native speakers actually use.\n"
        "3. AVOID AI PHRASES: No 'It is worth noting', 'In conclusion', 'One thing to mention'.\n"
        "4. BE AUTHENTIC: Write as if sharing with a friend, not writing a report.\n"
        "5. KEEP ALL DETAILS: Preserve personal experiences, specific facts, and opinions.\n"
        "6. TRANSLATE ALL LISTS: You MUST translate/localize the 'summary', 'faq', 'pros', and 'cons' fields. Do not leave them in English or Russian.\n"
        "7. CORRECT TERMINOLOGY: Use correct local terms (e.g. 'Porridge' -> 'Kaşık Maması' in TR, 'Oatmeal' -> 'Yulaf Ezmesi'). Do not invent words.\n"
        "8. DO NOT OVERUSE CATCHPHRASES: At most 1-2 per review.\n"
        "9. LENGTH: Do not shorten or summarize; preserve full detail.\n\n"
        
        "Output JSON schema:\n"
        "{\n"
        "  \"title\": \"Catchy title in natural voice\",\n"
        "  \"content_html\": \"Your rewritten content - must sound native\",\n"
        "  \"summary\": \"Natural expert opinion - TRANSLATED\",\n"
        "  \"specs\": {\"Key\": \"Value\"},\n"
        "  \"faq\": [{\"question\": \"Translated question\", \"answer\": \"Translated answer\"}],\n"
        "  \"pros\": [\"Translated and naturalized advantage\"],\n"
        "  \"cons\": [\"Translated and naturalized disadvantage\"],\n"
        "  \"meta_title\": \"SEO title (max 60 chars)\",\n"
        "  \"meta_description\": \"Compelling description (max 160 chars)\",\n"
        "  \"og_title\": \"Social share title\",\n"
        "  \"og_description\": \"Social share description\",\n"
        "  \"slug\": \"url-friendly-keywords\"\n"
        "}\n\n"
        
        "Technical Rules:\n"
        "- Brand names/models: Keep as-is (Latin). everything else MUST be in target language.\n"
        "- NO CYRILLIC in output.\n"
        "- Output ONLY raw JSON. No markdown code blocks.\n"
        "- CRITICAL: You MUST escape ALL double quotes inside string values with a backslash. Example: \"<div class=\\\"my-class\\\">\"\n"
        "- Ensure valid JSON syntax."
    )


def build_repair_prompt(raw_output: str) -> str:
    return (
        "Your previous response was invalid JSON. "
        "Fix the syntax errors (missing brackets, unescaped quotes, trailing commas).\n"
        "Return ONLY a valid raw JSON object. NO markdown formatting.\n"
        "CRITICAL: DO NOT TRANSLATE THE CONTENT. Preserve the original text exactly as it was, just fix the JSON syntax.\n"
        "CRITICAL: ESCAPE ALL DOUBLE QUOTES inside string values.\n\n"
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
        "- Natural, native translation. NO RUSSIAN/CYRILLIC characters.\n"
        "- slug must be lowercase, hyphenated, LATIN characters only, max 50 chars.\n"
        "- Output only the JSON object."
    )


def build_product_translation_prompt(
    lang: str,
    name_ru: str,
    description_ru: Optional[str],
    category_name_ru: Optional[str],
    min_description_chars: Optional[int] = None,
    issues: Optional[List[str]] = None,
) -> str:
    category_line = category_name_ru or ""
    description_line = description_ru or ""
    
    # Get language-specific style guide
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
    
    return (
        "Translate Russian product name/description into the target language and generate SEO fields.\n"
        f"Target language: {lang} ({style_info['name']})\n"
        f"Category (Russian): {category_line}\n\n"
        
        f"📝 TONE & STYLE FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Style: {style_info['style']}\n"
        f"- Do: {style_info.get('do_notes', '')}\n"
        f"- Avoid phrases: {style_info.get('avoid_phrases', '')}\n"
        f"- Local terms to prefer when relevant: {style_info.get('local_terms', '')}\n"
        f"- Native example (do not copy): {style_info.get('native_example', '')}\n\n"
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
        "- Natural translation. ABSOLUTELY NO CYRILLIC/RUSSIAN CHARACTERS in 'name' or 'slug'.\n"
        "- Avoid literal translation; keep native phrasing.\n"
        "- IF a Brand Name is in Russian, TRANSLITERATE it to Latin (e.g. 'Макфа' -> 'Makfa') or Translate it.\n"
        "- Translate descriptive words (e.g. 'Консервы' -> 'Canned Goods').\n"
        "- Example: 'Консервы овощные Bonduelle' -> 'Bonduelle Canned Vegetables'.\n"
        "- CHECK YOUR OUTPUT: If you see any Cyrillic letter, REWRITE IT in Latin.\n"
        "- Description should be concise but keep all key details; do not invent specs.\n"
        "- meta_description should be about 150-160 characters.\n"
        "- slug must be lowercase, hyphenated, LATIN characters only, max 80 chars.\n"
        "- Output only the JSON object.\n"
        + (f"- Minimum description length: {min_description_chars} characters.\n" if min_description_chars else "")
        + (f"- Fix these issues if present: {', '.join(issues)}.\n" if issues else "")
    )


def build_product_polish_prompt(
    lang: str,
    name: str,
    description: str,
    meta_title: str,
    meta_description: str,
    issues: Optional[List[str]] = None,
    min_description_chars: Optional[int] = None,
) -> str:
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
    return (
        f"You are a native {style_info['name']} editor polishing product copy.\n\n"
        f"📝 STYLE FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Style: {style_info['style']}\n"
        f"- Do: {style_info.get('do_notes', '')}\n"
        f"- Avoid phrases: {style_info.get('avoid_phrases', '')}\n"
        f"- Local terms to prefer when relevant: {style_info.get('local_terms', '')}\n"
        f"- Native example (do not copy): {style_info.get('native_example', '')}\n\n"
        "Rules:\n"
        "- Keep brand names and model names unchanged.\n"
        "- Do not add new facts or remove details.\n"
        "- Make it sound like a native wrote it.\n\n"
        "- No Cyrillic in output.\n\n"
        "Input JSON:\n"
        "{\n"
        f"  \"name\": {name!r},\n"
        f"  \"description\": {description!r},\n"
        f"  \"meta_title\": {meta_title!r},\n"
        f"  \"meta_description\": {meta_description!r}\n"
        "}\n\n"
        "Output JSON schema:\n"
        "{\n"
        "  \"name\": \"...\",\n"
        "  \"description\": \"...\",\n"
        "  \"meta_title\": \"...\",\n"
        "  \"meta_description\": \"...\"\n"
        "}\n\n"
        "Technical rules:\n"
        "- Output ONLY raw JSON, no markdown.\n"
        "- Escape double quotes inside strings.\n"
        "- Ensure valid JSON syntax.\n"
        + (f"- Minimum description length: {min_description_chars} characters.\n" if min_description_chars else "")
        + (f"- Fix these issues if present: {', '.join(issues)}.\n" if issues else "")
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
        "- CRITICAL FOR PRODUCT_NAME: You MUST output the product name in LATIN (English) characters.\n"
        "  - IF the original name is Russian/Cyrillic, you MUST TRANSLATE generic words (e.g. 'Таблетки' -> 'Tablets') and TRANSLITERATE brand names (e.g. 'Макфа' -> 'Makfa').\n"
        "  - EXAMPLE: 'Таблетки для посудомоечной машины Axl' -> 'Axl Dishwasher Tablets'\n"
        "  - ABSOLUTELY NO CYRILLIC characters in product_name.\n"
        "- Output ONLY JSON."
    )

def build_content_expansion_prompt(
    title: str,
    content_html: str,
    excerpt: str,
    product_name: Optional[str],
    category_name: Optional[str],
    pros: Optional[List[str]],
    cons: Optional[List[str]],
    rating: Optional[float],
    min_chars: int,
) -> str:
    pros_line = ", ".join([str(x) for x in pros if x]) if pros else ""
    cons_line = ", ".join([str(x) for x in cons if x]) if cons else ""
    return (
        "You are an expert review editor. Expand a short review into a fuller, readable review.\n"
        "Write in the SAME LANGUAGE as the input content. Do NOT translate.\n"
        "You may rephrase and elaborate, but do not add new facts beyond the provided inputs.\n"
        "Use only the original content, pros/cons, rating, and product/category context provided.\n"
        "Be SEO-aware: use natural, search-intent phrasing without keyword stuffing.\n"
        "If details are missing, stay neutral and avoid inventing features or claims.\n\n"
        "Input JSON:\n"
        "{\n"
        f"  \"title\": {title!r},\n"
        f"  \"content_html\": {content_html!r},\n"
        f"  \"excerpt\": {excerpt!r},\n"
        f"  \"product_name\": {product_name!r},\n"
        f"  \"category_name\": {category_name!r},\n"
        f"  \"rating\": {rating!r},\n"
        f"  \"pros\": {pros_line!r},\n"
        f"  \"cons\": {cons_line!r}\n"
        "}\n\n"
        "Output JSON schema:\n"
        "{\n"
        "  \"content_html\": \"<expanded HTML review>\"\n"
        "}\n\n"
        "Rules:\n"
        "- Use semantic HTML: <p>, <h3>, <ul>, <li>, <strong>.\n"
        "- Keep it coherent and human-sounding.\n"
        f"- Minimum plain-text length target: {min_chars} characters.\n"
        "- Output ONLY raw JSON (no markdown, no extra keys).\n"
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
        f"- Write as if YOU experienced this personally\n"
        f"- Do: {style_info.get('do_notes', '')}\n"
        f"- Avoid phrases: {style_info.get('avoid_phrases', '')}\n\n"
        f"- Local terms to prefer when relevant: {style_info.get('local_terms', '')}\n"
        f"- Native example (do not copy): {style_info.get('native_example', '')}\n\n"
        
        "🚨 CRITICAL RULES:\n"
        "1. REWRITE in natural language - don't do word-for-word translation.\n"
        "2. PRESERVE all personal experiences, specific details, and opinions.\n"
        "3. KEEP all HTML tags exactly as they are (<p>, <strong>, <h3>, etc.).\n"
        "4. SOUND HUMAN: Use expressions native speakers actually use.\n"
        "5. AVOID AI PHRASES and literal translation artifacts.\n"
        "6. Keep brand names, product names, and numbers unchanged.\n"
        "7. Do not overuse catchphrases.\n"
        "8. LENGTH: Do not shorten; preserve full detail within this chunk.\n"
        "9. SEO: Use natural, search-intent phrasing without keyword stuffing.\n\n"
        
        "Content to rewrite:\n"
        f"{chunk}\n\n"
        
        "Output JSON schema:\n"
        "{\n"
        "  \"translated_text\": \"<your rewritten HTML content in natural voice>\"\n"
        "}\n\n"
        
        "Technical rules:\n"
        "- Output ONLY the JSON object, no markdown.\n"
        "- Ensure valid JSON syntax.\n"
        "- CRITICAL: ESCAPE ALL DOUBLE QUOTES inside the HTML string value. (e.g. \"<div class=\\\"classname\\\">\" NOT \"<div class=\"classname\">\" )\n"
        "- CRITICAL: Do not output invalid control characters like unescaped newlines inside strings.\n"
        "- The content must be complete - do not truncate."
    )


def build_metadata_prompt(
    lang: str,
    title: str,
    content_preview: str,
    category: Optional[str],
    pros: Optional[List[str]],
    cons: Optional[List[str]],
    min_summary_chars: Optional[int] = None,
    min_pros: Optional[int] = None,
    min_cons: Optional[int] = None,
    min_faq: Optional[int] = None,
    issues: Optional[List[str]] = None,
) -> str:
    """Build prompt for generating SEO metadata, FAQs, and pros/cons in target language."""
    # Get language-specific style guide  
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES.get("en", {"name": lang.upper(), "tone": "natural", "style": "Write naturally", "example_phrases": ""}))
    
    pros_line = ", ".join([str(x) for x in pros if x]) if pros else "None provided"
    cons_line = ", ".join([str(x) for x in cons if x]) if cons else "None provided"
    
    return (
        f"You are a native {style_info['name']} content creator writing authentic product review metadata.\n\n"
        
        f"📝 STYLE FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Style: {style_info.get('style', '')}\n"
        f"- Do: {style_info.get('do_notes', '')}\n"
        f"- Use phrases like (sparingly): {style_info.get('example_phrases', '')}\n"
        f"- Avoid phrases: {style_info.get('avoid_phrases', '')}\n"
        f"- Local terms to prefer when relevant: {style_info.get('local_terms', '')}\n"
        f"- Native example (do not copy): {style_info.get('native_example', '')}\n\n"
        
        f"Review Context:\n"
        f"- Title: {title}\n"
        f"- Category: {category or 'General'}\n"
        f"- Content Preview: {content_preview[:1200]}...\n"
        f"- Original Pros: {pros_line}\n"
        f"- Original Cons: {cons_line}\n\n"
        
        "🚨 CRITICAL RULES:\n"
        "1. WRITE NATURALLY: Everything must sound like a real person wrote it.\n"
        "2. AVOID AI PHRASES and literal translation artifacts.\n"
        "3. BE SPECIFIC: Pros/cons should be concrete observations, not generic statements.\n"
        "4. SOUND AUTHENTIC: Write as if sharing honest opinions with a friend.\n"
        "5. KEEP LANGUAGE CONSISTENT: No English fragments or source-language leftovers.\n"
        "6. LENGTH: Do not shorten or over-summarize.\n"
        "7. SEO: Use product/category terms when present, but avoid keyword stuffing.\n"
        "8. Do not invent features, claims, or specs beyond the review content.\n\n"
        
        "Output JSON schema:\n"
        "{\n"
        f"  \"title\": \"Catchy, engaging title in {style_info['name']}\",\n"
        "  \"summary\": \"3-5 sentence expert opinion in natural voice\",\n"
        "  \"pros\": [\"Specific advantage 1\", \"Specific advantage 2\", ...at least 5],\n"
        "  \"cons\": [\"Honest disadvantage 1\", \"Honest disadvantage 2\", ...at least 5],\n"
        "  \"faq\": [{\"question\": \"Detailed question reflecting user search intent\", \"answer\": \"Comprehensive, SEO-optimized answer (2-3 sentences). Use valid HTML (<b>, <i>, <br>) if needed.\"}, ...8-12 items],\n"
        "  \"specs\": {},\n"
        "  \"image_alt_tags\": [\"Detailed alt text 1\", \"Detailed alt text 2\", \"Detailed alt text 3\"],\n"
        "  \"meta_title\": \"SEO-optimized title (max 60 chars)\",\n"
        "  \"meta_description\": \"Compelling description (max 160 chars)\",\n"
        "  \"og_title\": \"Social share title\",\n"
        "  \"og_description\": \"Social share description\",\n"
        "  \"slug\": \"url-friendly-keywords-latin-only\"\n"
        "}\n\n"
        
        "Technical rules:\n"
        "- Output ONLY raw JSON, no markdown.\n"
        "- CRITICAL: Escape all double quotes within strings.\n"
        "- Ensure valid JSON syntax.\n"
        + (f"- Minimum summary length: {min_summary_chars} characters.\n" if min_summary_chars else "")
        + (f"- Minimum pros count: {min_pros}.\n" if min_pros else "")
        + (f"- Minimum cons count: {min_cons}.\n" if min_cons else "")
        + (f"- Minimum FAQ count: {min_faq}.\n" if min_faq else "")
        + (f"- Fix these issues if present: {', '.join(issues)}.\n" if issues else "")
    )


def build_vision_prompt(lang: str) -> str:
    """Build prompt for analyzing an image to generate alt text."""
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
    return (
        f"You are a native {style_info['name']} SEO expert analyzing product images.\n"
        "Describe what is in this image accurately but naturally.\n\n"
        "Rules:\n"
        "1. Create a detailed Alt Text (max 120 chars) for SEO.\n"
        "2. Focus on visible product details, context, and usage.\n"
        "3. Do not say 'Image of' or 'Picture of'.\n"
        "4. Be specific (e.g., 'iPhone 13 Pro in Sierra Blue on wooden table').\n\n"
        "Output JSON schema:\n"
        "{\n"
        "  \"alt_text\": \"...\"\n"
        "}"
    )

def build_sentiment_enrichment_prompt(lang: str, title: str, content: str) -> str:
    """Build prompt for extracting deep sentiment and aspect ratings."""
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
    return (
        f"You are an expert product analyst. Analyze this {style_info['name']} review for deep sentiment.\n\n"
        f"Product: {title}\n"
        f"Review Content: {content[:4000]}...\n\n"
        "Task: Extract detailed aspect ratings (1-10) and sentiment based on the text.\n\n" 
        "Output JSON schema:\n"
        "{\n"
        "  \"aspects\": {\n"
        "    \"TranslatedKeyJ\": 8,\n"
        "    \"TranslatedKeyX\": 9,\n"
        "    \"TranslatedKeyY\": 7,\n"
        "    \"TranslatedVerdictKey\": \"TranslatedOneWordVerdict\"\n"
        "  },\n"
        "  \"overall_sentiment\": \"Positive/Neutral/Negative\",\n"
        "  \"key_emotion\": \"Delighted / Frustrated / Satisfied\"\n"
        "}\n\n"
        "Rules:\n"
        "1. TRANSLATE ALL KEYS: The keys in 'aspects' MUST be in the target language (e.g., 'Quality' -> 'Kalite' (TR), 'Qualität' (DE)).\n"
        "2. INCLUDE VERDICT: One of the aspects MUST be the final verdict (e.g., 'Verdict' -> 'Karar', 'Fazit') with a text value (e.g., 'Perfect', 'Good').\n"
        "3. Accurately score based on the review tone."
    )


def build_native_quality_prompt(
    lang: str,
    title: str,
    content_html: str,
    summary: str,
    pros: List[str],
    cons: List[str],
    faq: List[dict],
    min_content_chars: Optional[int] = None,
) -> str:
    style_info = LANGUAGE_STYLES.get(lang, LANGUAGE_STYLES["en"])
    return (
        f"You are a strict native {style_info['name']} editor and QA judge.\n\n"
        "Evaluate the text for native fluency, translation artifacts, and completeness.\n"
        "Score 1-10 where 10 is perfect native writing.\n\n"
        f"📝 STYLE TARGET FOR {style_info['name'].upper()}:\n"
        f"- Tone: {style_info['tone']}\n"
        f"- Style: {style_info['style']}\n"
        f"- Avoid phrases: {style_info.get('avoid_phrases', '')}\n"
        f"- Local terms: {style_info.get('local_terms', '')}\n"
        f"- Native example: {style_info.get('native_example', '')}\n\n"
        "Content to evaluate (may be truncated for length):\n"
        "{\n"
        f"  \"title\": {title!r},\n"
        f"  \"content_html\": {content_html!r},\n"
        f"  \"summary\": {summary!r},\n"
        f"  \"pros\": {pros!r},\n"
        f"  \"cons\": {cons!r},\n"
        f"  \"faq\": {faq!r}\n"
        "}\n\n"
        "Output JSON schema:\n"
        "{\n"
        "  \"native_score\": 1,\n"
        "  \"fluency_score\": 1,\n"
        "  \"translation_smell_score\": 1,\n"
        "  \"issues\": [\"short description\", \"literal translation\", \"awkward phrasing\"],\n"
        "  \"rewrite\": false\n"
        "}\n\n"
        "Rules:\n"
        "- translation_smell_score: 10 means no translation smell; 1 means obvious translation.\n"
        "- rewrite should be true if the text does not sound native, is too short, or feels SEO-thin/robotic.\n"
        + (f"- Minimum content length target: {min_content_chars} characters (plain text).\n" if min_content_chars else "")
    )
