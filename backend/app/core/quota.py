"""User daily quota and cost protection manager (F-17, SEC-002).

Ensures AI providers and heavy computational resources are never invoked once
a user exceeds their configured daily quota, preventing unexpected billing spikes.
"""

from datetime import datetime, timezone
import threading
from typing import Dict, Optional, Tuple

from app.core.config import settings
from app.core.responses import AppException


class QuotaManager:
    """Thread-safe daily usage and quota manager per user."""

    def __init__(self):
        self._usage: Dict[Tuple[str, str, str], int] = {}  # (user_id, category, date_str) -> count
        self._custom_limits: Dict[Tuple[str, str], int] = {}  # (user_id, category) -> custom limit
        self._default_limits: Dict[str, int] = {
            "ai_chat": settings.DAILY_AI_REQUESTS_QUOTA,
            "image_upload": settings.DAILY_IMAGE_UPLOADS_QUOTA,
            "summary": settings.DAILY_SUMMARY_QUOTA,
            "quiz": settings.DAILY_QUIZ_QUOTA,
            "solver": settings.DAILY_SOLVER_QUOTA,
        }
        self._lock = threading.Lock()

    def _get_today_str(self) -> str:
        """Return current date in UTC ISO format (YYYY-MM-DD)."""
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def set_quota(self, category: str, limit: int, user_id: Optional[str] = None) -> None:
        """Configure quota limit for a category globally or for a specific user."""
        with self._lock:
            if user_id:
                self._custom_limits[(user_id, category)] = limit
            else:
                self._default_limits[category] = limit

    def get_limit(self, user_id: str, category: str) -> int:
        """Get the effective quota limit for a user and category."""
        with self._lock:
            if (user_id, category) in self._custom_limits:
                return self._custom_limits[(user_id, category)]
            return self._default_limits.get(category, 50)

    def get_usage(self, user_id: str, category: str) -> int:
        """Get current usage for today."""
        today = self._get_today_str()
        with self._lock:
            return self._usage.get((user_id, category, today), 0)

    def check_quota(self, user_id: str, category: str) -> None:
        """Check if user has remaining quota before performing an AI or heavy operation.

        Raises:
            AppException(code='QUOTA_EXCEEDED', status_code=429) if limit is reached.
        """
        today = self._get_today_str()
        with self._lock:
            limit = self._custom_limits.get((user_id, category), self._default_limits.get(category, 50))
            current = self._usage.get((user_id, category, today), 0)

            if current >= limit:
                raise AppException(
                    code="QUOTA_EXCEEDED",
                    message=f"Daily quota limit of {limit} for '{category}' exceeded. Try again tomorrow.",
                    status_code=429,
                    details={
                        "category": category,
                        "limit": limit,
                        "current_usage": current,
                        "resets_at_utc": f"{today}T23:59:59Z",
                    },
                )

    def record_usage(self, user_id: str, category: str, count: int = 1) -> int:
        """Record successful usage after the operation completes.

        Returns:
            Updated usage count for today.
        """
        today = self._get_today_str()
        with self._lock:
            key = (user_id, category, today)
            new_val = self._usage.get(key, 0) + count
            self._usage[key] = new_val
            return new_val

    def reset(self, user_id: Optional[str] = None) -> None:
        """Reset usage and custom limits (useful for testing and daily cron)."""
        with self._lock:
            if user_id:
                keys_to_remove = [k for k in self._usage if k[0] == user_id]
                for k in keys_to_remove:
                    self._usage.pop(k, None)
                custom_to_remove = [k for k in self._custom_limits if k[0] == user_id]
                for k in custom_to_remove:
                    self._custom_limits.pop(k, None)
            else:
                self._usage.clear()
                self._custom_limits.clear()


# Shared quota manager instance
quota_manager = QuotaManager()

