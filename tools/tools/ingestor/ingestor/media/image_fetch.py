import logging
from typing import Optional

from ..http_client import HttpClient


def fetch_image(http: HttpClient, url: str, logger: logging.Logger) -> Optional[bytes]:
    try:
        response = http.get(url)
        if response.status_code != 200:
            logger.warning("Image fetch failed %s: %s", response.status_code, url)
            return None
        return response.content
    except Exception as exc:
        logger.warning("Image fetch error for %s: %s", url, exc)
        return None
