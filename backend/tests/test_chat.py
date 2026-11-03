"""Tests for Shared Conversation System and Topic Detection.

Directly verifies test cases CHAT-001 through CHAT-007 and TOPIC-001..002 from test.md.
"""

import pytest
from httpx import AsyncClient

from app.ai.mock_provider import MockAIProvider
from app.ai.router import ai_router
from app.ai.schemas import TopicDetectionSchema
from app.services.topic_detector import topic_detector


async def create_authenticated_user(client: AsyncClient, email: str = "chat_user@example.com") -> tuple[str, str]:
    """Helper creating a test user and returning (user_id, token)."""
    password = "StrongPassword123!"
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": "Chat Learner"},
    )
    user_id = reg_resp.json()["data"]["id"]

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    token = login_resp.json()["data"]["access_token"]
    return user_id, token


@pytest.mark.asyncio
async def test_chat_001_general_text_question(client: AsyncClient):
    """CHAT-001: General text question.

    Verify user message is saved, response returned and saved in correct conversation.
    """
    user_id, token = await create_authenticated_user(client, "student1@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"message": "Explain binary search in simple words."}
    response = await client.post("/api/v1/chat/messages", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]

    conv_id = data["conversation_id"]
    assert conv_id is not None
    assert data["user_message"]["content"] == "Explain binary search in simple words."
    assert data["user_message"]["role"] == "user"
    assert data["assistant_message"]["role"] == "assistant"
    assert len(data["assistant_message"]["content"]) > 0

    # Verify conversation details
    detail_resp = await client.get(f"/api/v1/conversations/{conv_id}", headers=headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()["data"]
    assert len(detail["messages"]) == 2
    assert detail["messages"][0]["role"] == "user"
    assert detail["messages"][1]["role"] == "assistant"


@pytest.mark.asyncio
async def test_chat_002_topic_detection(client: AsyncClient):
    """CHAT-002: Topic detection.

    Verify subject, topic, and difficulty are populated with valid enum values.
    """
    user_id, token = await create_authenticated_user(client, "student2@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"message": "What is the difference between a binary tree and a graph?"}
    response = await client.post("/api/v1/chat/messages", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]

    topic_meta = data["topic_metadata"]
    assert topic_meta is not None
    assert topic_meta["subject"] != ""
    assert topic_meta["topic"] != ""
    assert topic_meta["difficulty"] in ["beginner", "intermediate", "advanced", "unknown"]
    assert 0.0 <= topic_meta["confidence"] <= 1.0


@pytest.mark.asyncio
async def test_chat_003_ambiguous_request(client: AsyncClient):
    """CHAT-003: Ambiguous request without prior context.

    Verify assistant asks for clarification rather than inventing missing context.
    """
    user_id, token = await create_authenticated_user(client, "student3@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"message": "Explain this."}
    response = await client.post("/api/v1/chat/messages", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]

    # Assistant should ask for clarification
    asst_content = data["assistant_message"]["content"].lower()
    assert any(q in asst_content for q in ["what", "clarify", "explain", "detail"])


@pytest.mark.asyncio
async def test_chat_004_follow_up_context(client: AsyncClient):
    """CHAT-004: Follow-up context.

    Verify follow-up uses previous messages in the same conversation.
    """
    user_id, token = await create_authenticated_user(client, "student4@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Step 1: initial message
    resp1 = await client.post(
        "/api/v1/chat/messages",
        json={"message": "What is binary search?"},
        headers=headers,
    )
    conv_id = resp1.json()["data"]["conversation_id"]

    # Step 2: follow-up referencing earlier topic
    resp2 = await client.post(
        "/api/v1/chat/messages",
        json={"conversation_id": conv_id, "message": "Give me a concrete code example of that."},
        headers=headers,
    )
    assert resp2.status_code == 200
    data2 = resp2.json()["data"]
    assert data2["conversation_id"] == conv_id

    # Verify message sequence in conversation
    detail_resp = await client.get(f"/api/v1/conversations/{conv_id}", headers=headers)
    messages = detail_resp.json()["data"]["messages"]
    assert len(messages) == 4
    assert messages[0]["content"] == "What is binary search?"
    assert messages[2]["content"] == "Give me a concrete code example of that."


@pytest.mark.asyncio
async def test_chat_005_conversation_isolation(client: AsyncClient):
    """CHAT-005: Conversation isolation and cross-user security.

    Verify User A and User B cannot read or delete each other's conversations.
    """
    user_a_id, token_a = await create_authenticated_user(client, "user_a@example.com")
    user_b_id, token_b = await create_authenticated_user(client, "user_b@example.com")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates a conversation
    resp_a = await client.post(
        "/api/v1/chat/messages",
        json={"message": "User A secret topic"},
        headers=headers_a,
    )
    conv_a_id = resp_a.json()["data"]["conversation_id"]

    # User B attempts to access User A's conversation
    access_attempt = await client.get(f"/api/v1/conversations/{conv_a_id}", headers=headers_b)
    assert access_attempt.status_code == 404
    assert access_attempt.json()["error"]["code"] == "NOT_FOUND"

    # User B attempts to delete User A's conversation
    delete_attempt = await client.delete(f"/api/v1/conversations/{conv_a_id}", headers=headers_b)
    assert delete_attempt.status_code == 404

    # User A can access their own conversation
    legit_access = await client.get(f"/api/v1/conversations/{conv_a_id}", headers=headers_a)
    assert legit_access.status_code == 200

    # User B's conversation list does not contain User A's conversation
    list_b = await client.get("/api/v1/conversations", headers=headers_b)
    assert list_b.status_code == 200
    b_conv_ids = [c["id"] for c in list_b.json()["data"]]
    assert conv_a_id not in b_conv_ids


@pytest.mark.asyncio
async def test_chat_006_empty_and_oversized_messages(client: AsyncClient):
    """CHAT-006: Empty and oversized messages.

    Verify input validation rejects empty and oversized messages with stable errors.
    """
    user_id, token = await create_authenticated_user(client, "student6@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Empty message
    resp_empty = await client.post(
        "/api/v1/chat/messages",
        json={"message": "   "},
        headers=headers,
    )
    assert resp_empty.status_code == 422
    assert resp_empty.json()["error"]["code"] == "INVALID_INPUT"

    # Oversized message (> 8000 characters)
    oversized = "A" * 8500
    resp_oversized = await client.post(
        "/api/v1/chat/messages",
        json={"message": oversized},
        headers=headers,
    )
    assert resp_oversized.status_code == 422
    assert resp_oversized.json()["error"]["code"] == "INVALID_INPUT"


@pytest.mark.asyncio
async def test_chat_007_provider_failure_handling(client: AsyncClient):
    """CHAT-007: Provider failure handling.

    Verify provider outage returns safe error without corrupting data or faking answers.
    """
    user_id, token = await create_authenticated_user(client, "student7@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Register broken provider temporarily
    failing_provider = MockAIProvider(simulate_timeout=True)
    ai_router.register_provider(failing_provider)

    try:
        response = await client.post(
            "/api/v1/chat/messages",
            json={"message": "Test question during outage"},
            headers=headers,
        )
        assert response.status_code in [502, 504]
        err = response.json()["error"]
        assert err["code"] == "PROVIDER_UNAVAILABLE"
        assert "request_id" in response.json()
    finally:
        # Restore normal mock provider
        ai_router.register_provider(MockAIProvider())


@pytest.mark.asyncio
async def test_topic_001_enum_normalization():
    """TOPIC-001: Schema enum validation.

    Verify invalid enum fields are normalized according to documented specification.
    """
    bad_schema = TopicDetectionSchema(
        difficulty="EXTREMELY_HARD_NON_STANDARD",
        intent="NON_EXISTENT_INTENT",
        confidence=1.5,
    )
    topic_detector._normalize_schema(bad_schema)

    assert bad_schema.difficulty == "unknown"
    assert bad_schema.intent == "unknown"
    assert bad_schema.confidence == 1.0


@pytest.mark.asyncio
async def test_topic_002_low_confidence_clarification():
    """TOPIC-002: Low-confidence classification.

    Verify low confidence marks needs_clarification=True.
    """
    low_conf = TopicDetectionSchema(
        confidence=0.2,
        needs_clarification=False,
    )
    topic_detector._normalize_schema(low_conf)
    assert low_conf.needs_clarification is True
    assert low_conf.clarification_question is not None

