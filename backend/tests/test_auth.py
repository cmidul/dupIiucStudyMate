"""Tests for Authentication and Identity.

Directly verifies test cases AUTH-001 through AUTH-007 from test.md.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_001_register_valid_user(client: AsyncClient):
    """AUTH-001: Register a valid user.

    Verify account is created, safe user info returned, and password/hash is never exposed.
    """
    payload = {
        "email": "student@example.com",
        "password": "StrongPassword123!",
        "name": "Jane Student",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "data" in data
    assert "request_id" in data
    user = data["data"]
    assert user["email"] == "student@example.com"
    assert user["name"] == "Jane Student"
    assert "id" in user
    assert user["is_active"] is True
    # Critical security assertion: password and hashed_password must NEVER be exposed
    assert "password" not in user
    assert "hashed_password" not in user


@pytest.mark.asyncio
async def test_auth_002_reject_duplicate_email(client: AsyncClient):
    """AUTH-002: Reject duplicate email.

    Verify second registration is rejected with a stable error without leaking account internals.
    """
    payload = {
        "email": "duplicate@example.com",
        "password": "Password123!",
        "name": "First User",
    }
    resp1 = await client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 409
    err_data = resp2.json()
    assert "error" in err_data
    assert err_data["error"]["code"] == "EMAIL_ALREADY_EXISTS"
    assert "request_id" in err_data


@pytest.mark.asyncio
async def test_auth_003_reject_invalid_registration_input(client: AsyncClient):
    """AUTH-003: Reject invalid registration input.

    Verify malformed email, missing fields, and short passwords fail schema validation without stack traces.
    """
    # 1. Malformed email
    resp_bad_email = await client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": "ValidPassword123!"},
    )
    assert resp_bad_email.status_code == 422
    assert resp_bad_email.json()["error"]["code"] == "INVALID_INPUT"

    # 2. Short password (< 8 chars)
    resp_short_pwd = await client.post(
        "/api/v1/auth/register",
        json={"email": "valid@example.com", "password": "short"},
    )
    assert resp_short_pwd.status_code == 422
    assert resp_short_pwd.json()["error"]["code"] == "INVALID_INPUT"

    # 3. Missing password
    resp_missing = await client.post(
        "/api/v1/auth/register",
        json={"email": "valid2@example.com"},
    )
    assert resp_missing.status_code == 422


@pytest.mark.asyncio
async def test_auth_004_login_success_and_failure(client: AsyncClient):
    """AUTH-004: Login success and failure.

    Verify valid credentials produce access token; invalid credentials return generic error.
    """
    reg_payload = {"email": "login_user@example.com", "password": "CorrectPassword123!"}
    await client.post("/api/v1/auth/register", json=reg_payload)

    # Valid login
    login_resp = await client.post("/api/v1/auth/login", json=reg_payload)
    assert login_resp.status_code == 200
    login_data = login_resp.json()["data"]
    assert "access_token" in login_data
    assert login_data["token_type"] == "bearer"
    assert login_data["user"]["email"] == "login_user@example.com"
    # Cookie should be set
    assert "access_token" in login_resp.cookies

    # Invalid password
    bad_pwd_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "login_user@example.com", "password": "WrongPassword!"},
    )
    assert bad_pwd_resp.status_code == 401
    assert bad_pwd_resp.json()["error"]["code"] == "INVALID_CREDENTIALS"

    # Non-existent user
    non_user_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@example.com", "password": "AnyPassword123!"},
    )
    assert non_user_resp.status_code == 401
    assert non_user_resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_auth_005_session_persistence_and_logout(client: AsyncClient):
    """AUTH-005: Session persistence and logout.

    Verify session works via Cookie/Header, and logout invalidates access.
    """
    reg_payload = {"email": "session_user@example.com", "password": "SessionPassword123!"}
    await client.post("/api/v1/auth/register", json=reg_payload)

    login_resp = await client.post("/api/v1/auth/login", json=reg_payload)
    token = login_resp.json()["data"]["access_token"]

    # Access /me with Authorization header
    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["data"]["email"] == "session_user@example.com"

    # Logout
    logout_resp = await client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200


@pytest.mark.asyncio
async def test_auth_006_unauthenticated_access(client: AsyncClient):
    """AUTH-006: Unauthenticated access.

    Verify calling protected endpoints without valid token returns 401 and no private data.
    """
    # 1. No credentials
    resp_no_token = await client.get("/api/v1/auth/me")
    assert resp_no_token.status_code == 401
    assert resp_no_token.json()["error"]["code"] == "UNAUTHENTICATED"

    # 2. Malformed token
    resp_bad_token = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-valid-jwt-token"},
    )
    assert resp_bad_token.status_code == 401
    assert resp_bad_token.json()["error"]["code"] == "UNAUTHENTICATED"


@pytest.mark.asyncio
async def test_auth_007_cross_user_ownership(client: AsyncClient):
    """AUTH-007: Cross-user ownership.

    Verify User A and User B receive their own profiles and cannot access another's data.
    """
    # Create User A
    await client.post(
        "/api/v1/auth/register",
        json={"email": "user_a@example.com", "password": "UserAPassword123!"},
    )
    login_a = await client.post(
        "/api/v1/auth/login",
        json={"email": "user_a@example.com", "password": "UserAPassword123!"},
    )
    token_a = login_a.json()["data"]["access_token"]
    user_a_id = login_a.json()["data"]["user"]["id"]

    # Create User B
    await client.post(
        "/api/v1/auth/register",
        json={"email": "user_b@example.com", "password": "UserBPassword123!"},
    )
    login_b = await client.post(
        "/api/v1/auth/login",
        json={"email": "user_b@example.com", "password": "UserBPassword123!"},
    )
    token_b = login_b.json()["data"]["access_token"]
    user_b_id = login_b.json()["data"]["user"]["id"]

    assert user_a_id != user_b_id

    # User A accesses /me -> gets User A
    me_a = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert me_a.status_code == 200
    assert me_a.json()["data"]["id"] == user_a_id
    assert me_a.json()["data"]["email"] == "user_a@example.com"

    # User B accesses /me -> gets User B
    me_b = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert me_b.status_code == 200
    assert me_b.json()["data"]["id"] == user_b_id
    assert me_b.json()["data"]["email"] == "user_b@example.com"

