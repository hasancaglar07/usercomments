import logging
import random
from collections import deque
from typing import Deque, Dict, List

from .supabase_client import SupabaseClient

_ADJECTIVES = [
    "brave",
    "calm",
    "clever",
    "fancy",
    "glossy",
    "happy",
    "kind",
    "lucky",
    "mellow",
    "neat",
    "quick",
    "sunny",
    "witty",
    "zesty",
]

_NOUNS = [
    "owl",
    "tiger",
    "panda",
    "otter",
    "falcon",
    "fox",
    "koala",
    "lynx",
    "rabbit",
    "sparrow",
    "whale",
    "wolf",
    "yak",
]


def _generate_username() -> str:
    return f"{random.choice(_ADJECTIVES)}-{random.choice(_NOUNS)}-{random.randint(1000, 9999)}"


def _generate_display_name(username: str) -> str:
    parts = username.replace("-", " ").title()
    return parts


class ProfilePool:
    def __init__(self, supabase: SupabaseClient, desired_size: int, logger: logging.Logger) -> None:
        self.supabase = supabase
        self.desired_size = desired_size
        self.logger = logger
        self.profiles: List[Dict[str, str]] = []
        self.recent: Deque[str] = deque(maxlen=25)

    def load_or_create(self) -> None:
        profiles = self.supabase.select("profiles", columns="user_id, username, bio")
        if len(profiles) < self.desired_size:
            to_create = self.desired_size - len(profiles)
            new_profiles = []
            for _ in range(to_create):
                username = _generate_username()
                new_profiles.append(
                    {
                        "username": username,
                        "bio": _generate_display_name(username),
                        "profile_pic_url": None,
                    }
                )
            self.supabase.upsert("profiles", new_profiles, on_conflict="username")
            profiles = self.supabase.select("profiles", columns="user_id, username, bio")
        
        # Normalize to the bot's expected internal format (id, display_name)
        for p in profiles:
            p["id"] = p.get("user_id")
            p["display_name"] = p.get("bio") or p.get("username")
            
        self.profiles = profiles
        self.logger.info("Profile pool size: %s", len(self.profiles))

    def pick(self) -> str:
        if not self.profiles:
            raise RuntimeError("Profile pool is empty")
        candidates = [p for p in self.profiles if p["id"] not in self.recent]
        if not candidates:
            candidates = self.profiles
        choice = random.choice(candidates)
        self.recent.append(choice["id"])
        return choice["id"]

