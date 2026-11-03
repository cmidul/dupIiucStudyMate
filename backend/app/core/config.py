"""Application configuration module using pydantic-settings.

Safely loads configuration from environment variables and local .env files.
Never prints or logs secret values.
"""

from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


# Determine base directories
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BACKEND_DIR.parent
ENV_FILE_PATH = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    """Application runtime settings."""

    model_config = SettingsConfigDict(
        env_file=(str(ENV_FILE_PATH), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # General Environment
    APP_NAME: str = "AI Learning Assistant API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security
    APP_SECRET_KEY: str = "dev-insecure-secret-key-must-be-changed-in-production-32chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./learning_assistant.db"

    # AI Provider Settings
    AI_DEFAULT_PROVIDER: str = "mock"  # gemini, groq, mock
    AI_FALLBACK_PROVIDER: str = "mock"

    # Provider Keys (Server-side only)
    GEMINI_API_KEY: Optional[str] = None
    AI_MODEL_TEXT: str = "gemini-2.0-flash"
    AI_MODEL_VISION: str = "gemini-2.0-flash"

    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL_TEXT: str = "llama-3.3-70b-versatile"

    # Telegram Integration
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_WEBHOOK_SECRET: Optional[str] = None
    TELEGRAM_BOT_USERNAME: str = "ai_learning_assistant_bot"
    TELEGRAM_BOT_SECRET: Optional[str] = None

    # Storage & Cache
    STORAGE_LOCAL_DIR: str = str(BACKEND_DIR / "storage" / "uploads")
    REDIS_URL: Optional[str] = None

    # Quotas and Rate Limits
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    MAX_QUIZ_QUESTIONS: int = 20
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_gemini_configured(self) -> bool:
        """Check whether Google Gemini API key is provided without exposing it."""
        return bool(self.GEMINI_API_KEY and self.GEMINI_API_KEY.strip() and self.GEMINI_API_KEY != "your_gemini_api_key_here")

    @property
    def is_groq_configured(self) -> bool:
        """Check whether Groq API key is provided without exposing it."""
        return bool(self.GROQ_API_KEY and self.GROQ_API_KEY.strip() and self.GROQ_API_KEY != "your_groq_api_key_here")

    @property
    def is_telegram_configured(self) -> bool:
        """Check whether Telegram bot token is provided without exposing it."""
        return bool(self.TELEGRAM_BOT_TOKEN and self.TELEGRAM_BOT_TOKEN.strip() and self.TELEGRAM_BOT_TOKEN != "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ")

    def __repr__(self) -> str:
        """Safe representation masking all sensitive fields."""
        return (
            f"Settings(app_name={self.APP_NAME!r}, environment={self.ENVIRONMENT!r}, "
            f"database_url={'sqlite' if 'sqlite' in self.DATABASE_URL else 'postgres'}, "
            f"default_ai_provider={self.AI_DEFAULT_PROVIDER!r}, "
            f"gemini_ready={self.is_gemini_configured}, "
            f"groq_ready={self.is_groq_configured}, "
            f"telegram_ready={self.is_telegram_configured})"
        )


settings = Settings()

