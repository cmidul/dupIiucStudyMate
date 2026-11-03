"""Aiogram 3.x Telegram Bot Client for AI Learning Assistant.

Thin client: validates Telegram updates, calls the shared FastAPI backend,
and formats responses without duplicating any AI or business logic.
"""

import asyncio
import logging
from typing import Optional
import httpx
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command, CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from config import BACKEND_API_URL, TELEGRAM_BOT_SECRET, TELEGRAM_BOT_TOKEN

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("telegram_bot")

dp = Dispatcher()


def get_backend_headers() -> dict:
    """Provide trusted bot headers for backend API communication."""
    return {
        "X-Telegram-Bot-Secret": TELEGRAM_BOT_SECRET,
        "Accept": "application/json",
    }


@dp.message(CommandStart())
async def handle_start(message: types.Message):
    """Handle /start command, including deep-link account linking."""
    text = message.text or ""
    parts = text.split(maxsplit=1)
    telegram_id = str(message.from_user.id)
    username = message.from_user.username

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Check if deep link token provided: /start link_<token>
        if len(parts) > 1 and parts[1].startswith("link_"):
            raw_token = parts[1][5:].strip()
            payload = {
                "token": raw_token,
                "telegram_id": telegram_id,
                "telegram_username": username,
            }
            res = await client.post(
                f"{BACKEND_API_URL}/telegram/complete-link",
                headers=get_backend_headers(),
                json=payload,
            )
            if res.status_code == 200:
                await message.answer(
                    "🎉 <b>Account Linked Successfully!</b>\n\n"
                    "Your Telegram account is now connected to your AI Learning Assistant.\n"
                    "You can now ask questions, send photos of notes/equations, or use /quiz and /summarize.",
                    parse_mode="HTML",
                )
            else:
                err_detail = res.json().get("error", {}).get("message", "Invalid or expired token.")
                await message.answer(f"❌ <b>Linking Failed:</b> {err_detail}", parse_mode="HTML")
            return

        # Check existing link status
        user_res = await client.get(
            f"{BACKEND_API_URL}/telegram/user/{telegram_id}",
            headers=get_backend_headers(),
        )
        if user_res.status_code == 200:
            user = user_res.json().get("data", {})
            name = user.get("name") or "Student"
            await message.answer(
                f"👋 <b>Welcome back, {name}!</b>\n\n"
                "I am your AI Learning Assistant. Here is what you can do:\n"
                "• 💬 Send any question to get structured explanations\n"
                "• 📸 Send a picture of notes, slides, or equations\n"
                "• /summarize - Create quick summaries\n"
                "• /quiz - Test your knowledge\n"
                "• /help - View guide and examples",
                parse_mode="HTML",
            )
        else:
            await message.answer(
                "👋 <b>Welcome to AI Learning Assistant!</b>\n\n"
                "To access personalized features and sync your history across web and mobile:\n\n"
                "1. Sign in to your account on the website\n"
                "2. Go to <b>Settings → Link Telegram</b>\n"
                "3. Click <b>Connect Bot</b> to activate your account",
                parse_mode="HTML",
            )


@dp.message(Command("help"))
async def handle_help(message: types.Message):
    """Handle /help command."""
    await message.answer(
        "📚 <b>AI Learning Assistant Help</b>\n\n"
        "<b>Commands:</b>\n"
        "• /start - Welcome and account linking\n"
        "• /help - Show this guide\n"
        "• /summarize - Summarize notes or topics\n"
        "• /quiz - Create practice questions\n"
        "• /solve - Math & logical reasoning solver\n"
        "• /history - View your recent activity\n"
        "• /website - Open website application\n\n"
        "<b>Tips:</b>\n"
        "• Type any subject question directly to receive explanations with examples.\n"
        "• Upload textbook images or slides to analyze formulas and key concepts.",
        parse_mode="HTML",
    )


@dp.message(Command("website"))
async def handle_website(message: types.Message):
    """Handle /website command."""
    await message.answer("🌐 <b>Website:</b> http://localhost:3000", parse_mode="HTML")


@dp.message(F.text)
async def handle_text_message(message: types.Message):
    """Handle ordinary text questions through shared backend chat service."""
    telegram_id = str(message.from_user.id)
    text = message.text.strip()

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Verify user is linked
        user_res = await client.get(
            f"{BACKEND_API_URL}/telegram/user/{telegram_id}",
            headers=get_backend_headers(),
        )
        if user_res.status_code != 200:
            await message.answer(
                "⚠️ <b>Account Not Linked</b>\n\n"
                "Please link your website account first by going to <b>Settings → Link Telegram</b> on the website.",
                parse_mode="HTML",
            )
            return

        user_id = user_res.json()["data"]["id"]

        # 2. Call shared backend chat API
        chat_res = await client.post(
            f"{BACKEND_API_URL}/chat/message",
            json={"message": text},
            headers={"X-User-ID": user_id, "X-Telegram-Bot-Secret": TELEGRAM_BOT_SECRET},
        )

        if chat_res.status_code != 200:
            await message.answer("❌ Service temporarily unavailable. Please try again later.")
            return

        chat_data = chat_res.json()["data"]
        conv_id = chat_data["conversation_id"]
        answer = chat_data["message"]["content"]
        topic_info = chat_data.get("topic", {})
        topic_name = topic_info.get("topic", "General")
        difficulty = topic_info.get("difficulty", "beginner")

        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(text="📝 Summarize", callback_data=f"sum:{conv_id}"),
                    InlineKeyboardButton(text="🎯 Practice Quiz", callback_data=f"quiz:{conv_id}"),
                ]
            ]
        )

        reply = f"💡 <b>Topic:</b> {topic_name} ({difficulty})\n\n{answer}"
        await message.answer(reply, parse_mode="HTML", reply_markup=keyboard)


@dp.callback_query()
async def handle_callbacks(callback: types.CallbackQuery):
    """Handle inline button actions."""
    await callback.answer("Processing request...")
    data = callback.data or ""
    telegram_id = str(callback.from_user.id)

    async with httpx.AsyncClient(timeout=30.0) as client:
        user_res = await client.get(
            f"{BACKEND_API_URL}/telegram/user/{telegram_id}",
            headers=get_backend_headers(),
        )
        if user_res.status_code != 200:
            await callback.message.answer("⚠️ Please link your account first.")
            return

        user_id = user_res.json()["data"]["id"]

        if data.startswith("sum:"):
            conv_id = data[4:].strip()
            sum_res = await client.post(
                f"{BACKEND_API_URL}/summaries/generate",
                json={"conversation_id": conv_id, "style": "detailed"},
                headers={"X-User-ID": user_id, "X-Telegram-Bot-Secret": TELEGRAM_BOT_SECRET},
            )
            if sum_res.status_code == 201:
                s_data = sum_res.json()["data"]
                await callback.message.answer(
                    f"📝 <b>Summary: {s_data['title']}</b>\n\n{s_data['content']}",
                    parse_mode="HTML",
                )
            else:
                await callback.message.answer("❌ Unable to generate summary. Please try again.")

        elif data.startswith("quiz:"):
            conv_id = data[5:].strip()
            quiz_res = await client.post(
                f"{BACKEND_API_URL}/quizzes/generate",
                json={"conversation_id": conv_id, "question_count": 3, "difficulty": "intermediate"},
                headers={"X-User-ID": user_id, "X-Telegram-Bot-Secret": TELEGRAM_BOT_SECRET},
            )
            if quiz_res.status_code == 201:
                q_data = quiz_res.json()["data"]
                msg = f"🎯 <b>Practice Quiz: {q_data['title']}</b>\n\n"
                for i, q in enumerate(q_data["questions"], 1):
                    msg += f"<b>Q{i}. {q['question']}</b>\n"
                    for opt in q["options"]:
                        msg += f"  [{opt['id']}] {opt['text']}\n"
                    msg += "\n"
                await callback.message.answer(msg, parse_mode="HTML")
            else:
                await callback.message.answer("❌ Unable to generate quiz. Please try again.")


async def main():
    """Bot runner entrypoint."""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN is not set. Please configure it in backend/.env")
        return

    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    logger.info("Starting Telegram bot polling...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

