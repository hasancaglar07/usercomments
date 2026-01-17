
import os
import time
import requests
import json
import logging
from typing import List, Dict, Optional
from dotenv import load_dotenv
from supabase import create_client, Client
from rich.console import Console
from rich.progress import Progress

# Load environment variables
current_dir = os.path.dirname(os.path.abspath(__file__))
# Try multiple possible paths for the .env file
possible_paths = [
    os.path.join(current_dir, '../../apps/web/.env'),
    os.path.join(current_dir, '../../../apps/web/.env'),
    os.path.join(current_dir, '../apps/web/.env'),
    os.path.abspath(os.path.join(current_dir, '../../apps/web/.env'))
]

env_path = None
for path in possible_paths:
    if os.path.exists(path):
        env_path = path
        break

if env_path:
    print(f"Loading .env from: {env_path}")
    load_dotenv(env_path)
else:
    print("WARNING: Could not find .env file in common locations.")
    print(f"Searched in: {possible_paths}")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.1-8b-instant"

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("seo_content_bot.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
console = Console()

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Supabase credentials missing. Please check .env file.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class SeoContentGenerator:
    def __init__(self):
        self.processed_count = 0
        self.error_count = 0

    def get_products_needing_content(self, limit: int = 50) -> List[Dict]:
        """
        Fetch product translations that have missing SEO content.
        We check for null seo_content_html.
        """
        try:
            # We want to find product_translations where seo_content_html is null
            # This is a bit tricky with supabase-py basic filtering on nulls for large datasets,
            # but we can try to fetch ones with 'is' null.
            response = supabase.table("product_translations") \
                .select("product_id, lang, name, description, slug") \
                .is_("seo_content_html", "null") \
                .limit(limit) \
                .execute()
            
            return response.data
        except Exception as e:
            logger.error(f"Error fetching products: {e}")
            return []

    def get_product_specs(self, product_id: str) -> str:
        """Fetch product specs/stats to give context to the AI."""
        try:
            response = supabase.table("products") \
                .select("product_stats(rating_avg, review_count), brands(name)") \
                .eq("id", product_id) \
                .single() \
                .execute()
            
            data = response.data
            brand_name = data.get('brands', {}).get('name', 'Generic') if data.get('brands') else 'Generic'
            stats = data.get('product_stats', [{}])[0] if data.get('product_stats') else {}
            
            return f"Brand: {brand_name}, Rating: {stats.get('rating_avg', 'N/A')}"
        except Exception as e:
            logger.warning(f"Could not fetch extra specs for {product_id}: {e}")
            return ""

    def generate_content(self, product_name: str, lang: str, context: str) -> Optional[str]:
        """Generate SEO content using Groq API."""
        
        language_map = {
            "tr": "Turkish",
            "en": "English",
            "de": "German",
            "es": "Spanish"
        }
        target_lang = language_map.get(lang, "English")

        prompt = f"""
        You are an SEO expert copywriter. Write a comprehensive, SEO-optimized product guide for "{product_name}" in {target_lang}.
        
        Context: {context}

        Requirements:
        1. Write in {target_lang}.
        2. Total length should be around 800-1000 words.
        3. Use semantic HTML tags (<h2>, <h3>, <p>) for structure. Do NOT use <h1>, <html>, <body> or markdown blocks.
        4. No preambles like "Here is the content". Just output the raw HTML.
        5. Structure:
           - <h2>Overview of {product_name}</h2>
           - <p>Detailed introduction...</p>
           - <h2>Key Features & Benefits</h2>
           - <h3>[Feature 1]</h3>...
           - <h3>[Feature 2]</h3>...
           - <h2>Technical Specifications & Performance</h2>
           - <p>...</p>
           - <h2>Why Buy {product_name}?</h2>
           - <p>...</p>
           - <h2>Frequently Asked Questions</h2>
           - <h3>Question 1?</h3><p>Answer...</p>

        Make it engaging, professional, and persuasive.
        """

        payload = {
            "messages": [
                {"role": "system", "content": "You are a helpful SEO copywriting assistant that outputs only valid HTML body content."},
                {"role": "user", "content": prompt}
            ],
            "model": GROQ_MODEL,
            "temperature": 0.7,
            "max_tokens": 4096,
        }

        try:
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            content = result['choices'][0]['message']['content']
            
            # Clean up potential markdown formatting if model ignores instruction
            if content.startswith("```html"):
                content = content.replace("```html", "").replace("```", "")
            
            return content.strip()

        except Exception as e:
            logger.error(f"Error calling Groq API for {product_name}: {e}")
            return None

    def save_content(self, product_id: str, lang: str, content: str):
        """Save the generated HTML to the database."""
        try:
            supabase.table("product_translations") \
                .update({"seo_content_html": content}) \
                .eq("product_id", product_id) \
                .eq("lang", lang) \
                .execute()
            logger.info(f"Successfully saved content for {product_id} ({lang})")
        except Exception as e:
            logger.error(f"Error saving content for {product_id}: {e}")

    def run(self):
        console.print("[bold green]Starting SEO Content Generator Bot...[/bold green]")
        
        while True:
            products = self.get_products_needing_content(limit=10)
            
            if not products:
                console.print("[yellow]No products found needing content. Sleeping for 60s...[/yellow]")
                time.sleep(60)
                continue

            with Progress() as progress:
                task = progress.add_task("[cyan]Processing products...", total=len(products))
                
                for product in products:
                    name = product.get('name')
                    lang = product.get('lang')
                    pid = product.get('product_id')
                    
                    if not name or not lang:
                        progress.advance(task)
                        continue

                    console.print(f"Generating for: [bold]{name}[/bold] ({lang})")
                    
                    specs = self.get_product_specs(pid)
                    content = self.generate_content(name, lang, specs)
                    
                    if content:
                        self.save_content(pid, lang, content)
                        self.processed_count += 1
                    else:
                        self.error_count += 1
                    
                    progress.advance(task)
                    time.sleep(1) # Rate limiting courtesy

if __name__ == "__main__":
    bot = SeoContentGenerator()
    bot.run()
