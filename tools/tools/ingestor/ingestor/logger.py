import logging
import sys
from typing import Optional

from rich.console import Console
from rich.logging import RichHandler
from rich.theme import Theme

# Premium Theme Definition
custom_theme = Theme({
    "info": "cyan",
    "warning": "yellow",
    "error": "bold red",
    "critical": "bold white on red",
    "logging.level.info": "bold blue",
    "logging.level.warning": "bold yellow",
    "logging.level.error": "bold red",
})

console = Console(theme=custom_theme)

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
    
    # Avoid duplicate handlers if setup is called multiple times
    if logger.hasHandlers():
        logger.handlers.clear()
        
    logger.setLevel(logging.INFO)

    # 1. Premium Console Handler (Rich)
    rich_handler = RichHandler(
        console=console,
        show_time=True,
        show_level=True,
        show_path=False,  # Cleaner look without file paths in every line
        enable_link_path=True,
        rich_tracebacks=True, # Beautiful error tracebacks
        markup=True,
        log_time_format="[%X]"
    )
    rich_handler.setFormatter(logging.Formatter("%(message)s"))
    rich_handler.addFilter(RunIdFilter(run_id))
    logger.addHandler(rich_handler)

    # 2. File Handler (Standard Text for permanent logs)
    if log_file:
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_fmt = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(run_id)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        file_handler.setFormatter(file_fmt)
        file_handler.addFilter(RunIdFilter(run_id))
        logger.addHandler(file_handler)

    return logger
