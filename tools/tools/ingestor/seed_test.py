
import os
from dotenv import load_dotenv
from supabase import create_client, Client

def seed_test_urls():
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase: Client = create_client(url, key)
    
    test_urls = [
        "https://irecommend.ru/content/polnoe-razocharovanie-v-banke-tinkoff-ne-rekomenduyu-svyazyvatsya-i-privodit-druga",
        "https://irecommend.ru/content/elochnye-igrushki-moya-slabost-pytayus-naiti-igrushki-v-stile-retro-sredi-sovremennykh-moya",
        "https://irecommend.ru/content/ubezhdali-otkryt-yacheiku-v-banke-dlya-v-itoge-ukrali-druzy-i-zolotye-ukrasheniya-pokazyvayu",
        "https://irecommend.ru/content/khoroshii-mnogo-dostupno",
        "https://irecommend.ru/content/loson-gigienicheskii-dlya-ochistki-ushei-sobak-i-koshek-pchelodar-chistye-ushki"
    ]
    
    payload = []
    for u in test_urls:
        slug = u.split("/")[-1]
        payload.append({
            "source_url": u,
            "source_slug": slug,
            "status": "new"
        })
        
    try:
        # Clear old new ones to focus on these
        supabase.table("source_map").delete().eq("status", "new").execute()
        # Insert test ones
        res = supabase.table("source_map").upsert(payload, on_conflict="source_url").execute()
        print(f"Successfully seeded {len(test_urls)} test URLs into source_map")
    except Exception as e:
        print(f"Error seeding: {e}")

if __name__ == "__main__":
    seed_test_urls()
