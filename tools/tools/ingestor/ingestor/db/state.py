import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from .supabase_client import SupabaseClient


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def upsert_source_map(
    supabase: SupabaseClient,
    source_items: List[Dict[str, Any]],
    logger: logging.Logger,
) -> int:
    if not source_items:
        return 0
    payload = []
    for item in source_items:
        payload.append(
            {
                "source_url": item["source_url"],
                "source_slug": item.get("source_slug"),
                "last_seen_at": _now_iso(),
            }
        )
    supabase.upsert("source_map", payload, on_conflict="source_url")
    logger.info("Source map upserted: %s", len(payload))
    return len(payload)


def fetch_new_sources(
    supabase: SupabaseClient,
    limit: int,
    include_failed: bool = False,
    max_retries: Optional[int] = None,
) -> List[Dict[str, Any]]:
    # Default to 3 retries if not specified - prevents infinite retry loops
    effective_max_retries = max_retries if max_retries and max_retries > 0 else 3
    
    if include_failed:
        filters: List[Tuple[str, str, Any]] = [("in", "status", ["new", "failed"])]
        # Always filter by max retries for failed items
        filters.append(("lt", "retries", effective_max_retries))
    else:
        filters = [("eq", "status", "new")]
    return supabase.select(
        "source_map",
        columns="source_url, source_slug, retries, status",
        filters=filters,
        order=("discovered_at", True),
        limit=limit,
    )



def mark_processing(supabase: SupabaseClient, source_url: str) -> None:
    supabase.update(
        "source_map",
        {"status": "processing", "last_seen_at": _now_iso()},
        filters=[("eq", "source_url", source_url)],
    )


def mark_processed(supabase: SupabaseClient, source_url: str, content_hash: Optional[str]) -> None:
    updates = {"status": "processed", "last_seen_at": _now_iso()}
    if content_hash:
        updates["content_hash"] = content_hash
    supabase.update(
        "source_map",
        updates,
        filters=[("eq", "source_url", source_url)],
    )


def mark_failed(
    supabase: SupabaseClient,
    source_url: str,
    retries: int,
    error: str,
) -> None:
    supabase.update(
        "source_map",
        {
            "status": "failed",
            "retries": retries,
            "last_error": error[:500],
            "last_seen_at": _now_iso(),
        },
        filters=[("eq", "source_url", source_url)],
    )
