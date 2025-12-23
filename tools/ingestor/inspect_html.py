from ingestor.http_client import HttpClient
from ingestor.logger import setup_logging
from bs4 import BeautifulSoup

def inspect():
    logger = setup_logging()
    http = HttpClient(30, 3, "Mozilla/5.0", logger)
    url = "https://irecommend.ru/content/otdykh-strogogo-rezhima-tolko-chto-vernulis-dekabr-2025-goda"
    
    print(f"Fetching {url}...")
    resp = http.get(url)
    html = resp.text
    soup = BeautifulSoup(html, "lxml")
    
    print("--- Searching for Product Image ---")
    selectors = [
        ".ProductTizer .photo img",
        "div.product-image img",
        "img[itemprop='image']",
        ".main-product-image img",
        ".product-tizer img",
    ]
    
    for sel in selectors:
        nodes = soup.select(sel)
        print(f"Selector '{sel}': {len(nodes)} found.")
        for node in nodes:
            print(f"  Src: {node.get('src')}")
            
    print("\n--- Exploring Product Images by SRC ---")
    imgs = soup.find_all("img")
    for img in imgs:
        src = img.get("src")
        if not src: continue
        
        if "product-images" in src:
             parent = img.parent
             classes = parent.get("class", []) if parent else []
             grandparent = parent.parent if parent else None
             gp_classes = grandparent.get("class", []) if grandparent else []
             
             print(f"Match: {src}")
             print(f"  Parent: {parent.name} Class: {classes}")
             print(f"  GP: {grandparent.name} Class: {gp_classes}")
             print(f"  GGP: {grandparent.parent.name if grandparent else 'None'} Class: {grandparent.parent.get('class', []) if grandparent and grandparent.parent else []}")

if __name__ == "__main__":
    inspect()
