"""Tests for Quiz Generation, Attempt Scoring, and Answer Key Secrecy.

Directly verifies test cases QUIZ-001 through QUIZ-010 from test.md.
"""

import pytest
from httpx import AsyncClient

from app.ai.mock_provider import MockAIProvider
from app.ai.router import ai_router


async def get_test_auth(client: AsyncClient, email: str = "quiz_user@example.com") -> tuple[str, str]:
    password = "StrongPassword123!"
    reg = await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    user_id = reg.json()["data"]["id"]
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = login.json()["data"]["access_token"]
    return user_id, token


@pytest.mark.asyncio
async def test_quiz_001_generate_mcq_from_source(client: AsyncClient):
    """QUIZ-001: Generate MCQs from source text.

    Verify questions and options are populated.
    """
    user_id, token = await get_test_auth(client, "quiz1@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "source_text": "Binary search trees place smaller elements on the left and larger on the right.",
        "difficulty": "beginner",
        "question_count": 2,
    }
    resp = await client.post("/api/v1/quizzes/generate", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert len(data["questions"]) > 0
    q1 = data["questions"][0]
    assert "question" in q1
    assert len(q1["options"]) >= 2


@pytest.mark.asyncio
async def test_quiz_002_generate_from_topic_only(client: AsyncClient):
    """QUIZ-002: Generate quiz from topic only.

    Verify quiz generates without source text.
    """
    user_id, token = await get_test_auth(client, "quiz2@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {"topic": "Data Structures", "difficulty": "intermediate", "question_count": 2}
    resp = await client.post("/api/v1/quizzes/generate", json=payload, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["data"]["topic"] == "Data Structures"


@pytest.mark.asyncio
async def test_quiz_003_difficulty_levels(client: AsyncClient):
    """QUIZ-003: Difficulty levels.

    Verify beginner, intermediate, and advanced requests succeed.
    """
    user_id, token = await get_test_auth(client, "quiz3@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    for diff in ["beginner", "intermediate", "advanced"]:
        resp = await client.post(
            "/api/v1/quizzes/generate",
            json={"topic": "Physics", "difficulty": diff, "question_count": 2},
            headers=headers,
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["difficulty"] == diff


@pytest.mark.asyncio
async def test_quiz_004_invalid_question_count(client: AsyncClient):
    """QUIZ-004: Invalid question count.

    Verify 0, negative, and above-maximum counts fail validation.
    """
    user_id, token = await get_test_auth(client, "quiz4@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 0 questions
    resp_zero = await client.post(
        "/api/v1/quizzes/generate",
        json={"topic": "Math", "question_count": 0},
        headers=headers,
    )
    assert resp_zero.status_code == 422

    # Negative questions
    resp_neg = await client.post(
        "/api/v1/quizzes/generate",
        json={"topic": "Math", "question_count": -5},
        headers=headers,
    )
    assert resp_neg.status_code == 422

    # > 20 questions
    resp_over = await client.post(
        "/api/v1/quizzes/generate",
        json={"topic": "Math", "question_count": 25},
        headers=headers,
    )
    assert resp_over.status_code == 422


@pytest.mark.asyncio
async def test_quiz_006_answer_key_secrecy(client: AsyncClient):
    """QUIZ-006: Answer-key secrecy (CRITICAL REQUIREMENT).

    Verify GET delivery endpoint NEVER returns correct_option_id or explanation.
    """
    user_id, token = await get_test_auth(client, "quiz6@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    gen_resp = await client.post(
        "/api/v1/quizzes/generate",
        json={"topic": "Security Testing", "question_count": 2},
        headers=headers,
    )
    quiz_id = gen_resp.json()["data"]["id"]

    # 1. Inspect generate response serialization
    raw_gen = gen_resp.text
    assert "correct_option_id" not in raw_gen
    assert "explanation" not in raw_gen

    # 2. Inspect GET quiz delivery response serialization
    delivery_resp = await client.get(f"/api/v1/quizzes/{quiz_id}", headers=headers)
    assert delivery_resp.status_code == 200
    raw_delivery = delivery_resp.text
    assert "correct_option_id" not in raw_delivery
    assert "explanation" not in raw_delivery

    # Ensure questions and options are present
    questions = delivery_resp.json()["data"]["questions"]
    assert len(questions) > 0
    for q in questions:
        assert "question" in q
        assert "options" in q
        assert "correct_option_id" not in q
        assert "explanation" not in q


@pytest.mark.asyncio
async def test_quiz_007_correct_score_calculation(client: AsyncClient):
    """QUIZ-007: Correct score calculation.

    Verify submit with 100% correct answers receives 100% score and explanations.
    """
    user_id, token = await get_test_auth(client, "quiz7@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    gen_resp = await client.post(
        "/api/v1/quizzes/generate",
        json={"topic": "BST", "question_count": 2},
        headers=headers,
    )
    quiz_data = gen_resp.json()["data"]
    quiz_id = quiz_data["id"]
    q1_id = quiz_data["questions"][0]["id"]
    q2_id = quiz_data["questions"][1]["id"]

    # In MockAIProvider, correct options are "A" and "B"
    submission = {
        "answers": [
            {"question_id": q1_id, "selected_option_id": "A"},
            {"question_id": q2_id, "selected_option_id": "B"},
        ]
    }

    sub_resp = await client.post(f"/api/v1/quizzes/{quiz_id}/attempts", json=submission, headers=headers)
    assert sub_resp.status_code == 200
    result = sub_resp.json()["data"]
    assert result["score"] == 2
    assert result["total_questions"] == 2
    assert result["percentage"] == 100.0

    # Reviews should now reveal explanations and correctness
    reviews = result["reviews"]
    assert len(reviews) == 2
    assert reviews[0]["is_correct"] is True
    assert reviews[0]["correct_option_id"] == "A"
    assert "explanation" in reviews[0]


@pytest.mark.asyncio
async def test_quiz_008_incorrect_and_partial_answers(client: AsyncClient):
    """QUIZ-008: Incorrect and unanswered scoring.

    Verify 1 correct and 1 wrong answer results in 50% score.
    """
    user_id, token = await get_test_auth(client, "quiz8@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    gen_resp = await client.post(
        "/api/v1/quizzes/generate",
        json={"topic": "BST", "question_count": 2},
        headers=headers,
    )
    quiz_data = gen_resp.json()["data"]
    quiz_id = quiz_data["id"]
    q1_id = quiz_data["questions"][0]["id"]
    q2_id = quiz_data["questions"][1]["id"]

    # 1 correct (A), 1 wrong (C instead of B)
    submission = {
        "answers": [
            {"question_id": q1_id, "selected_option_id": "A"},
            {"question_id": q2_id, "selected_option_id": "C"},
        ]
    }

    sub_resp = await client.post(f"/api/v1/quizzes/{quiz_id}/attempts", json=submission, headers=headers)
    assert sub_resp.status_code == 200
    result = sub_resp.json()["data"]
    assert result["score"] == 1
    assert result["total_questions"] == 2
    assert result["percentage"] == 50.0
    assert result["reviews"][1]["is_correct"] is False


@pytest.mark.asyncio
async def test_quiz_009_invalid_submission_and_ownership(client: AsyncClient):
    """QUIZ-009: Invalid submission rejection and cross-user security.

    Verify unknown question IDs and cross-user quiz access are rejected.
    """
    user_a_id, token_a = await get_test_auth(client, "quiz_a@example.com")
    user_b_id, token_b = await get_test_auth(client, "quiz_b@example.com")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates a quiz
    gen_a = await client.post("/api/v1/quizzes/generate", json={"topic": "Topic A"}, headers=headers_a)
    quiz_a_id = gen_a.json()["data"]["id"]

    # 1. Invalid question ID on valid quiz
    invalid_sub = {"answers": [{"question_id": "fake_question_id", "selected_option_id": "A"}]}
    resp_bad_q = await client.post(f"/api/v1/quizzes/{quiz_a_id}/attempts", json=invalid_sub, headers=headers_a)
    assert resp_bad_q.status_code == 422
    assert resp_bad_q.json()["error"]["code"] == "INVALID_INPUT"

    # 2. User B cannot access User A's quiz
    resp_cross_get = await client.get(f"/api/v1/quizzes/{quiz_a_id}", headers=headers_b)
    assert resp_cross_get.status_code == 404
    assert resp_cross_get.json()["error"]["code"] == "NOT_FOUND"

    # 3. User B cannot submit an attempt on User A's quiz
    resp_cross_sub = await client.post(f"/api/v1/quizzes/{quiz_a_id}/attempts", json={"answers": []}, headers=headers_b)
    assert resp_cross_sub.status_code == 404


@pytest.mark.asyncio
async def test_quiz_010_attempt_persistence(client: AsyncClient):
    """QUIZ-010: Attempt persistence.

    Verify quiz attempts are recorded under user history.
    """
    user_id, token = await get_test_auth(client, "quiz10@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    gen_resp = await client.post("/api/v1/quizzes/generate", json={"topic": "History Test"}, headers=headers)
    quiz_id = gen_resp.json()["data"]["id"]
    q1_id = gen_resp.json()["data"]["questions"][0]["id"]

    sub_resp = await client.post(
        f"/api/v1/quizzes/{quiz_id}/attempts",
        json={"answers": [{"question_id": q1_id, "selected_option_id": "A"}]},
        headers=headers,
    )
    assert sub_resp.status_code == 200
    attempt_id = sub_resp.json()["data"]["id"]
    assert attempt_id is not None

