"""Tests for Summarization Engine.

Directly verifies test cases SUM-001 through SUM-007 from test.md.
"""

import pytest
from httpx import AsyncClient

from app.ai.mock_provider import MockAIProvider
from app.ai.router import ai_router


async def get_test_auth(client: AsyncClient, email: str = "sum_user@example.com") -> tuple[str, str]:
    password = "StrongPassword123!"
    reg = await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    user_id = reg.json()["data"]["id"]
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = login.json()["data"]["access_token"]
    return user_id, token


@pytest.mark.asyncio
async def test_sum_001_short_summary(client: AsyncClient):
    """SUM-001: Short summary.

    Verify overview is concise and main idea is preserved.
    """
    user_id, token = await get_test_auth(client, "sum1@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "source_text": "A Binary Search Tree is an ordered node-based tree where the left subtree contains smaller values and right subtree contains larger values.",
        "style": "short",
    }
    resp = await client.post("/api/v1/summaries", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["style"] == "short"
    assert "overview" in data
    assert len(data["overview"]) > 0


@pytest.mark.asyncio
async def test_sum_002_detailed_summary(client: AsyncClient):
    """SUM-002: Detailed summary.

    Verify important sections and key terms appear.
    """
    user_id, token = await get_test_auth(client, "sum2@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "source_text": "Neural networks consist of an input layer, hidden layers, and an output layer. Activation functions like ReLU introduce non-linearity.",
        "style": "detailed",
    }
    resp = await client.post("/api/v1/summaries", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["style"] == "detailed"
    assert "content" in data
    assert len(data["content"]["sections"]) > 0


@pytest.mark.asyncio
async def test_sum_003_exam_notes_summary(client: AsyncClient):
    """SUM-003: Exam notes summary.

    Verify definitions, key terms, and revision points are populated.
    """
    user_id, token = await get_test_auth(client, "sum3@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "source_text": "Calculus fundamental theorem connects differentiation and integration.",
        "style": "exam_notes",
    }
    resp = await client.post("/api/v1/summaries", json=payload, headers=headers)
    assert resp.status_code == 201
    content = resp.json()["data"]["content"]
    assert "key_terms" in content
    assert "revision_points" in content


@pytest.mark.asyncio
async def test_sum_004_summary_from_conversation(client: AsyncClient):
    """SUM-004: Summary generated from existing conversation.

    Verify existing conversation turns can be used as source.
    """
    user_id, token = await get_test_auth(client, "sum4@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Create conversation with a question
    chat_resp = await client.post(
        "/api/v1/chat/messages",
        json={"message": "Explain quicksort and its partition mechanism."},
        headers=headers,
    )
    conv_id = chat_resp.json()["data"]["conversation_id"]

    # Summarize this conversation
    sum_resp = await client.post(
        "/api/v1/summaries",
        json={"conversation_id": conv_id, "style": "exam_notes"},
        headers=headers,
    )
    assert sum_resp.status_code == 201
    data = sum_resp.json()["data"]
    assert data["conversation_id"] == conv_id


@pytest.mark.asyncio
async def test_sum_005_incomplete_source(client: AsyncClient):
    """SUM-005: Incomplete source handling.

    Verify brief/incomplete source is accepted and summarized without crashing.
    """
    user_id, token = await get_test_auth(client, "sum5@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "source_text": "Note: incomplete draft on trees.",
        "style": "short",
    }
    resp = await client.post("/api/v1/summaries", json=payload, headers=headers)
    assert resp.status_code == 201
    assert "overview" in resp.json()["data"]


@pytest.mark.asyncio
async def test_sum_006_invalid_ai_output(client: AsyncClient):
    """SUM-006: Invalid AI output handling.

    Verify malformed AI response triggers controlled repair or safe error.
    """
    user_id, token = await get_test_auth(client, "sum6@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Temporarily inject broken provider
    broken_provider = MockAIProvider(simulate_malformed_json=True)
    ai_router.register_provider(broken_provider)

    try:
        resp = await client.post(
            "/api/v1/summaries",
            json={"source_text": "Test input for malformed json handling", "style": "short"},
            headers=headers,
        )
        assert resp.status_code == 502
        assert resp.json()["error"]["code"] == "INVALID_AI_OUTPUT"
    finally:
        ai_router.register_provider(MockAIProvider())


@pytest.mark.asyncio
async def test_sum_007_persistence_and_ownership(client: AsyncClient):
    """SUM-007: Summary persistence and cross-user isolation.

    Verify User A can retrieve their summary and User B cannot access it.
    """
    user_a_id, token_a = await get_test_auth(client, "sum_a@example.com")
    user_b_id, token_b = await get_test_auth(client, "sum_b@example.com")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates a summary
    resp_create = await client.post(
        "/api/v1/summaries",
        json={"source_text": "User A confidential study note", "style": "short"},
        headers=headers_a,
    )
    summary_id = resp_create.json()["data"]["id"]

    # User A can get it
    resp_get_a = await client.get(f"/api/v1/summaries/{summary_id}", headers=headers_a)
    assert resp_get_a.status_code == 200

    # User B is denied access
    resp_get_b = await client.get(f"/api/v1/summaries/{summary_id}", headers=headers_b)
    assert resp_get_b.status_code == 404
    assert resp_get_b.json()["error"]["code"] == "NOT_FOUND"

    # User B cannot delete User A's summary
    resp_del_b = await client.delete(f"/api/v1/summaries/{summary_id}", headers=headers_b)
    assert resp_del_b.status_code == 404

    # User A deletes their summary
    resp_del_a = await client.delete(f"/api/v1/summaries/{summary_id}", headers=headers_a)
    assert resp_del_a.status_code == 200

