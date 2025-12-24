import asyncio
import random
from ingestor.config import Config
from ingestor.db.supabase_client import SupabaseClient

ICON_FILES = [
    "African_Wild_Dog_african-wild-dog.png",
    "Albert_Einstein_albert-einstein.png",
    "Albertosaurus_albertosaurus.png",
    "Alexander_the_Great_alexander-the-great.png",
    "Allosaurus_allosaurus.png",
    "Alpaca_alpaca.png",
    "Anubis_anubis.png",
    "Astronaut_Cat_astronaut-cat.png",
    "Balance_Board_balance-board.png",
    "Balloon_Dog_balloon-dog.png",
    "Barbarian_Woman_barbarian-woman.png",
    "Bengal_Domestic_Cat_bengal-domestic-cat.png",
    "Bernese_Mountain_Dog_bernese-mountain-dog.png",
    "Bichon_Frise_bichon-frise.png",
    "Black-Tailed_Prairie_Dog_black-tailed-prairie-dog.png",
    "Black_Cat_black-cat-1.png",
    "Black_Cat_black-cat.png",
    "Black_Widow_Spider_black-widow-spider.png",
    "Bonobo_bonobo.png",
    "Bull_bull.png",
    "Bush_Dog_bush-dog.png",
    "Canadian_Inuit_Dog_canadian-inuit-dog.png",
    "Cat_cat-edk7q2.png",
    "Cat_cat.png",
    "Cat_in_a_Box_cat-in-a-box.png",
    "Catfish_catfish.png",
    "Cavalier_King_Charles_Spaniel_cavalier-king-charles-spaniel.png",
    "Claude_Monet_claude-monet.png",
    "Common_Antelope_common-antelope.png",
    "Cyborg_cyborg.png",
    "Cygnet_cygnet.png",
    "Dilophosaurus_dilophosaurus.png",
    "Dog_Costume_dog-costume.png",
    "Dog_Walking_dog-walking.png",
    "Dog_dog.png",
    "Dogfish_dogfish.png",
    "Dragon_Plushie_dragon-plushie.png",
    "Dromedary_Camel_dromedary-camel.png",
    "Eastern_Gray_Squirrel_eastern-gray-squirrel.png",
    "Elf_elf.png",
    "Estrela_Mountain_Dog_estrela-mountain-dog.png",
    "Gingerbread_Man_gingerbread-man.png",
    "Gladiatrice_gladiatrices.png",
    "Glass_Catfish_glass-catfish.png",
    "Golden_Retriever_golden-retriever-dog.png",
    "Great_Swiss_Mountain_Dog_great-swiss-mountain-dog.png",
    "Greyhound_greyhound.png",
    "Grumpy_Cat_grumpy-cat.png",
    "Hamadryas_Baboon_hamadryas-baboon.png",
    "Hanuman_hanuman.png",
    "Heraklit_Bust_heraklit-bust.png",
    "Highland_Cattle_highland-cattle.png",
    "Hoatzin_hoatzin.png",
    "Inflatable_Dinosaur_Suit_inflatable-dinosaur-suit.png",
    "Invisible_Man_invisible-man.png",
    "Japanese_Raccoon_Dog_japanese-raccoon-dog.png",
    "Julius_Caesar_julius-caesar.png",
    "Knight_Cat_knight-cat.png",
    "Laboratory_Robot_Arm_laboratory-robot-arm.png",
    "Leaf_Sheep_Costasiella_kuroshimae_leaf-sheep-costasiella-kuroshimae.png",
    "Lhasa_Apso_lhasa-apso.png",
    "Liger_liger.png",
    "Lightning_lightning.png",
    "Lioness_lioness.png",
    "Lizard_Man_lizard-man.png",
    "Magic_Wiggly_Worm_magic-wiggly-worm.png",
    "Man_Presenting_asian-man-with-glasses-presenting-gesture.png",
    "Man_in_Headphones_man-in-headphones.png",
    "Man_man.png",
    "Marie_Antoinette_marie-antoinette.png",
    "Mascot_Costume_mascot-costume.png",
    "Matryoshka_Doll_matryoshka-doll.png",
    "Musk_Ox_musk-ox.png",
    "Pablo_Picasso_pablo-picasso.png",
    "Pirate_Parrot_King_pirate-parrot-king.png",
    "Portuguese_Water_Dog_portuguese-water-dog.png",
    "Prairie_Dog_prairie-dog.png",
    "Princess_princess.png",
    "Purple_Froglet_purple-froglet.png",
    "Queen_queen.png",
    "Reindeer_reindeer.png",
    "Ridgeback_ridgeback.png",
    "Robot_Dog_robot-dog.png",
    "Robotic_Cat_Toy_robotic-cat-toy.png",
    "Rodan_rodan.png",
    "Samoyed_Dog_samoyed-dog.png",
    "Sand_cat_sand-cat.png",
    "Sea_Otter_sea-otter.png",
    "Siamese_Cat_siamese-cat.png",
    "Space_Cat_space-cat.png",
    "Sphynx_Cat_sphynx-cat.png",
    "Stoned_Monkey_stoned-monkey.png",
    "Talking_Cat_talking-cat.png",
    "Therapy_Dog_therapy-dog.png",
    "Thorny_Dragon_thorny-dragon.png",
    "Trogdor_the_Burninator_trogdor-the-burninator.png",
    "Turkish_Van_Cat_turkish-van-cat.png",
    "Vervet_Monkey_vervet-monkey.png",
    "Vicuña_vicua.png",
    "Village_Elder_village-elder.png",
    "Walking_Duck_walking-duck.png",
    "Watermelon_watermelon-1.png",
    "Wildcat_wildcat.png",
    "Witch_Girl_witch-girl.png",
    "Wizard_wizard-1.png",
    "Woman_Presenting_professional-woman-presenting-gesture.png",
    "Woman_woman.png",
    "turkey_flag.png"
]

async def main():
    config = Config.from_env()
    db = SupabaseClient(config.supabase_url, config.supabase_service_role_key, None)
    
    table_name = "profiles"
    pk_col = "user_id"
    
    print(f"Connecting to Supabase... Table: {table_name}")
    try:
        # Fetch all profiles
        profiles = db.select(table_name, f"{pk_col}, username, profile_pic_url", limit=1000)
    except Exception as e:
         print(f"Failed to fetch from '{table_name}': {e}")
         return

    print(f"Found {len(profiles)} profiles.")
    
    updated_count = 0
    for profile in profiles:
        current_pic = profile.get("profile_pic_url")
        user_id = profile[pk_col] # Use correct PK
        
        # Pick random icon
        icon_name = random.choice(ICON_FILES)
        new_pic_url = f"/profile_icon/{icon_name}"
        
        if current_pic and current_pic.startswith("/profile_icon/"):
             # If already has one of OUR icons, maybe skip? 
             # Or if user said "randomly assign to ALL", should we overwrite?
             # Let's overwrite only if empty or to ensure randomness if user requested explicitly.
             # Given request "random bu ikonları ata", I will overwrite even if it has one, 
             # unless it's a custom uploaded one? 
             # Actually, simpler: just overwrite.
             pass
            
        print(f"Updating user {profile.get('username', user_id)} -> {icon_name}")
        
        try:
            db.update(table_name, {"profile_pic_url": new_pic_url}, filters=[("eq", pk_col, user_id)])
            updated_count += 1
        except Exception as e:
            print(f"Error updating user {user_id}: {e}")

    print(f"Finished. Updated {updated_count} users.")

if __name__ == "__main__":
    asyncio.run(main())
