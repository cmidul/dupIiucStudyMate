"""Tests for Telegram Account Linking (F-02, LINK-001..007)."""

from datetime import datetime, timedelta, timezone
import hashlib
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telegram_link import TelegramLinkToken
from app.models.user import User


BOT_HEADERS = {"X-Telegram-Bot-Secret": "dev-telegram-bot-secret"}


async def get_test_auth(client: AsyncClient, email: str = "telegram_user@example.com") -> dict:
    """Helper to register and login a test user, returning auth headers."""
    password = "StrongPassword123!"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password, "name": "Student"})
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_link_001_create_linking_token(client: AsyncClient, db_session: AsyncSession):
    """LINK-001: Authenticated user creates a single-use, short-lived deep linking token."""
    # 1. Unauthenticated request rejected
    unauth_res = await client.post("/api/v1/telegram/link-token")
    assert unauth_res.status_code == 401

    # 2. Authenticated user receives token and deep link
    headers = await get_test_auth(client, "link1@example.com")
    res = await client.post("/api/v1/telegram/link-token", headers=headers)
    assert res.status_code == 201

    data = res.json()["data"]
    assert "token" in data
    assert len(data["token"]) >= 20
    assert "deep_link" in data
    assert "t.me" in data["deep_link"]
    assert f"start=link_{data['token']}" in data["deep_link"]
    assert data["expires_in_seconds"] == 600

    # 3. Verify raw token is NOT stored in plain text in database (only hashed)
    token_hash = hashlib.sha256(data["token"].encode("utf-8")).hexdigest()
    stmt = select(TelegramLinkToken).where(TelegramLinkToken.token_hash == token_hash)
    record = (await db_session.execute(stmt)).scalar_one_or_none()
    assert record is not None
    assert record.is_used is False


@pytest.mark.asyncio
async def test_link_002_complete_linking_successfully(client: AsyncClient):
    """LINK-002: Bot completes linking with verified Telegram identity and reflects in user state."""
    headers = await get_test_auth(client, "link2@example.com")

    # User generates linking token
    token_res = await client.post("/api/v1/telegram/link-token", headers=headers)
    token = token_res.json()["data"]["token"]

    # Bot service completes linking
    bot_payload = {
        "token": token,
        "telegram_id": "987654321",
        "telegram_username": "learning_bot_user",
    }
    complete_res = await client.post(
        "/api/v1/telegram/complete-link",
        headers=BOT_HEADERS,
        json=bot_payload,
    )
    assert complete_res.status_code == 200
    comp_data = complete_res.json()["data"]
    assert comp_data["success"] is True
    assert comp_data["telegram_id"] == "987654321"

    # Verify user profile on website now reflects linked Telegram ID
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["data"]["telegram_id"] == "987654321"

    # Verify status endpoint reflects linked state
    status_res = await client.get("/api/v1/telegram/status", headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["data"]["is_linked"] is True
    assert status_res.json()["data"]["telegram_id"] == "987654321"

    # Verify bot can look up application user by telegram_id
    lookup_res = await client.get(
        "/api/v1/telegram/user/987654321",
        headers=BOT_HEADERS,
    )
    assert lookup_res.status_code == 200
    assert lookup_res.json()["data"]["email"] == "link2@example.com"


@pytest.mark.asyncio
async def test_link_003_reject_expired_token(client: AsyncClient, db_session: AsyncSession):
    """LINK-003: Reject linking token if expired."""
    headers = await get_test_auth(client, "link3@example.com")

    token_res = await client.post("/api/v1/telegram/link-token", headers=headers)
    token = token_res.json()["data"]["token"]
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    # Artificially expire the token in database
    stmt = select(TelegramLinkToken).where(TelegramLinkToken.token_hash == token_hash)
    record = (await db_session.execute(stmt)).scalar_one()
    record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    await db_session.commit()

    # Bot attempts completion
    res = await client.post(
        "/api/v1/telegram/complete-link",
        headers=BOT_HEADERS,
        json={"token": token, "telegram_id": "111222333"},
    )
    assert res.status_code == 400
    assert "expired" in res.json()["error"]["message"].lower()

    # User remains unlinked
    status_res = await client.get("/api/v1/telegram/status", headers=headers)
    assert status_res.json()["data"]["is_linked"] is False


@pytest.mark.asyncio
async def test_link_004_reject_reused_token(client: AsyncClient):
    """LINK-004: Reject already-used linking token."""
    headers = await get_test_auth(client, "link4@example.com")

    token_res = await client.post("/api/v1/telegram/link-token", headers=headers)
    token = token_res.json()["data"]["token"]

    # First attempt succeeds
    res1 = await client.post(
        "/api/v1/telegram/complete-link",
        headers=BOT_HEADERS,
        json={"token": token, "telegram_id": "444555666"},
    )
    assert res1.status_code == 200

    # Second attempt with same token fails
    res2 = await client.post(
        "/api/v1/telegram/complete-link",
        headers=BOT_HEADERS,
        json={"token": token, "telegram_id": "444555666"},
    )
    assert res2.status_code == 400
    assert "already been used" in res2.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_link_005_reject_unauthorized_and_invalid_tokens(client: AsyncClient):
    """LINK-005: Reject requests without bot secret or with malformed tokens."""
    # 1. Missing bot authorization
    res_no_auth = await client.post(
        "/api/v1/telegram/complete-link",
        json={"token": "some_random_token_12345", "telegram_id": "12345"},
    )
    assert res_no_auth.status_code == 401

    # 2. Bogus bot authorization
    res_bad_auth = await client.post(
        "/api/v1/telegram/complete-link",
        headers={"X-Telegram-Bot-Secret": "invalid-secret-value"},
        json={"token": "some_random_token_12345", "telegram_id": "12345"},
    )
    assert res_bad_auth.status_code == 401

    # 3. Valid bot secret but invalid/non-existent token
    res_bad_token = await client.post(
        "/api/v1/telegram/complete-link",
        headers=BOT_HEADERS,
        json={"token": "non_existent_token_12345", "telegram_id": "12345"},
    )
    assert res_bad_token.status_code == 400
    assert "invalid" in res_bad_token.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_link_006_prevent_duplicate_telegram_linking(client: AsyncClient):
    """LINK-006: Prevent one Telegram ID from being linked to multiple application accounts."""
    user1_headers = await get_test_auth(client, "tg_user1@example.com")
    user2_headers = await get_test_auth(client, "tg_user2@example.com")

    # Link Telegram ID '777888999' to User 1
    t1_res = await client.post("/api/v1/telegram/link-token", headers=user1_headers)
    t1 = t1_res.json()["data"]["token"]
    link1 = await client.post(
        "/api/v1/telegram/complete-link",
        headers=BOT_HEADERS,
        json={"token": t1, "telegram_id": "777888999"},
    )
    assert link1.status_code == 200

    # User 2 generates token and attempts to claim the SAME Telegram ID '777888999'
    t2_res = await client.post("/api/v1/telegram/link-token", headers=user2_headers)
    t2 = t2_res.json()["data"]["token"]
    link2 = await client.post(
        "/api/v1/telegram/complete-link",
        headers=BOT_HEADERS,
        json={"token": t2, "telegram_id": "777888999"},
    )
    assert link2.status_code == 409
    assert "already linked to another" in link2.json()["error"]["message"].lower()

    # Verify User 1 remains linked
    u1_status = await client.get("/api/v1/telegram/status", headers=user1_headers)
    assert u1_status.json()["data"]["telegram_id"] == "777888999"

    # Verify User 2 remains unlinked
    u2_status = await client.get("/api/v1/telegram/status", headers=user2_headers)
    assert u2_status.json()["data"]["is_linked"] is False


@pytest.mark.asyncio
async def test_link_007_unlink_account(client: AsyncClient):
    """LINK-007: Authenticated user can unlink their account, while invalid unlink requests fail."""
    headers = await get_test_auth(client, "link7@example.com")

    # Link account first
    t_res = await client.post("/api/v1/telegram/link-token", headers=headers)
    token = t_res.json()["data"]["token"]
    await client.post(
        "/api/v1/telegram/complete-link",
        headers=BOT_HEADERS,
        json={"token": token, "telegram_id": "999000111"},
    )

    # 1. Unlink successfully
    del_res = await client.delete("/api/v1/telegram/link", headers=headers)
    assert del_res.status_code == 200
    assert "unlinked" in del_res.json()["data"]["message"].lower()

    # 2. Status verifies unlinked
    status_res = await client.get("/api/v1/telegram/status", headers=headers)
    assert status_res.json()["data"]["is_linked"] is False
    assert status_res.json()["data"]["telegram_id"] is None

    # 3. Bot looking up previous Telegram ID now returns 404
    lookup_res = await client.get(
        "/api/v1/telegram/user/999000111",
        headers=BOT_HEADERS,
    )
    assert lookup_res.status_code == 404

    # 4. Attempting to unlink again fails
    del_again = await client.delete("/api/v1/telegram/link", headers=headers)
    assert del_again.status_code == 400
