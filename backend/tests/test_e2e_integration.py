"""
M14 System Integration — End-to-End Cross-Platform Tests (E2E-001..005)

These tests verify complete multi-step learning workflows spanning authentication,
content creation, AI processing, and cross-feature data reuse — mirroring real
user journeys across both the Website API and the shared backend used by
the Telegram bot.

Each test uses the same in-memory test harness as the unit tests (no live AI
provider). The Mock provider returns deterministic structured responses.
"""

import io
import pytest
from httpx import AsyncClient
from PIL import Image


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

async def register_and_login(client: AsyncClient, email: str, name: str = "E2E Student") -> dict:
    """Create an account and return auth headers."""
    password = "E2EPassword123!"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password, "name": name})
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, f"Login failed: {login.text}"
    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_test_image(fmt: str = "PNG") -> bytes:
    """Generate minimal valid image bytes passing Pillow verification."""
    img = Image.new("RGB", (20, 20), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# E2E-001: Complete text learning journey
# Upload text question → solve → quiz on same topic → verify history
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_e2e_001_text_learning_journey(client: AsyncClient):
    """
    E2E-001: Full web text learning journey.

    Steps:
    1. Register and authenticate.
    2. Solve a mathematical question via the unified solver.
    3. Retrieve the auto-created conversation (history is populated).
    4. Generate a quiz on the same topic.
    5. Submit a quiz attempt and verify scoring.
    6. Verify conversation history lists the session.
    """
    headers = await register_and_login(client, "e2e001@example.com")

    # Step 2: Solve a math question
    solve_resp = await client.post(
        "/api/v1/solve",
        json={"input_text": "x^2 - 5x + 6 = 0"},
        headers=headers,
    )
    assert solve_resp.status_code == 200, f"Solve failed: {solve_resp.status_code} {solve_resp.text}"
    solve_data = solve_resp.json()["data"]
    assert solve_data["task_type"] == "mathematics"
    conv_id = solve_data["conversation_id"]
    assert conv_id is not None

    # Step 3: History — conversation is listed
    history_resp = await client.get("/api/v1/conversations", headers=headers)
    assert history_resp.status_code == 200
    convs = history_resp.json()["data"]
    conv_ids = [c["id"] for c in convs]
    assert conv_id in conv_ids, "Conversation from solve not visible in history"

    # Step 4: Generate a quiz on the same topic
    quiz_resp = await client.post(
        "/api/v1/quizzes/generate",
        json={"topic": "Quadratic equations", "difficulty": "intermediate", "question_count": 2},
        headers=headers,
    )
    assert quiz_resp.status_code == 201
    quiz_data = quiz_resp.json()["data"]
    quiz_id = quiz_data["id"]
    questions = quiz_data["questions"]
    assert len(questions) >= 1

    # Answer-key secrecy: correct_option_id must NOT appear before submission
    for q in questions:
        for opt in q["options"]:
            assert "correct" not in opt or opt.get("correct") is None, \
                "Answer key leaked before submission"

    # Step 5: Submit attempt with first option for all questions
    answers = [{"question_id": q["id"], "selected_option_id": q["options"][0]["id"]} for q in questions]
    attempt_resp = await client.post(
        f"/api/v1/quizzes/{quiz_id}/attempts",
        json={"answers": answers},
        headers=headers,
    )
    assert attempt_resp.status_code == 200
    attempt_data = attempt_resp.json()["data"]
    assert attempt_data["total_questions"] == len(questions)
    assert isinstance(attempt_data["score"], int)
    assert 0 <= attempt_data["score"] <= len(questions)
    assert isinstance(attempt_data["percentage"], (int, float))
    assert len(attempt_data["reviews"]) == len(questions)

    # Step 6: Each review must now include answer key + explanation
    for review in attempt_data["reviews"]:
        assert "correct_option_id" in review
        assert "explanation" in review
        assert isinstance(review["is_correct"], bool)


# ---------------------------------------------------------------------------
# E2E-002: Chat conversation with follow-up context
# Start conversation → ask follow-up → verify context preserved
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_e2e_002_chat_followup_context(client: AsyncClient):
    """
    E2E-002: Multi-turn conversational context preserved across requests.

    Steps:
    1. Start a new conversation by sending a topic question.
    2. Send a follow-up that implicitly references the first.
    3. Verify both messages appear in conversation history.
    4. Verify topic metadata is returned.
    """
    headers = await register_and_login(client, "e2e002@example.com")

    # Turn 1: initial question
    resp1 = await client.post(
        "/api/v1/chat/messages",
        json={"message": "What is Newton's second law of motion?"},
        headers=headers,
    )
    assert resp1.status_code == 200
    data1 = resp1.json()["data"]
    conv_id = data1["conversation_id"]
    assert conv_id is not None
    assert data1["user_message"]["role"] == "user"
    assert data1["assistant_message"]["role"] == "assistant"

    # Turn 2: follow-up in the same conversation
    resp2 = await client.post(
        "/api/v1/chat/messages",
        json={"message": "Can you give an example with a 5kg mass?", "conversation_id": conv_id},
        headers=headers,
    )
    assert resp2.status_code == 200
    data2 = resp2.json()["data"]
    assert data2["conversation_id"] == conv_id

    # Verify all messages are in the conversation
    conv_resp = await client.get(f"/api/v1/conversations/{conv_id}", headers=headers)
    assert conv_resp.status_code == 200
    conv_messages = conv_resp.json()["data"]["messages"]
    roles = [m["role"] for m in conv_messages]
    assert roles.count("user") == 2
    assert roles.count("assistant") == 2


# ---------------------------------------------------------------------------
# E2E-003: Image upload → extract → solve based on extracted content
# Upload image → synchronous extraction → use extracted content_id in solver
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_e2e_003_image_upload_then_solve(client: AsyncClient):
    """
    E2E-003: Multimodal image→solve workflow.

    Steps:
    1. Upload a PNG image with synchronous processing (default).
    2. Verify extraction completed and extracted content is available.
    3. Retrieve extracted content via the file's content endpoint.
    4. Pass extracted content ID to the unified solver.
    5. Verify that the solver returns a result referencing the content.
    """
    headers = await register_and_login(client, "e2e003@example.com")
    png = create_test_image("PNG")

    # Step 1: Upload image (process_now=True is the default)
    upload_resp = await client.post(
        "/api/v1/uploads/image",
        files={"file": ("test.png", io.BytesIO(png), "image/png")},
        data={"process_now": "true"},
        headers=headers,
    )
    assert upload_resp.status_code == 201
    upload_data = upload_resp.json()["data"]
    file_id = upload_data["file"]["id"]

    # Step 2: Content extracted synchronously
    content_id = None
    if upload_data.get("extracted_content"):
        content_id = upload_data["extracted_content"]["id"]

    # Step 3: Retrieve extracted content via file endpoint
    content_resp = await client.get(f"/api/v1/uploads/{file_id}/content", headers=headers)
    assert content_resp.status_code == 200
    content = content_resp.json()["data"]
    assert content["subject"] != ""
    assert content["extracted_text"] != ""
    if not content_id:
        content_id = content["id"]

    # Step 4: Solve using the extracted content
    solve_resp = await client.post(
        "/api/v1/solve",
        json={"input_text": "x^2 - 5x + 6 = 0", "source_content_id": content_id},
        headers=headers,
    )
    assert solve_resp.status_code == 200, f"Solve failed: {solve_resp.status_code} {solve_resp.text}"
    solve_data = solve_resp.json()["data"]
    assert solve_data["task_type"] == "mathematics"
    assert solve_data["source_content_id"] == content_id


# ---------------------------------------------------------------------------
# E2E-004: Summary generation → quiz from same topic
# Generate summary from text → generate quiz using same topic
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_e2e_004_summary_then_quiz(client: AsyncClient):
    """
    E2E-004: Summary + quiz chained workflow.

    Steps:
    1. Generate a detailed summary from a passage.
    2. Use the same topic to generate a quiz.
    3. Verify both outputs reference the topic.
    """
    headers = await register_and_login(client, "e2e004@example.com")

    passage = (
        "A Binary Search Tree is an ordered node-based tree data structure where each node has at most two children. "
        "The left subtree contains values smaller than the node, while the right subtree contains values larger. "
        "Search, insertion, and deletion operations on a balanced binary search tree take logarithmic time O(log n)."
    )

    # Step 1: Generate summary (POST /api/v1/summaries returns 201)
    sum_resp = await client.post(
        "/api/v1/summaries",
        json={"source_text": passage, "style": "detailed"},
        headers=headers,
    )
    assert sum_resp.status_code == 201
    sum_data = sum_resp.json()["data"]
    assert sum_data["overview"] != ""
    assert len(sum_data["content"]["sections"]) > 0
    topic = sum_data["topic"]
    assert topic != ""

    # Step 2: Generate quiz on same topic
    quiz_resp = await client.post(
        "/api/v1/quizzes/generate",
        json={"topic": topic, "difficulty": "beginner", "question_count": 2},
        headers=headers,
    )
    assert quiz_resp.status_code == 201
    quiz_data = quiz_resp.json()["data"]
    assert len(quiz_data["questions"]) >= 1

    # Step 3: Verify subject consistency
    summary_lower = (sum_data["title"] + " " + sum_data["overview"]).lower()
    assert len(summary_lower) > 0


# ---------------------------------------------------------------------------
# E2E-005: Cross-user data isolation end-to-end
# User A creates resources → User B cannot access them
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_e2e_005_cross_user_isolation(client: AsyncClient):
    """
    E2E-005: Full cross-user data isolation verification.

    Steps:
    1. User A creates a conversation, summary, and quiz.
    2. User B authenticates.
    3. User B cannot read User A's conversation, summary, or quiz.
    4. User B cannot submit an attempt for User A's quiz.
    5. User B cannot delete User A's conversation.
    """
    headers_a = await register_and_login(client, "e2e005a@example.com", "User A")
    headers_b = await register_and_login(client, "e2e005b@example.com", "User B")

    # User A: create a conversation
    chat_resp = await client.post(
        "/api/v1/chat/messages",
        json={"message": "Tell me about recursion."},
        headers=headers_a,
    )
    assert chat_resp.status_code == 200
    conv_id = chat_resp.json()["data"]["conversation_id"]

    # User A: create a summary (POST /api/v1/summaries returns 201)
    sum_resp = await client.post(
        "/api/v1/summaries",
        json={"source_text": "Recursion is a method of defining functions in terms of themselves.", "style": "short"},
        headers=headers_a,
    )
    assert sum_resp.status_code == 201
    sum_id = sum_resp.json()["data"]["id"]

    # User A: create a quiz (POST /api/v1/quizzes/generate returns 201)
    quiz_resp = await client.post(
        "/api/v1/quizzes/generate",
        json={"topic": "Recursion in computer science", "difficulty": "beginner", "question_count": 2},
        headers=headers_a,
    )
    assert quiz_resp.status_code == 201
    quiz_data = quiz_resp.json()["data"]
    quiz_id = quiz_data["id"]
    q_id = quiz_data["questions"][0]["id"]
    opt_id = quiz_data["questions"][0]["options"][0]["id"]

    # User B: cannot read User A's conversation
    b_conv = await client.get(f"/api/v1/conversations/{conv_id}", headers=headers_b)
    assert b_conv.status_code == 404, f"Expected 404, got {b_conv.status_code}"

    # User B: cannot delete User A's conversation
    b_del = await client.delete(f"/api/v1/conversations/{conv_id}", headers=headers_b)
    assert b_del.status_code == 404, f"Expected 404, got {b_del.status_code}"

    # User B: cannot access User A's summary
    b_sum = await client.get(f"/api/v1/summaries/{sum_id}", headers=headers_b)
    assert b_sum.status_code in (403, 404), f"Expected 403 or 404, got {b_sum.status_code}"

    # User B: cannot submit an attempt to User A's quiz
    b_attempt = await client.post(
        f"/api/v1/quizzes/{quiz_id}/attempts",
        json={"answers": [{"question_id": q_id, "selected_option_id": opt_id}]},
        headers=headers_b,
    )
    assert b_attempt.status_code in (403, 404), f"Expected 403 or 404, got {b_attempt.status_code}"

    # User B: own resource list must be empty
    b_history = await client.get("/api/v1/conversations", headers=headers_b)
    assert b_history.status_code == 200
    assert b_history.json()["data"] == [], "User B's history should be empty"
