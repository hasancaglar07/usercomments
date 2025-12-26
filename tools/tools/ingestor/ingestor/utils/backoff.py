import random
import time
from typing import Callable, Optional


def backoff_delay(attempt: int, base: float = 1.0, max_delay: float = 30.0, jitter: float = 0.2) -> float:
    exp = min(max_delay, base * (2 ** max(attempt, 0)))
    if jitter <= 0:
        return exp
    return exp + random.uniform(0, exp * jitter)


def sleep_with_backoff(attempt: int, base: float = 1.0, max_delay: float = 30.0, jitter: float = 0.2) -> None:
    time.sleep(backoff_delay(attempt, base=base, max_delay=max_delay, jitter=jitter))


def with_backoff(
    func: Callable[[], object],
    max_retries: int,
    base: float = 1.0,
    max_delay: float = 30.0,
    jitter: float = 0.2,
    on_error: Optional[Callable[[Exception, int], None]] = None,
) -> object:
    last_error: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            return func()
        except Exception as exc:
            last_error = exc
            if on_error:
                on_error(exc, attempt)
            if attempt >= max_retries:
                break
            sleep_with_backoff(attempt, base=base, max_delay=max_delay, jitter=jitter)
    if last_error:
        raise last_error
    raise RuntimeError("Backoff failed without exception")
