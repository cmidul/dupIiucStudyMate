"""Tests for Mathematical Problem Solver (F-08, MATH-001..010)."""

import pytest
from httpx import AsyncClient

from app.ai.mock_provider import MockAIProvider
from app.ai.schemas import MathSolutionSchema, MathStep, MathVerification
from app.services.math_solver import math_solver_service


async def get_test_auth(client: AsyncClient, email: str = "math_user@example.com") -> dict:
    password = "StrongPassword123!"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_math_001_arithmetic(client: AsyncClient):
    """MATH-001: Arithmetic problem evaluation."""
    headers = await get_test_auth(client, "math1@example.com")
    res = await client.post(
        "/api/v1/solvers/math",
        headers=headers,
        json={"problem": "25 * (8 + 2)"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["category"] == "arithmetic"
    assert data["final_answer"] == "250"
    assert data["verification"]["status"] == "passed"
    assert data["verification"]["performed"] is True


@pytest.mark.asyncio
async def test_math_002_linear_equation(client: AsyncClient):
    """MATH-002: Solve linear equation."""
    headers = await get_test_auth(client, "math2@example.com")
    res = await client.post(
        "/api/v1/solvers/math",
        headers=headers,
        json={"problem": "2x + 6 = 14"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["category"] == "linear_equation"
    assert data["final_answer"] == "x = 4"
    assert data["verification"]["status"] == "passed"


@pytest.mark.asyncio
async def test_math_003_quadratic_equation(client: AsyncClient):
    """MATH-003: Solve quadratic equation."""
    headers = await get_test_auth(client, "math3@example.com")
    res = await client.post(
        "/api/v1/solvers/math",
        headers=headers,
        json={"problem": "x^2 - 5x + 6 = 0"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["category"] == "quadratic_equation"
    assert "2" in data["final_answer"]
    assert "3" in data["final_answer"]
    assert data["verification"]["status"] == "passed"


@pytest.mark.asyncio
async def test_math_004_no_real_roots(client: AsyncClient):
    """MATH-004: Correctly identifies no real roots over the real numbers."""
    headers = await get_test_auth(client, "math4@example.com")
    res = await client.post(
        "/api/v1/solvers/math",
        headers=headers,
        json={"problem": "x^2 + 1 = 0", "domain": "real"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["category"] == "quadratic_equation"
    assert "No real roots" in data["final_answer"]

    # Complex domain reports complex roots
    res_complex = await client.post(
        "/api/v1/solvers/math",
        headers=headers,
        json={"problem": "x^2 + 1 = 0", "domain": "complex"},
    )
    assert res_complex.status_code == 200
    data_complex = res_complex.json()["data"]
    assert "i" in data_complex["final_answer"].lower()


@pytest.mark.asyncio
async def test_math_005_infinite_and_no_solution_equations(client: AsyncClient):
    """MATH-005: Infinite solutions (0x = 0) and No solution (0x = 5)."""
    headers = await get_test_auth(client, "math5@example.com")

    # Infinite solutions
    res_inf = await client.post(
        "/api/v1/solvers/math",
        headers=headers,
        json={"problem": "0*x = 0"},
    )
    assert res_inf.status_code == 200
    data_inf = res_inf.json()["data"]
    assert "infinitely many" in data_inf["final_answer"].lower() or "all real" in data_inf["final_answer"].lower()

    # No solution
    res_none = await client.post(
        "/api/v1/solvers/math",
        headers=headers,
        json={"problem": "0*x = 5"},
    )
    assert res_none.status_code == 200
    data_none = res_none.json()["data"]
    assert "no solution" in data_none["final_answer"].lower()


@pytest.mark.asyncio
async def test_math_006_image_derived_equation(client: AsyncClient):
    """MATH-006: Equation extracted from image context."""
    headers = await get_test_auth(client, "math6@example.com")
    res = await client.post(
        "/api/v1/solvers/math",
        headers=headers,
        json={
            "problem": "3x - 9 = 0",
            "source_content_id": "img-source-12345",
        },
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["final_answer"] == "x = 3"
    assert data["verification"]["status"] == "passed"


@pytest.mark.asyncio
async def test_math_007_ambiguous_expression(client: AsyncClient):
    """MATH-007: Ambiguous expression triggers clarification."""
    headers = await get_test_auth(client, "math7@example.com")
    res = await client.post(
        "/api/v1/solvers/math",
        headers=headers,
        json={"problem": "1/2x = 5"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] == "ambiguous"
    assert data["clarification_needed"] is True
    assert "ambiguous" in data["clarification_question"].lower()
    assert "(1/2)*x" in data["clarification_question"] or "1/(2x)" in data["clarification_question"]


@pytest.mark.asyncio
async def test_math_008_verification_accuracy(client: AsyncClient):
    """MATH-008: Deterministic comparison flags passed vs failed verification accurately."""
    headers = await get_test_auth(client, "math8@example.com")
    res = await client.post(
        "/api/v1/solvers/math",
        headers=headers,
        json={"problem": "10 * 5"},
    )
    data = res.json()["data"]
    assert data["verification"]["status"] == "passed"

    # Inject simulated AI hallucination / wrong answer
    mock_provider = MockAIProvider()
    mock_provider.custom_response = MathSolutionSchema(
        problem="10 * 5",
        category="arithmetic",
        status="solved",
        steps=[MathStep(step=1, explanation="Wrong arithmetic", expression="10 * 5 = 999")],
        final_answer="999",  # Deliberately wrong
        verification=MathVerification(performed=True, status="passed", method="sympy"),
    ).model_dump_json()

    orig_provider = math_solver_service.ai_provider
    try:
        math_solver_service.ai_provider = mock_provider
        res_hallucinated = await client.post(
            "/api/v1/solvers/math",
            headers=headers,
            json={"problem": "10 * 5"},
        )
        data_hallucinated = res_hallucinated.json()["data"]
        # Verification MUST catch the discrepancy and be marked failed (never passed!)
        assert data_hallucinated["verification"]["status"] == "failed"
    finally:
        math_solver_service.ai_provider = orig_provider


@pytest.mark.asyncio
async def test_math_009_unsafe_expression(client: AsyncClient):
    """MATH-009: Unsafe code, imports, and arbitrary execution payloads are rejected."""
    headers = await get_test_auth(client, "math9@example.com")
    malicious_payloads = [
        "__import__('os').system('dir')",
        "eval('2 + 2')",
        "open('/etc/passwd').read()",
        "lambda x: x + 1",
        "import sys; sys.exit(0)",
        "x.__class__.__bases__",
    ]

    for payload in malicious_payloads:
        res = await client.post(
            "/api/v1/solvers/math",
            headers=headers,
            json={"problem": payload},
        )
        assert res.status_code == 400
        assert "safety check failed" in res.json()["error"]["message"].lower() or "disallowed" in res.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_math_010_unsupported_advanced_problem(client: AsyncClient):
    """MATH-010: Unsupported advanced problems return clear limitation without fabricated verification."""
    headers = await get_test_auth(client, "math10@example.com")
    res = await client.post(
        "/api/v1/solvers/math",
        headers=headers,
        json={"problem": "solve advanced differential manifold tensor d(g_{ij})/dx^k = 0"},
    )
    # Rejects as unsupported syntax / limitation
    assert res.status_code in {200, 400}
    if res.status_code == 200:
        data = res.json()["data"]
        assert data["verification"]["status"] in {"not_available", "ambiguous"}
