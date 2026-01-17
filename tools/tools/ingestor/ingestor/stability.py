"""
Stability enhancements for the ingestor bot.
- Graceful shutdown handling
- Circuit breaker pattern for API resilience
- Rate limiting
"""

import os
import time
import signal
import threading
from typing import Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime


# ============================================================================
# GRACEFUL SHUTDOWN
# ============================================================================
class GracefulShutdown:
    """
    Handles graceful shutdown on SIGINT/SIGTERM.
    Allows current task to complete before exiting.
    """
    _instance: Optional['GracefulShutdown'] = None
    
    def __init__(self):
        self._shutdown_requested = False
        self._force_count = 0
        self._lock = threading.Lock()
        
    @classmethod
    def get_instance(cls) -> 'GracefulShutdown':
        if cls._instance is None:
            cls._instance = GracefulShutdown()
        return cls._instance
    
    def request_shutdown(self):
        with self._lock:
            if self._shutdown_requested:
                self._force_count += 1
                if self._force_count >= 2:
                    print("\n[!] Force shutdown...")
                    os._exit(1)
            else:
                self._shutdown_requested = True
                print("\n[!] Graceful shutdown requested. Finishing current task...")
    
    @property
    def should_stop(self) -> bool:
        return self._shutdown_requested
    
    def reset(self):
        with self._lock:
            self._shutdown_requested = False
            self._force_count = 0


def setup_signal_handlers():
    """Setup signal handlers for graceful shutdown."""
    shutdown = GracefulShutdown.get_instance()
    
    def handler(sig, frame):
        shutdown.request_shutdown()
    
    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)
    
    return shutdown


# ============================================================================
# CIRCUIT BREAKER
# ============================================================================
@dataclass
class CircuitBreaker:
    """
    Circuit breaker pattern for API calls.
    
    States:
    - CLOSED: Normal operation, all calls allowed
    - OPEN: Too many failures, reject all calls for reset_timeout
    - HALF_OPEN: After timeout, allow one test call
    
    Usage:
        cb = CircuitBreaker("groq")
        if cb.can_execute():
            try:
                result = api_call()
                cb.record_success()
            except Exception:
                cb.record_failure()
        else:
            # Circuit is open, skip or use fallback
    """
    name: str
    failure_threshold: int = 5
    reset_timeout: int = 300  # seconds
    
    # Internal state
    failures: int = field(default=0, repr=False)
    last_failure_time: Optional[float] = field(default=None, repr=False)
    state: str = field(default="closed", repr=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    
    def record_success(self):
        with self._lock:
            self.failures = 0
            self.state = "closed"
    
    def record_failure(self):
        with self._lock:
            self.failures += 1
            self.last_failure_time = time.time()
            if self.failures >= self.failure_threshold:
                self.state = "open"
    
    def can_execute(self) -> bool:
        with self._lock:
            if self.state == "closed":
                return True
            if self.state == "open":
                # Check if we should enter half-open state
                if self.last_failure_time and (time.time() - self.last_failure_time > self.reset_timeout):
                    self.state = "half_open"
                    return True
                return False
            # half_open - allow one try
            return True
    
    def get_status(self) -> dict:
        return {
            "name": self.name,
            "state": self.state,
            "failures": self.failures,
            "threshold": self.failure_threshold,
            "reset_timeout": self.reset_timeout,
        }
    
    def reset(self):
        with self._lock:
            self.failures = 0
            self.state = "closed"
            self.last_failure_time = None


class CircuitBreakerRegistry:
    """Global registry for circuit breakers."""
    _breakers: dict = {}
    _lock = threading.Lock()
    
    @classmethod
    def get(cls, name: str, **kwargs) -> CircuitBreaker:
        with cls._lock:
            if name not in cls._breakers:
                cls._breakers[name] = CircuitBreaker(name, **kwargs)
            return cls._breakers[name]
    
    @classmethod
    def get_all_status(cls) -> dict:
        with cls._lock:
            return {name: cb.get_status() for name, cb in cls._breakers.items()}
    
    @classmethod
    def reset_all(cls):
        with cls._lock:
            for cb in cls._breakers.values():
                cb.reset()


# Pre-configured circuit breakers for common services
def get_groq_breaker() -> CircuitBreaker:
    return CircuitBreakerRegistry.get("groq", failure_threshold=5, reset_timeout=60)

def get_supabase_breaker() -> CircuitBreaker:
    return CircuitBreakerRegistry.get("supabase", failure_threshold=10, reset_timeout=30)

def get_r2_breaker() -> CircuitBreaker:
    return CircuitBreakerRegistry.get("r2", failure_threshold=5, reset_timeout=60)

def get_source_breaker() -> CircuitBreaker:
    return CircuitBreakerRegistry.get("source", failure_threshold=3, reset_timeout=120)


# ============================================================================
# RATE LIMITER
# ============================================================================
@dataclass
class TokenBucketRateLimiter:
    """
    Token bucket rate limiter.
    
    Usage:
        limiter = TokenBucketRateLimiter(requests_per_minute=30)
        if limiter.acquire():
            make_request()
        else:
            wait_time = limiter.time_until_available()
            await asyncio.sleep(wait_time)
    """
    requests_per_minute: int
    tokens: float = field(init=False)
    last_refill: float = field(init=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    
    def __post_init__(self):
        self.tokens = float(self.requests_per_minute)
        self.last_refill = time.time()
    
    def _refill(self):
        now = time.time()
        elapsed = now - self.last_refill
        tokens_to_add = elapsed * (self.requests_per_minute / 60.0)
        self.tokens = min(float(self.requests_per_minute), self.tokens + tokens_to_add)
        self.last_refill = now
    
    def acquire(self, tokens: int = 1) -> bool:
        with self._lock:
            self._refill()
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False
    
    def time_until_available(self, tokens: int = 1) -> float:
        with self._lock:
            self._refill()
            if self.tokens >= tokens:
                return 0.0
            needed = tokens - self.tokens
            return needed / (self.requests_per_minute / 60.0)


# ============================================================================
# PROCESSING STATS
# ============================================================================
@dataclass
class ProcessingStats:
    """Track processing statistics for monitoring."""
    total_processed: int = 0
    total_failed: int = 0
    total_skipped: int = 0
    start_time: float = field(default_factory=time.time)
    last_success_time: Optional[float] = None
    last_error: Optional[str] = None
    last_error_time: Optional[float] = None
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)
    
    def record_success(self):
        with self._lock:
            self.total_processed += 1
            self.last_success_time = time.time()
    
    def record_failure(self, error: str):
        with self._lock:
            self.total_failed += 1
            self.last_error = error
            self.last_error_time = time.time()
    
    def record_skip(self):
        with self._lock:
            self.total_skipped += 1
    
    def get_summary(self) -> dict:
        with self._lock:
            uptime = time.time() - self.start_time
            success_rate = (
                self.total_processed / (self.total_processed + self.total_failed) * 100
                if (self.total_processed + self.total_failed) > 0
                else 0
            )
            return {
                "total_processed": self.total_processed,
                "total_failed": self.total_failed,
                "total_skipped": self.total_skipped,
                "success_rate": f"{success_rate:.1f}%",
                "uptime_hours": f"{uptime / 3600:.2f}",
                "last_success": datetime.fromtimestamp(self.last_success_time).isoformat() if self.last_success_time else None,
                "last_error": self.last_error,
            }


# Global stats instance
_stats = ProcessingStats()

def get_stats() -> ProcessingStats:
    return _stats
