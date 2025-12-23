import logging
import sys
from typing import Optional


def setup_logging(log_file: Optional[str] = None) -> logging.Logger:
    logger = logging.getLogger("ingestor")
    logger.setLevel(logging.INFO)



    if logger.handlers:
        return logger

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass


    stream_handler = logging.StreamHandler(sys.stdout)

    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    if log_file:
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)


    return logger
