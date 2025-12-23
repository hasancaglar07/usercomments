from typing import List, Optional

SYSTEM_PROMPT = (
    "You are a professional translator and SEO copywriter. "
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
    return (
        "You are an elite SEO content creator and translator. "
        f"Transform this Russian review into a masterpiece in {lang}.\n\n"
        f"Context Category: {category_line}\n"
        f"Input Pros: {pros_line}\n"
        f"Input Cons: {cons_line}\n\n"
        "Input Data:\n"
        "{\n"
        f"  \"title_ru\": {title_ru!r},\n"
        f"  \"content_html_ru\": {content_html_ru!r}\n"
        "}\n\n"
        "Instructions:\n"
        "1. TRANSLATION: High-quality, natural-sounding, localized translation. Not literal. Absolute mastery of the target language.\n"
        "2. SEO STRUCTURE: Use semantic HTML (h3, h4, p, strong, ul, li). Break long text into logical sections with descriptive headers.\n"
        "3. PROS/CONS (CRITICAL): Always provide at least 5 PROS and 5 CONS. Use the EXACT text format 'Pros:' and 'Cons:' followed by bullet points (started with -). This is required for our parser to display them with custom UI icons. Example:\n"
        "   Pros:\n"
        "   - Fast performance\n"
        "   - Great battery life\n\n"
        "   Cons:\n"
        "   - Expensive\n"
        "   - Loud fan\n"
        "4. SUMMARY: Write a 3-5 sentence professional 'Expert Opinion' summary.\n"
        "5. FAQ: Create 4-6 high-value FAQs with detailed answers.\n"
        "6. METADATA: meta_title (max 60 chars) and meta_description (max 160 chars).\n"
        "7. SLUG: URL-friendly, keywords-rich, latin chars only.\n\n"
        "Rule for Thin Content: If the input content is very short, you MUST expand it by adding context about the product, how it's typically used, and standard pros/cons for this category. Do not just translate, CREATE value.\n\n"
        "Output JSON schema (MANDATORY):\n"
        "{\n"
        "  \"title\": \"Catchy Translated Title\",\n"
        "  \"content_html\": \"Rich HTML content with headers and formatting\",\n"
        "  \"summary\": \"...\",\n"
        "  \"faq\": [{\"question\": \"...\", \"answer\": \"...\"}, ...],\n"
        "  \"pros\": [\"...\", ...],\n"
        "  \"cons\": [\"...\", ...],\n"
        "  \"meta_title\": \"...\",\n"
        "  \"meta_description\": \"...\",\n"
        "  \"og_title\": \"...\",\n"
        "  \"og_description\": \"...\",\n"
        "  \"slug\": \"...\"\n"
        "}\n\n"
        "Rules:\n"
        "- Do not mention 'Russian' or 'translated' in output.\n"
        "- Keep brand names and model numbers exactly as in source.\n"
        "- Output ONLY JSON."
    )


def build_repair_prompt(raw_output: str) -> str:
    return (
        "Your previous response was invalid JSON. "
        "Return ONLY a valid JSON object that matches the schema exactly.\n\n"
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
