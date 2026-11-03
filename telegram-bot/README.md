# Telegram Bot — AI Learning Assistant

This folder contains the Telegram Bot integration client built using `aiogram 3.x`.

## Architecture & Principles

1. **One Backend**: The bot is a thin client. All AI processing, business logic, authorization, summaries, and quizzes are executed on the shared FastAPI backend.
2. **Identity**: Users link their Telegram ID to their website user profile via secure, single-use, hashed deep links (`/start link_<token>`).
3. **Parity**: Both Telegram and Web share identical conversations, user activity, topics, and quiz attempts.

## Running the Bot

### 1. Configure Credentials

Ensure `backend/.env` contains your Bot token:
```env
TELEGRAM_BOT_TOKEN=your_token_from_botfather
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret_here
TELEGRAM_BOT_SECRET=dev-telegram-bot-secret
BACKEND_API_URL=http://localhost:8000/api/v1
```

### 2. Run Bot in Polling Mode (Local Development)

```bash
cd telegram-bot
..\.venv\Scripts\python.exe bot.py
```

### 3. Production Webhook Mode

In production, register the webhook pointing to your FastAPI backend:
`POST /api/v1/telegram/webhook` with header `X-Telegram-Bot-Api-Secret-Token`.

