import re
import logging
from typing import Dict, List, Tuple
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

def inject_internal_links(
    content_html: str, 
    product_map: Dict[str, str], 
    max_links: int = 5
) -> str:
    """
    Injects internal links into the HTML content for known products.
    
    Args:
        content_html: The HTML content to process.
        product_map: A dictionary where keys are product names (lowercase) and values are slugs.
        max_links: Maximum number of links to inject per call to avoid over-linking.
        
    Returns:
        The modified HTML with internal links.
    """
    if not content_html or not product_map:
        return content_html

    soup = BeautifulSoup(content_html, "html.parser")
    
    # We will track which products we've already linked to avoid duplicate links
    linked_slugs = set()
    link_count = 0

    # Sort product names by length desc to match "iPhone 13 Pro" before "iPhone 13"
    # This should ideally be done once outside, but for safety we do it here or assume input is decent.
    # To optimize, we won't sort completely every time if we can avoid it, 
    # but constructing a regex from thousands of products is expensive.
    # STRATEGY: instead of searching for ALL products, we scan the text words and see if they match products.
    
    # Actually, simplistic approach for specific context:
    # 1. Get all text.
    # 2. Identify potential matches.
    # 3. Replace.
    
    # Better approach for performance with large product list:
    # We only care about products that actually appear in the text.
    
    # Let's traverse text nodes.
    for text_node in soup.find_all(string=True):
        if link_count >= max_links:
            break
            
        parent = text_node.parent
        # Skip if already inside a link or specific tags
        if parent.name in ['a', 'h1', 'h2', 'script', 'style', 'code', 'pre']:
            continue
            
        text = str(text_node)
        
        # Determine which products are in this text chunk
        # This is the heavy part. If product_map has 10k items, this loop is slow.
        # OPTIMIZATION: We assume product_map passed here is a SUBSET or we rely on a fast matcher.
        # For now, let's assume the caller passes a RELEVANT map or we do a quick check.
        # But wait, we don't know which are relevant without checking.
        
        # Let's try to match only longer names (>= 4 chars) to avoid false positives.
        
        # To make this efficient:
        # We can't iterate 10k items for every text node.
        # We can iterate the text words?
        
        # Let's check for exact matches of keys in the text (case insensitive)
        # We'll use a compiled regex for the top products or just string search if list is small.
        # Assuming product_map might be large, we might need Aho-Corasick or FlashText, 
        # but we don't want extra deps.
        
        # Fallback: Simple iteration, assuming product_map isn't HUGE or we filter it before calling.
        # We will iterate over the keys. 
        
        # NOTE: For this efficient implementation, we will expect the generic `product_map`
        # ONLY to contain products that are LIKELY to be here or limit the loop.
        # Since we can't easily filter beforehand without reading text, let's just loop.
        # Python string 'in' is fast.
        
        matches = []
        text_lower = text.lower()
        
        for p_name, p_slug in product_map.items():
            if len(p_name) < 3:
                continue
            if p_slug in linked_slugs:
                continue
                
            # Naive check
            if p_name in text_lower:
                # Retrieve the actual casing from text using regex to ensure we replace correctly
                # or just use regex for replacement.
                matches.append((p_name, p_slug))
        
        # Sort matches by length desc
        matches.sort(key=lambda x: len(x[0]), reverse=True)
        
        new_text = text
        changed = False
        
        for p_name, p_slug in matches:
            if link_count >= max_links:
                break
            if p_slug in linked_slugs:
                continue
                
            # Regex to match whole word/phrase, case insensitive
            # Escape the name for regex
            escaped_name = re.escape(p_name)
            pattern = re.compile(fr'\b{escaped_name}\b', re.IGNORECASE)
            
            # Check validation again with regex boundary
            if pattern.search(new_text):
                # Replace ONLY the first occurrence in this node to avoid messing up
                def replace_func(match):
                    return f'<a href="/product/{p_slug}" class="internal-link">{match.group(0)}</a>'
                
                # We need to render this as HTML, but we are in a text node string loop.
                # If we modify 'new_text' with tags, we can't put it back into 'string'.
                # We have to swap the node.
                
                # Only do one replacement per text node to keep logic simple?
                # Or handle multiple.
                
                # Let's just do replacement.
                replacement = pattern.sub(replace_func, new_text, count=1)
                if replacement != new_text:
                    new_text = replacement
                    linked_slugs.add(p_slug)
                    link_count += 1
                    changed = True
        
        if changed:
            # Convert the text string (which now contains HTML tags) into soup nodes
            new_content = BeautifulSoup(new_text, "html.parser")
            text_node.replace_with(new_content)

    return str(soup)
