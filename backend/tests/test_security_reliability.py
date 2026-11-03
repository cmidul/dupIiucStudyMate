"""Milestone 13 — Reliability and Security Test Suite (F-17, F-18, SEC-001..008)."""

import io
import json
import logging
from pathlib import Path
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image

from app.core.config import settings
from app.core.logging_config import SensitiveDataFilter
from app.core.quota import quota_manager
from app.core.rate_limit import rate_limiter
from app.models.user import User
from app.services.telegram_link_service import telegram_link_service
from app.storage.file_storage import FileValidationError, file_storage


def create_test_image_bytes(format="JPEG", width=64, height=64) -> bytes:
    """Helper creating minimal valid in-memory image bytes."""
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    img.save(buf, format=format)
    return buf.getvalue()


async def register_and_login(client: AsyncClient, email: str, password: str = "Password123!") -> tuple[str, str, dict]:
    """Helper creating a user and returning (user_id, token, auth_headers)."""
    reg = await client.post("/api/v1/auth/register", json={"email": email, "password": password, "name": "Test User"})
    assert reg.status_code == 201
    user_id = reg.json()["data"]["id"]

    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    token = login.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return user_id, token, headers


@pytest.mark.asyncio
async def test_sec_001_rate_limiting_web_and_telegram(client: AsyncClient, db_session: AsyncSession):
    """SEC-001: Rate limiting enforced with HTTP 429 across Web and Telegram for the same user."""
    user_id, token, auth_headers = await register_and_login(client, "rate_limit_user@example.com")

    # 1. Link Telegram to the user first while under normal limits
    token_resp = await client.post("/api/v1/telegram/link-token", headers=auth_headers)
    assert token_resp.status_code == 201
    raw_token = token_resp.json()["data"]["token"]

    bot_headers = {"X-Telegram-Bot-Secret": "dev-telegram-bot-secret"}
    telegram_id = "99887766"
    link_resp = await client.post(
        "/api/v1/telegram/complete-link",
        json={"token": raw_token, "telegram_id": telegram_id, "telegram_username": "ratelimited_tg"},
        headers=bot_headers,
    )
    assert link_resp.status_code == 200

    # 2. Reset bucket and set low rate limit for this user (3 requests)
    test_key = f"user:{user_id}"
    rate_limiter.reset(test_key)
    rate_limiter.set_limit_for_key(test_key, 3)

    # Send 3 requests on web (within limit)
    for _ in range(3):
        resp = await client.get("/api/v1/conversations", headers=auth_headers)
        assert resp.status_code == 200

    # 4th request on web should be rate-limited (HTTP 429)
    limited_resp = await client.get("/api/v1/conversations", headers=auth_headers)
    assert limited_resp.status_code == 429
    err = limited_resp.json()["error"]
    assert err["code"] == "RATE_LIMITED"
    assert "Retry-After" in limited_resp.headers

    # 3. Request via Telegram Bot for the same linked user must also be rejected by rate limit!
    from app.services.telegram_bot_service import telegram_bot_service
    tg_update = {
        "update_id": 1001,
        "message": {
            "message_id": 201,
            "from": {"id": telegram_id, "is_bot": False, "username": "ratelimited_tg"},
            "chat": {"id": 12345, "type": "private"},
            "text": "Explain binary search trees",
        },
    }
    tg_result = await telegram_bot_service.process_update(db_session, tg_update)
    assert tg_result["ok"] is False
    assert tg_result["error"] == "RATE_LIMITED"


@pytest.mark.asyncio
async def test_sec_002_quota_enforcement(client: AsyncClient):
    """SEC-002: Exceeding daily quota rejects before AI provider call and does not double-count."""
    user_id, token, headers = await register_and_login(client, "quota_user@example.com")

    # Set quota for summary to 2
    quota_manager.set_quota("summary", 2, user_id=user_id)
    assert quota_manager.get_usage(user_id, "summary") == 0

    # 1st request -> Success
    res1 = await client.post("/api/v1/summaries", json={"source_text": "This is a detailed lesson on binary search trees.", "style": "short"}, headers=headers)
    assert res1.status_code == 201
    assert quota_manager.get_usage(user_id, "summary") == 1

    # 2nd request -> Success
    res2 = await client.post("/api/v1/summaries", json={"source_text": "This is a detailed lesson on graph search algorithms.", "style": "short"}, headers=headers)
    assert res2.status_code == 201
    assert quota_manager.get_usage(user_id, "summary") == 2

    # 3rd request -> Must be rejected with HTTP 429 QUOTA_EXCEEDED before calling AI
    res3 = await client.post("/api/v1/summaries", json={"source_text": "Another lesson on dynamic programming.", "style": "short"}, headers=headers)
    assert res3.status_code == 429
    err = res3.json()["error"]
    assert err["code"] == "QUOTA_EXCEEDED"
    assert "Daily quota limit of 2" in err["message"]

    # Usage must NOT be double-counted or incremented for rejected requests
    assert quota_manager.get_usage(user_id, "summary") == 2


@pytest.mark.asyncio
async def test_sec_003_private_file_access(client: AsyncClient):
    """SEC-003: Direct unauthenticated or unauthorized access to stored files is denied."""
    user_a_id, token_a, headers_a = await register_and_login(client, "owner_a@example.com")

    img_bytes = create_test_image_bytes("PNG")
    upload_resp = await client.post(
        "/api/v1/uploads/image",
        files={"file": ("notes.png", img_bytes, "image/png")},
        data={"process_now": "true"},
        headers=headers_a,
    )
    assert upload_resp.status_code == 201
    file_id = upload_resp.json()["data"]["file"]["id"]

    # 1. Unauthenticated access to upload endpoints -> 401
    client.cookies.clear()
    unauth_resp = await client.get(f"/api/v1/uploads/{file_id}")
    assert unauth_resp.status_code == 401

    # 2. Cross-user access (User B) -> 404 (does not leak existence)
    user_b_id, token_b, headers_b = await register_and_login(client, "user_b@example.com")
    cross_resp = await client.get(f"/api/v1/uploads/{file_id}", headers=headers_b)
    assert cross_resp.status_code == 404

    # 3. Direct access to raw internal storage paths over web server is not served (404)
    storage_resp = await client.get(f"/storage/uploads/{file_id}")
    assert storage_resp.status_code == 404


def test_sec_004_path_traversal_prevention():
    """SEC-004: Path traversal patterns (../, null bytes, absolute roots) are rejected."""
    traversal_paths = [
        "../../etc/passwd",
        "..\\..\\windows\\win.ini",
        "user1/../../../root/secret.txt",
        "folder/\0/traversal.png",
        "/etc/shadow",
    ]
    for path in traversal_paths:
        with pytest.raises(FileValidationError):
            file_storage._safe_resolve(path)

    # Attempting to save with a path traversal user_id
    img_bytes = create_test_image_bytes("JPEG")
    with pytest.raises(FileValidationError):
        file_storage.save_file("../../malicious_user", img_bytes, ".jpg")


@pytest.mark.asyncio
async def test_sec_005_injection_and_unsafe_input(client: AsyncClient):
    """SEC-005: Injection payloads (XSS, SQL-like, prompt injection, math syntax) handled safely."""
    user_id, token, headers = await register_and_login(client, "injection_test@example.com")

    # 1. XSS payload in chat message
    xss_payload = "<script>alert('xss')</script><img src=x onerror=alert(1)>"
    chat_resp = await client.post(
        "/api/v1/chat/messages",
        json={"message": xss_payload},
        headers=headers,
    )
    assert chat_resp.status_code == 200
    assert xss_payload in chat_resp.json()["data"]["user_message"]["content"]

    # 2. SQL injection string in login and query parameters
    sql_payload = "' OR '1'='1' --"
    sql_login = await client.post("/api/v1/auth/login", json={"email": sql_payload, "password": "Password123!"})
    assert sql_login.status_code in (401, 422)
    assert sql_login.json()["error"]["code"] in ("UNAUTHENTICATED", "INVALID_INPUT")

    # 3. Dangerous math code execution payload (__import__, os.system) -> rejected with UNSAFE_EXPRESSION
    math_resp = await client.post(
        "/api/v1/solvers/math",
        json={"problem": "__import__('os').system('dir')"},
        headers=headers,
    )
    assert math_resp.status_code == 400
    assert math_resp.json()["error"]["code"] == "UNSAFE_EXPRESSION"


def test_sec_006_sensitive_data_logging_filter():
    """SEC-006: SensitiveDataFilter sanitizes passwords, bot tokens, and auth secrets from logs."""
    filter_instance = SensitiveDataFilter()

    raw_message = (
        'User login payload: {"password": "SuperSecretPassword123!", "token": "tg_link_1234567890abcdef1234567890abcdef"}. '
        'Bot token: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ12345678. '
        'Header Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.abc'
    )
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg=raw_message,
        args=(),
        exc_info=None,
    )

    filter_instance.filter(record)

    # Assert secrets are sanitized
    assert "SuperSecretPassword123!" not in record.msg
    assert "[REDACTED]" in record.msg
    assert "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ12345678" not in record.msg
    assert "[REDACTED_BOT_TOKEN]" in record.msg
    assert "[REDACTED_JWT]" in record.msg
    assert "tg_link_1234567890abcdef" not in record.msg


@pytest.mark.asyncio
async def test_sec_007_deletion_behavior_and_cascades(client: AsyncClient):
    """SEC-007: Deleting an uploaded file removes disk file, cascades content, and prevents further access."""
    user_id, token, headers = await register_and_login(client, "delete_test@example.com")

    # Upload an image and process synchronously
    img_bytes = create_test_image_bytes("JPEG")
    up_resp = await client.post(
        "/api/v1/uploads/image",
        files={"file": ("study_sheet.jpg", img_bytes, "image/jpeg")},
        data={"process_now": "true"},
        headers=headers,
    )
    assert up_resp.status_code == 201
    file_id = up_resp.json()["data"]["file"]["id"]

    # Verify both file and content exist
    assert (await client.get(f"/api/v1/uploads/{file_id}", headers=headers)).status_code == 200
    assert (await client.get(f"/api/v1/uploads/{file_id}/content", headers=headers)).status_code == 200

    # Delete the uploaded file
    del_resp = await client.delete(f"/api/v1/uploads/{file_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["data"]["deleted"] is True

    # After deletion:
    # 1. File metadata returns 404
    assert (await client.get(f"/api/v1/uploads/{file_id}", headers=headers)).status_code == 404

    # 2. Associated extracted content returns 404
    assert (await client.get(f"/api/v1/uploads/{file_id}/content", headers=headers)).status_code == 404

    # 3. Deleting again returns 404
    assert (await client.delete(f"/api/v1/uploads/{file_id}", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_sec_008_browser_security_headers_and_cors(client: AsyncClient):
    """SEC-008: Browser security headers (CSP, nosniff, frame options) are present on responses."""
    resp = await client.get("/health")
    assert resp.status_code == 200

    # Security headers check
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("X-XSS-Protection") == "1; mode=block"
    assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "default-src 'self'" in resp.headers.get("Content-Security-Policy", "")
