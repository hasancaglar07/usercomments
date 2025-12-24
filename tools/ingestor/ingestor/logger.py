import logging
import sys
from typing import Optional


class RunIdFilter(logging.Filter):
    def __init__(self, run_id: Optional[str] = None) -> None:
        super().__init__()
        self.run_id = run_id or "-"

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "run_id"):
            record.run_id = self.run_id
        return True


def _ensure_run_id_filter(logger: logging.Logger, run_id: Optional[str]) -> None:
    for existing in logger.filters:
        if isinstance(existing, RunIdFilter):
            existing.run_id = run_id or "-"
            return
    logger.addFilter(RunIdFilter(run_id))


def setup_logging(log_file: Optional[str] = None, run_id: Optional[str] = None) -> logging.Logger:
    logger = logging.getLogger("ingestor")
    logger.setLevel(logging.INFO)

    if logger.handlers:
        _ensure_run_id_filter(logger, run_id)
        return logger

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(run_id)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass


    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    stream_handler.addFilter(RunIdFilter(run_id))
    logger.addHandler(stream_handler)

    if log_file:
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(formatter)
        file_handler.addFilter(RunIdFilter(run_id))
        logger.addHandler(file_handler)

    return logger
