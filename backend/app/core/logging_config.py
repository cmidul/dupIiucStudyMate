"""Sensitive data filtering and safe logging configuration (F-20, SEC-006).

Ensures passwords, tokens, API keys, and session cookies never leak into server logs.
"""

import logging
import re
from typing import Any


class SensitiveDataFilter(logging.Filter):
    """Filter that masks sensitive tokens, passwords, and API credentials in log messages."""

    PATTERNS = [
        # Passwords in JSON/key-value logs
        (re.compile(r'(["\']?(?:password|plain_password|new_password)["\']?\s*[:=]\s*["\'])([^"\']+)(["\'])', re.IGNORECASE), r'\1[REDACTED]\3'),
        # Bearer tokens & JWTs
        (re.compile(r'(Bearer\s+)[A-Za-z0-9\-_.]+', re.IGNORECASE), r'\1[REDACTED_JWT]'),
        (re.compile(r'eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+'), r'[REDACTED_JWT]'),
        # Telegram Bot API tokens (e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ)
        (re.compile(r'\b\d{8,12}:[A-Za-z0-9_-]{25,50}\b'), r'[REDACTED_BOT_TOKEN]'),
        # Telegram single-use linking tokens
        (re.compile(r'tg_link_[a-f0-9]{32,64}', re.IGNORECASE), r'tg_link_[REDACTED]'),
        # API Keys in query params or JSON
        (re.compile(r'(["\']?(?:api_key|apiKey|secret|access_token|cookie)["\']?\s*[:=]\s*["\'])([^"\']+)(["\'])', re.IGNORECASE), r'\1[REDACTED]\3'),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        """Sanitize record message and args before outputting."""
        if isinstance(record.msg, str):
            for pattern, replacement in self.PATTERNS:
                record.msg = pattern.sub(replacement, record.msg)

        if record.args:
            if isinstance(record.args, dict):
                sanitized_args = {}
                for k, v in record.args.items():
                    if isinstance(v, str):
                        val = v
                        for pattern, replacement in self.PATTERNS:
                            val = pattern.sub(replacement, val)
                        sanitized_args[k] = val
                    else:
                        sanitized_args[k] = v
                record.args = sanitized_args
            elif isinstance(record.args, (list, tuple)):
                sanitized_list = []
                for v in record.args:
                    if isinstance(v, str):
                        val = v
                        for pattern, replacement in self.PATTERNS:
                            val = pattern.sub(replacement, val)
                        sanitized_list.append(val)
                    else:
                        sanitized_list.append(v)
                record.args = tuple(sanitized_list)

        return True


def setup_safe_logging() -> None:
    """Attach the sensitive data filter to the root and application loggers."""
    flt = SensitiveDataFilter()
    root_logger = logging.getLogger()
    root_logger.addFilter(flt)
    for handler in root_logger.handlers:
        handler.addFilter(flt)

    app_logger = logging.getLogger("learning_assistant")
    app_logger.addFilter(flt)
    for handler in app_logger.handlers:
        handler.addFilter(flt)
