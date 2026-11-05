"""Tests for the unified 'Solve Questions' feature (SOLVE-001..010).

Verifies automatic task classification, mathematical solving, logical reasoning,
summarization, general educational QA, image inputs, follow-up conversation threads,
ambiguity handling, security AST protection, and Telegram bot integration.
"""

import io
import json
import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.ai.exceptions import AITimeoutError
from app.ai.router import ai_router
from app.ai.schemas import ExtractedContentSchema, ImageAnalysisResponse, TextGenerationResponse
from app.schemas.unified_solver import EducationalSolution
from app.models.user import User
from app.repositories.upload_repo import upload_repo
from app.services.telegram_bot_service import telegram_bot_service
from app.storage.file_storage import file_storage


async def get_test_auth(client: AsyncClient, email: str = "solve_user@example.com") -> tuple[str, str, dict]:
    """Helper to create and authenticate a test user."""
    password = "StrongPassword123!"
    reg = await client.post("/api/v1/auth/register", json={"email": email, "password": password, "name": "Solve Student"})
    user_id = reg.json()["data"]["id"]
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = login.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return user_id, token, headers


@pytest.mark.asyncio
async def test_solve_001_auto_math(client: AsyncClient):
    """SOLVE-001: Automatic routing of mathematical equations to math solver without manual selection."""
    _, _, headers = await get_test_auth(client, "solve1@example.com")
    payload = {
        "input_text": "x^2 - 5x + 6 = 0",
    }
    resp = await client.post("/api/v1/solve", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["task_type"] == "mathematics"
    assert data["task_label"] == "Mathematics"
    assert "x = 2 or x = 3" in data["summary_or_answer"]
    assert data["math_solution"] is not None
    assert len(data["math_solution"]["steps"]) > 0
    assert data["conversation_id"] is not None


@pytest.mark.asyncio
async def test_solve_002_auto_logic(client: AsyncClient):
    """SOLVE-002: Automatic routing of logical syllogisms or propositions to logic solver."""
    _, _, headers = await get_test_auth(client, "solve2@example.com")
    payload = {
        "input_text": "All humans are mortal. Socrates is human. Is Socrates mortal?",
    }
    resp = await client.post("/api/v1/solve", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["task_type"] == "logical_reasoning"
    assert data["task_label"] == "Logical Reasoning"
    assert data["logic_solution"] is not None
    assert len(data["logic_solution"]["reasoning_steps"]) > 0
    assert data["conversation_id"] is not None


@pytest.mark.asyncio
async def test_solve_003_auto_summary(client: AsyncClient):
    """SOLVE-003: Automatic routing of educational passages or notes to summarizer."""
    _, _, headers = await get_test_auth(client, "solve3@example.com")
    passage = (
        "A Binary Search Tree is a node-based binary tree data structure with the property that the left subtree "
        "of a node contains only keys lesser than the node's key, and the right subtree contains only keys greater "
        "than the node's key. Both the left and right subtrees must also be binary search trees. There must be no "
        "duplicate nodes. The major advantage of binary search trees over other data structures is that the related "
        "sorting algorithms and search algorithms such as in-order traversal can be very efficient."
    )
    payload = {
        "input_text": passage,
        "preferred_style": "exam_notes",
    }
    resp = await client.post("/api/v1/solve", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["task_type"] == "summarization"
    assert data["task_label"] == "Study Summary"
    assert data["summary_solution"] is not None
    assert data["summary_solution"]["content"] is not None
    assert data["conversation_id"] is not None


@pytest.mark.asyncio
async def test_solve_004_auto_general_educational(client: AsyncClient):
    """SOLVE-004: Automatic routing of conceptual educational questions to educational QA."""
    _, _, headers = await get_test_auth(client, "solve4@example.com")
    payload = {
        "input_text": "How does photosynthesis convert sunlight into chemical energy?",
    }
    resp = await client.post("/api/v1/solve", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["task_type"] == "general_educational"
    assert data["task_label"] == "Educational Explanation"
    assert data["summary_or_answer"] == data["educational_solution"]["conclusion"]
    assert len(data["educational_solution"]["steps"]) > 0
    assert data["conversation_id"] is not None


@pytest.mark.asyncio
async def test_educational_solve_surfaces_provider_timeout(client: AsyncClient, monkeypatch):
    async def fail_generation(request):
        raise AITimeoutError()

    monkeypatch.setattr(ai_router, "generate_text", fail_generation)
    _, _, headers = await get_test_auth(client)
    response = await client.post(
        "/api/v1/solve",
        json={"input_text": "How does photosynthesis convert sunlight into chemical energy?"},
        headers=headers,
    )

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "PROVIDER_UNAVAILABLE"


@pytest.mark.asyncio
@pytest.mark.parametrize("vision_succeeds", [True, False])
async def test_solve_uploaded_image(client: AsyncClient, monkeypatch, tmp_path, vision_succeeds):
    async def analyze_image(request):
        if not vision_succeeds:
            raise AITimeoutError()
        extraction = ExtractedContentSchema(extracted_text="Solve 2x + 4 = 10", equations=["2x + 4 = 10"])
        return ImageAnalysisResponse(
            content=extraction.model_dump_json(), provider="mock", model="test-vision",
            structured_data=extraction.model_dump(),
        )

    monkeypatch.setattr(ai_router, "analyze_image", analyze_image)
    monkeypatch.setattr(file_storage, "base_dir", tmp_path)
    _, _, headers = await get_test_auth(client)
    image = io.BytesIO()
    Image.new("RGB", (64, 64), "white").save(image, format="PNG")

    response = await client.post(
        "/api/v1/solve/upload", headers=headers,
        files={"file": ("equation.png", image.getvalue(), "image/png")},
    )

    if vision_succeeds:
        assert response.status_code == 200
        result = response.json()["data"]
        assert result["summary_or_answer"] == "x = 3"
        assert result["source_content_id"]
    else:
        assert response.status_code == 502
        assert response.json()["error"]["code"] == "IMAGE_EXTRACTION_FAILED"


@pytest.mark.asyncio
@pytest.mark.parametrize("equations", [[], ["A[20] = h + A[8] - A[3];"]])
async def test_image_exam_preserves_all_questions(client: AsyncClient, monkeypatch, tmp_path, equations):
    assignment = "A[20] = h + A[8] - A[3];"
    transcript = (
        "Q1. Write MIPS instructions for this C assignment. " + assignment + "\n"
        "Q2. Calculate the clock rate for 48 billion cycles in 6 seconds."
    )

    async def analyze_image(request):
        extraction = ExtractedContentSchema(extracted_text=transcript, equations=equations)
        return ImageAnalysisResponse(
            content=extraction.model_dump_json(), provider="mock", model="test-vision",
            structured_data=extraction.model_dump(),
        )

    async def generate_text(request):
        assert transcript in request.prompt
        assert request.response_schema is EducationalSolution
        answer = EducationalSolution(conclusion="Q1. Load, add, subtract, store. Q2. 8 GHz.")
        return TextGenerationResponse(
            content=answer.model_dump_json(), provider="mock", model="test-text",
            structured_data=answer.model_dump(),
        )

    monkeypatch.setattr(ai_router, "analyze_image", analyze_image)
    monkeypatch.setattr(ai_router, "generate_text", generate_text)
    monkeypatch.setattr(file_storage, "base_dir", tmp_path)
    _, _, headers = await get_test_auth(client)
    image = io.BytesIO()
    Image.new("RGB", (64, 64), "white").save(image, format="JPEG")

    response = await client.post(
        "/api/v1/solve/upload", headers=headers,
        files={"file": ("exam.jpg", image.getvalue(), "image/jpeg")},
    )

    assert response.status_code == 200
    result = response.json()["data"]
    assert result["task_type"] == "general_educational"
    assert "8 GHz" in result["summary_or_answer"]


@pytest.mark.asyncio
async def test_solve_005_image_input_math(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """SOLVE-005: Image input containing mathematical equations automatically solved."""
    user_id, _, headers = await get_test_auth(client, "solve5@example.com")

    # Create an extracted content record with mathematical equation
    ext = await upload_repo.create_extracted_content(
        db=db_session,
        user_id=user_id,
        uploaded_file_id=None,
        title="Math Blackboard",
        subject="Mathematics",
        topic="Algebra",
        subtopics="[]",
        extracted_text="Solve the equation 2x + 4 = 10",
        key_concepts="[]",
        equations=json.dumps(["2x + 4 = 10"]),
        visual_elements="[]",
        uncertainties="[]",
    )

    payload = {
        "source_content_id": ext.id,
    }
    resp = await client.post("/api/v1/solve", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["task_type"] == "mathematics"
    assert "x = 3" in data["summary_or_answer"]
    assert data["source_content_id"] == ext.id


@pytest.mark.asyncio
async def test_solve_006_image_input_summary(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """SOLVE-006: Image input containing lecture notes automatically summarized."""
    user_id, _, headers = await get_test_auth(client, "solve6@example.com")

    lecture_notes = (
        "Operating System Process States: A process undergoes several lifecycle states including New, Ready, "
        "Running, Waiting, and Terminated. When a process is created, it enters the Ready state waiting for CPU "
        "allocation by the short-term scheduler. Upon assignment, it transitions to Running state."
    )
    ext = await upload_repo.create_extracted_content(
        db=db_session,
        user_id=user_id,
        uploaded_file_id=None,
        title="OS Lecture Slide",
        subject="Computer Science",
        topic="Operating Systems",
        subtopics="[]",
        extracted_text=lecture_notes,
        key_concepts="[]",
        equations="[]",
        visual_elements="[]",
        uncertainties="[]",
    )

    payload = {
        "source_content_id": ext.id,
        "preferred_style": "detailed",
    }
    resp = await client.post("/api/v1/solve", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["task_type"] == "summarization"
    assert data["summary_solution"] is not None
    assert data["source_content_id"] == ext.id


@pytest.mark.asyncio
async def test_solve_007_follow_up_thread(client: AsyncClient):
    """SOLVE-007: Ask follow-up questions within the solved problem conversation thread."""
    _, _, headers = await get_test_auth(client, "solve7@example.com")

    # 1. Initial problem solve
    init_payload = {"input_text": "x^2 - 5x + 6 = 0"}
    init_resp = await client.post("/api/v1/solve", json=init_payload, headers=headers)
    assert init_resp.status_code == 200
    conv_id = init_resp.json()["data"]["conversation_id"]

    # 2. Ask follow-up question in the same thread
    follow_up_payload = {
        "conversation_id": conv_id,
        "message": "Why are the roots 2 and 3?",
    }
    flw_resp = await client.post("/api/v1/solve/follow-up", json=follow_up_payload, headers=headers)
    assert flw_resp.status_code == 200
    flw_data = flw_resp.json()["data"]

    assert flw_data["conversation_id"] == conv_id
    assert flw_data["user_message"] == "Why are the roots 2 and 3?"
    assert len(flw_data["assistant_message"]) > 0


@pytest.mark.asyncio
async def test_solve_008_ambiguity_handling(client: AsyncClient):
    """SOLVE-008: Ambiguous expressions trigger clarification requests without crashing."""
    _, _, headers = await get_test_auth(client, "solve8@example.com")
    payload = {
        "input_text": "1/2x",
    }
    resp = await client.post("/api/v1/solve", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["clarification_needed"] is True
    assert "clarify using parentheses" in data["clarification_question"]


@pytest.mark.asyncio
async def test_solve_009_security_ast_injection(client: AsyncClient):
    """SOLVE-009: Malicious code injection payloads are safely rejected."""
    _, _, headers = await get_test_auth(client, "solve9@example.com")
    payload = {
        "input_text": "__import__('os').system('dir')",
    }
    resp = await client.post("/api/v1/solve", json=payload, headers=headers)
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "UNSAFE_EXPRESSION"


@pytest.mark.asyncio
async def test_solve_010_telegram_integration(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """SOLVE-010: Telegram bot /solve command routes through the unified solver pipeline."""
    user_id, _, _ = await get_test_auth(client, "solve10@example.com")

    # Fetch user from db and link telegram ID
    stmt = select(User).where(User.id == user_id)
    res = await db_session.execute(stmt)
    user = res.scalar_one()
    user.telegram_id = "554433221"
    await db_session.commit()

    update = {
        "update_id": 99991,
        "message": {
            "message_id": 101,
            "chat": {"id": 12345},
            "from": {"id": 554433221, "first_name": "Student"},
            "text": "/solve x^2 - 5x + 6 = 0",
        },
    }

    tg_res = await telegram_bot_service.process_update(db=db_session, update=update)
    assert tg_res["ok"] is True
    assert tg_res["action"] == "solved"
    assert tg_res["task_type"] == "mathematics"
    assert tg_res["conversation_id"] is not None
