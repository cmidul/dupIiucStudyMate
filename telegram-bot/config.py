"""Telegram bot configuration."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment from root or backend .env
BOT_DIR = Path(__file__).resolve().parent
ROOT_DIR = BOT_DIR.parent
ENV_PATH = ROOT_DIR / "backend" / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:8000/api/v1")
TELEGRAM_BOT_SECRET = os.getenv("TELEGRAM_BOT_SECRET", "dev-telegram-bot-secret")
WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")

