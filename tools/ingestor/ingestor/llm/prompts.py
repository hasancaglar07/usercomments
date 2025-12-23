from typing import Optional

SYSTEM_PROMPT = (
    "You are a professional translator and SEO copywriter. "
    "Always output a single JSON object that matches the requested schema. "
    "Do not include commentary or extra keys."
)
def build_translation_prompt(
    lang: str,
    title_ru: str,
    content_html_ru: str,
    category_name_ru: Optional[str],
) -> str:
    category_line = category_name_ru or ""
    return (
        "Translate Russian review content into the target language and generate SEO fields.\n"
        f"Target language: {lang}\n"
        f"Category (Russian): {category_line}\n\n"
        "Input JSON:\n"
        "{\n"
        f"  \"title_ru\": {title_ru!r},\n"
        f"  \"content_html_ru\": {content_html_ru!r}\n"
        "}\n\n"
        "Output JSON schema (no extra keys):\n"
        "{\n"
        "  \"title\": \"...\",\n"
        "  \"content_html\": \"...\",\n"
        "  \"summary\": \"Brief editor summary / overview (2-3 sentences)\",\n"
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
        "- Natural, human-like translation. Do not be literal.\n"
        "- FAQ: Generate 3-5 relevant FAQ items based on the content.\n"
        "- Summary: Write a professional-sounding editor summary.\n"
        "- Keep brand/product names as-is.\n"
        "- Preserve basic HTML tags in content_html (p, br, ul, ol, li, strong, em, a).\n"
        "- meta_description should be about 150-160 characters.\n"
        "- slug must be lowercase, hyphenated, latin only, max 80 chars.\n"
        "- For Arabic, slug must still be latin (transliteration or short English).\n"
        "- Output only the JSON object, nothing else."
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
