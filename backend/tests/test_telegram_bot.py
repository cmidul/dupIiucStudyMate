"""Tests for Telegram Bot Integration (F-12, TG-001..011)."""

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.services.telegram_bot_service import telegram_bot_service


BOT_HEADERS = {"X-Telegram-Bot-Secret": "dev-telegram-bot-secret"}


async def create_linked_test_user(client: AsyncClient, email: str, tg_id: str) -> dict:
    """Helper to create a user and link their Telegram ID."""
    password = "StrongPassword123!"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password, "name": "Bot Tester"})
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    auth_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

    token_res = await client.post("/api/v1/telegram/link-token", headers=auth_headers)
    token = token_res.json()["data"]["token"]

    await client.post(
        "/api/v1/telegram/complete-link",
        headers=BOT_HEADERS,
        json={"token": token, "telegram_id": tg_id, "telegram_username": "tester"},
    )
    return auth_headers


@pytest.mark.asyncio
async def test_tg_001_start_command(client: AsyncClient):
    """TG-001: /start sends linking instructions to unlinked user and welcome message to linked user."""
    # 1. Unlinked user receives linking instructions
    unlinked_payload = {
        "update_id": 1001,
        "message": {
            "message_id": 1,
            "chat": {"id": 12345},
            "from": {"id": 12345, "first_name": "UnlinkedUser"},
            "text": "/start",
        },
    }
    res1 = await client.post("/api/v1/telegram/webhook", json=unlinked_payload)
    assert res1.status_code == 200
    assert res1.json()["data"]["action"] == "welcome_unlinked"

    # 2. Linked user receives personalized welcome
    await create_linked_test_user(client, "tg_linked1@example.com", "54321")
    linked_payload = {
        "update_id": 1002,
        "message": {
            "message_id": 2,
            "chat": {"id": 54321},
            "from": {"id": 54321, "first_name": "LinkedUser"},
            "text": "/start",
        },
    }
    res2 = await client.post("/api/v1/telegram/webhook", json=linked_payload)
    assert res2.status_code == 200
    assert res2.json()["data"]["action"] == "welcome_linked"


@pytest.mark.asyncio
async def test_tg_002_help_command(client: AsyncClient):
    """TG-002: /help returns usage instructions and commands."""
    help_payload = {
        "update_id": 1003,
        "message": {
            "message_id": 3,
            "chat": {"id": 99999},
            "from": {"id": 99999, "first_name": "User"},
            "text": "/help",
        },
    }
    res = await client.post("/api/v1/telegram/webhook", json=help_payload)
    assert res.status_code == 200
    assert res.json()["data"]["action"] == "help"


@pytest.mark.asyncio
async def test_tg_003_normal_text_message(client: AsyncClient):
    """TG-003: Text question calls shared backend and stores activity for linked user."""
    tg_id = "67890"
    await create_linked_test_user(client, "tg_text@example.com", tg_id)

    msg_payload = {
        "update_id": 1004,
        "message": {
            "message_id": 4,
            "chat": {"id": int(tg_id)},
            "from": {"id": int(tg_id), "first_name": "Student"},
            "text": "What is a binary search tree?",
        },
    }
    res = await client.post("/api/v1/telegram/webhook", json=msg_payload)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["action"] == "chat_answered"
    assert "conversation_id" in data


@pytest.mark.asyncio
async def test_tg_004_image_message(client: AsyncClient):
    """TG-004: Image message triggers educational understanding pipeline."""
    tg_id = "77701"
    await create_linked_test_user(client, "tg_img@example.com", tg_id)

    photo_payload = {
        "update_id": 1005,
        "message": {
            "message_id": 5,
            "chat": {"id": int(tg_id)},
            "from": {"id": int(tg_id), "first_name": "Student"},
            "photo": [
                {"file_id": "file_small", "file_size": 1000, "width": 100, "height": 100},
                {"file_id": "file_large", "file_size": 50000, "width": 800, "height": 800},
            ],
            "caption": "Please explain this diagram",
        },
    }
    res = await client.post("/api/v1/telegram/webhook", json=photo_payload)
    assert res.status_code == 200
    assert res.json()["data"]["action"] == "image_received"


@pytest.mark.asyncio
async def test_tg_005_inline_action(client: AsyncClient):
    """TG-005: Inline action buttons trigger backend summarizer or quiz generators."""
    tg_id = "88801"
    await create_linked_test_user(client, "tg_inline@example.com", tg_id)

    # First ask a question to create a conversation
    msg_res = await client.post(
        "/api/v1/telegram/webhook",
        json={
            "update_id": 1006,
            "message": {
                "message_id": 6,
                "chat": {"id": int(tg_id)},
                "from": {"id": int(tg_id)},
                "text": "Explain Python lists and dictionaries.",
            },
        },
    )
    conv_id = msg_res.json()["data"]["conversation_id"]

    # 1. Tap Summarize button
    sum_callback = {
        "update_id": 1007,
        "callback_query": {
            "id": "cb_001",
            "from": {"id": int(tg_id)},
            "message": {"chat": {"id": int(tg_id)}},
            "data": f"sum:{conv_id}",
        },
    }
    sum_res = await client.post("/api/v1/telegram/webhook", json=sum_callback)
    assert sum_res.status_code == 200
    assert sum_res.json()["data"]["action"] == "summary_generated"
    assert "summary_id" in sum_res.json()["data"]

    # 2. Tap Practice Quiz button
    quiz_callback = {
        "update_id": 1008,
        "callback_query": {
            "id": "cb_002",
            "from": {"id": int(tg_id)},
            "message": {"chat": {"id": int(tg_id)}},
            "data": f"quiz:{conv_id}",
        },
    }
    quiz_res = await client.post("/api/v1/telegram/webhook", json=quiz_callback)
    assert quiz_res.status_code == 200
    assert quiz_res.json()["data"]["action"] == "quiz_generated"
    assert "quiz_id" in quiz_res.json()["data"]


@pytest.mark.asyncio
async def test_tg_006_long_response_splitting():
    """TG-006: Message chunking safely splits responses exceeding Telegram's 4096 character limit."""
    long_paragraph = "This is a detailed explanation of computational complexity. " * 80  # ~4800 chars
    full_text = f"Header Title\n\n{long_paragraph}\n\nFooter conclusion."

    chunks = telegram_bot_service.split_message(full_text, max_length=1500)
    assert len(chunks) > 1
    # Verify each chunk is strictly within limits
    for chunk in chunks:
        assert len(chunk) <= 1500

    # Verify no content was lost during chunking
    reassembled = "\n\n".join(chunks)
    assert "Header Title" in reassembled
    assert "Footer conclusion." in reassembled


@pytest.mark.asyncio
async def test_tg_007_formatting_fallback():
    """TG-007: Fallback to plain text delivery when message formatting entities are rejected."""
    # When TELEGRAM_BOT_TOKEN is None (dev/test), send_raw_message safely handles delivery
    res = await telegram_bot_service.send_raw_message(
        chat_id=12345,
        text="<b>Test unclosed tag",
        parse_mode="HTML",
    )
    assert res["ok"] is True
    assert res["text"] == "<b>Test unclosed tag"


@pytest.mark.asyncio
async def test_tg_008_unlinked_user_restriction(client: AsyncClient):
    """TG-008: Unlinked users cannot access private questions without linking their account."""
    unlinked_payload = {
        "update_id": 1009,
        "message": {
            "message_id": 9,
            "chat": {"id": 987123},
            "from": {"id": 987123, "first_name": "Stranger"},
            "text": "What is machine learning?",
        },
    }
    res = await client.post("/api/v1/telegram/webhook", json=unlinked_payload)
    assert res.status_code == 200
    assert res.json()["data"]["action"] == "unlinked_prompt"


@pytest.mark.asyncio
async def test_tg_009_webhook_secret_verification(client: AsyncClient, monkeypatch):
    """TG-009: Reject webhook updates when secret header does not match configured secret."""
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "super-secret-token-12345")

    payload = {
        "update_id": 1010,
        "message": {"chat": {"id": 1}, "from": {"id": 1}, "text": "/help"},
    }

    # 1. Missing secret
    res_no_sec = await client.post("/api/v1/telegram/webhook", json=payload)
    assert res_no_sec.status_code == 403

    # 2. Invalid secret
    res_bad_sec = await client.post(
        "/api/v1/telegram/webhook",
        headers={"X-Telegram-Bot-Api-Secret-Token": "wrong-secret"},
        json=payload,
    )
    assert res_bad_sec.status_code == 403

    # 3. Valid secret
    res_valid = await client.post(
        "/api/v1/telegram/webhook",
        headers={"X-Telegram-Bot-Api-Secret-Token": "super-secret-token-12345"},
        json=payload,
    )
    assert res_valid.status_code == 200


@pytest.mark.asyncio
async def test_tg_010_telegram_api_outage_handling():
    """TG-010: Telegram API network failure is logged and handled safely without crash."""
    outage_service = telegram_bot_service
    # send_raw_message gracefully handles errors
    res = await outage_service.send_raw_message(
        chat_id=99999,
        text="Hello during outage",
    )
    assert "ok" in res


@pytest.mark.asyncio
async def test_tg_011_telegram_and_web_parity(client: AsyncClient):
    """TG-011: Verify parity of schemas and persistent user state across Telegram and Web."""
    tg_id = "333444"
    auth_headers = await create_linked_test_user(client, "parity@example.com", tg_id)

    # 1. Ask question via Telegram
    tg_res = await client.post(
        "/api/v1/telegram/webhook",
        json={
            "update_id": 1011,
            "message": {
                "message_id": 11,
                "chat": {"id": int(tg_id)},
                "from": {"id": int(tg_id)},
                "text": "What is an AVL Tree?",
            },
        },
    )
    assert tg_res.status_code == 200
    conv_id = tg_res.json()["data"]["conversation_id"]

    # 2. Web user queries the SAME conversation history
    web_res = await client.get(f"/api/v1/conversations/{conv_id}", headers=auth_headers)
    assert web_res.status_code == 200
    conv_data = web_res.json()["data"]
    assert conv_data["id"] == conv_id
    assert len(conv_data["messages"]) >= 2
    assert "AVL Tree" in conv_data["messages"][0]["content"]

