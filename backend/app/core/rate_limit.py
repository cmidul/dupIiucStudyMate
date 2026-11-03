"""In-memory sliding window rate limiter for user and IP requests (F-17, SEC-001).

Applies consistent limits across both Web and Telegram interfaces for the same user.
"""

from collections import deque
import threading
import time
from typing import Dict, Optional, Tuple

from app.core.config import settings


class RateLimiter:
    """Thread-safe sliding window rate limiter."""

    def __init__(self, default_limit: Optional[int] = None, window_seconds: int = 60):
        self.default_limit = default_limit or settings.RATE_LIMIT_REQUESTS_PER_MINUTE
        self.window_seconds = window_seconds
        self._history: Dict[str, deque[float]] = {}
        self._custom_limits: Dict[str, int] = {}
        self._lock = threading.Lock()

    def set_limit_for_key(self, key: str, limit: int) -> None:
        """Override rate limit for a specific key (useful for tests or tiering)."""
        with self._lock:
            self._custom_limits[key] = limit

    def record_request(
        self,
        key: str,
        limit: Optional[int] = None,
        window_seconds: Optional[int] = None,
    ) -> Tuple[bool, int, float]:
        """Record a request for key and check if it exceeds the sliding window rate limit.

        Returns:
            Tuple of:
            - is_limited (bool): True if rate limit is exceeded, False otherwise
            - remaining (int): Number of requests remaining in current window
            - retry_after (float): Seconds to wait before next allowed request
        """
        now = time.time()
        win = window_seconds or self.window_seconds

        with self._lock:
            max_reqs = self._custom_limits.get(key, limit or self.default_limit)

            if key not in self._history:
                self._history[key] = deque()

            bucket = self._history[key]

            # Evict timestamps outside sliding window
            cutoff = now - win
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= max_reqs:
                oldest = bucket[0]
                retry_after = max(0.1, (oldest + win) - now)
                return True, 0, retry_after

            # Record current timestamp
            bucket.append(now)
            remaining = max(0, max_reqs - len(bucket))
            return False, remaining, 0.0

    def get_remaining(
        self,
        key: str,
        limit: Optional[int] = None,
        window_seconds: Optional[int] = None,
    ) -> int:
        """Check remaining requests without incrementing."""
        now = time.time()
        win = window_seconds or self.window_seconds
        with self._lock:
            max_reqs = self._custom_limits.get(key, limit or self.default_limit)
            bucket = self._history.get(key)
            if not bucket:
                return max_reqs
            cutoff = now - win
            active = sum(1 for t in bucket if t > cutoff)
            return max(0, max_reqs - active)

    def reset(self, key: Optional[str] = None) -> None:
        """Reset rate limit history for a specific key or all keys."""
        with self._lock:
            if key:
                self._history.pop(key, None)
                self._custom_limits.pop(key, None)
            else:
                self._history.clear()
                self._custom_limits.clear()


# Shared rate limiter instance
rate_limiter = RateLimiter()
