import os
from dataclasses import dataclass
from typing import List, Optional

from dotenv import load_dotenv


@dataclass(frozen=True)
class Config:
    source_base_url: str
    langs: List[str]
    loop_min_seconds: int
    loop_max_seconds: int
    category_pages_to_scan: int
    http_timeout_seconds: int
    http_max_retries: int
    max_new_reviews_per_loop: int
    image_crop_right_pct: float
    image_max_width: int
    image_webp_quality: int
    groq_api_key: str
    groq_model: str
    supabase_url: str
    supabase_service_role_key: str
    r2_endpoint: str
    r2_region: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket: str
    r2_public_base_url: str
    random_user_pool_size: int
    log_file: Optional[str]
    user_agent: str
    http_proxy: Optional[str]
    max_concurrent_tasks: int
    use_source_published_at: bool
    retry_failed_sources: bool
    max_source_retries: int
    fallback_review_image_url: Optional[str]
    cache_purge_url: Optional[str]
    cache_purge_secret: Optional[str]
    daily_review_limit: int


    @staticmethod
    def from_env() -> "Config":
        load_dotenv()

        def env_int(key: str, default: int) -> int:
            raw = os.getenv(key)
            if raw is None or raw.strip() == "":
                return default
            return int(raw)

        def env_float(key: str, default: float) -> float:
            raw = os.getenv(key)
            if raw is None or raw.strip() == "":
                return default
            return float(raw)

        def env_bool(key: str, default: bool) -> bool:
            raw = os.getenv(key)
            if raw is None or raw.strip() == "":
                return default
            return raw.strip().lower() in ("1", "true", "yes", "y")

        def env_optional(key: str) -> Optional[str]:
            raw = os.getenv(key)
            if raw is None:
                return None
            value = raw.strip()
            return value if value else None

        langs_raw = os.getenv("LANGS", "en,tr,de,es")
        langs = [lang.strip().lower() for lang in langs_raw.split(",") if lang.strip()]
        if "en" not in langs:
            langs.insert(0, "en")
        seen = set()
        langs = [lang for lang in langs if not (lang in seen or seen.add(lang))]

        source_base_url = os.getenv("SOURCE_BASE_URL", "https://irecommend.ru").rstrip("/")
        return Config(
            source_base_url=source_base_url,
            langs=langs,
            loop_min_seconds=env_int("LOOP_MIN_SECONDS", 480),
            loop_max_seconds=env_int("LOOP_MAX_SECONDS", 900),
            category_pages_to_scan=env_int("CATEGORY_PAGES_TO_SCAN", 2),
            http_timeout_seconds=env_int("HTTP_TIMEOUT_SECONDS", 30),
            http_max_retries=env_int("HTTP_MAX_RETRIES", 4),
            max_new_reviews_per_loop=env_int("MAX_NEW_REVIEWS_PER_LOOP", 1),
            image_crop_right_pct=env_float("IMAGE_CROP_RIGHT_PCT", 0.15),
            image_max_width=env_int("IMAGE_MAX_WIDTH", 1600),
            image_webp_quality=env_int("IMAGE_WEBP_QUALITY", 82),
            groq_api_key=os.getenv("GROQ_API_KEY", ""),
            groq_model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            supabase_url=os.getenv("SUPABASE_URL", ""),
            supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            r2_endpoint=os.getenv("R2_ENDPOINT", ""),
            r2_region=os.getenv("R2_REGION", "auto"),
            r2_access_key_id=os.getenv("R2_ACCESS_KEY_ID", ""),
            r2_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY", ""),
            r2_bucket=os.getenv("R2_BUCKET", ""),
            r2_public_base_url=os.getenv("R2_PUBLIC_BASE_URL", "").rstrip("/"),
            random_user_pool_size=env_int("RANDOM_USER_POOL_SIZE", 500),
            log_file=os.getenv("LOG_FILE"),
            user_agent=os.getenv(
                "USER_AGENT",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            ),
            http_proxy=os.getenv("HTTP_PROXY"),
            max_concurrent_tasks=env_int("MAX_CONCURRENT_TASKS", 5),
            use_source_published_at=env_bool("USE_SOURCE_PUBLISHED_AT", False),
            retry_failed_sources=env_bool("RETRY_FAILED_SOURCES", True),
            max_source_retries=env_int("MAX_SOURCE_RETRIES", 0),
            fallback_review_image_url=os.getenv("FALLBACK_REVIEW_IMAGE_URL"),
            cache_purge_url=env_optional("CACHE_PURGE_URL"),
            cache_purge_secret=env_optional("CACHE_PURGE_SECRET"),
            daily_review_limit=env_int("DAILY_REVIEW_LIMIT", 140),
        )


    def validate_required(self) -> None:
        missing = []
        if not self.groq_api_key:
            missing.append("GROQ_API_KEY")
        if not self.supabase_url:
            missing.append("SUPABASE_URL")
        if not self.supabase_service_role_key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY")
        if not self.r2_endpoint:
            missing.append("R2_ENDPOINT")
        if not self.r2_region:
            missing.append("R2_REGION")
        if not self.r2_access_key_id:
            missing.append("R2_ACCESS_KEY_ID")
        if not self.r2_secret_access_key:
            missing.append("R2_SECRET_ACCESS_KEY")
        if not self.r2_bucket:
            missing.append("R2_BUCKET")
        if not self.r2_public_base_url:
            missing.append("R2_PUBLIC_BASE_URL")
        if missing:
            raise ValueError(f"Missing required env vars: {', '.join(missing)}")
