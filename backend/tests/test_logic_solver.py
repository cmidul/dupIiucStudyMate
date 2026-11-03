"""Tests for Logical Reasoning Solver (F-09, LOGIC-001..006)."""

import pytest
from httpx import AsyncClient


async def get_test_auth(client: AsyncClient, email: str = "logic_user@example.com") -> dict:
    password = "StrongPassword123!"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_logic_001_deductive_reasoning(client: AsyncClient):
    """LOGIC-001: Deductive reasoning (Transitive Syllogism Barbara)."""
    headers = await get_test_auth(client, "logic1@example.com")
    res = await client.post(
        "/api/v1/solvers/logic",
        headers=headers,
        json={"problem": "All A are B. All B are C. Are all A also C?"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["category"] == "deductive_reasoning"
    assert data["status"] == "solved"
    assert "yes" in data["final_answer"].lower()
    assert len(data["reasoning_steps"]) > 0


@pytest.mark.asyncio
async def test_logic_002_syllogism_invalid_conclusion(client: AsyncClient):
    """LOGIC-002: Syllogism with invalid conclusion (Undistributed Middle)."""
    headers = await get_test_auth(client, "logic2@example.com")
    problem = "All cats are animals. Some animals are dogs. Therefore some cats are dogs."
    res = await client.post(
        "/api/v1/solvers/logic",
        headers=headers,
        json={"problem": problem},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] == "invalid_argument"
    assert "not logically follow" in data["final_answer"].lower() or "no" in data["final_answer"].lower()
    assert any("undistributed" in step.lower() or "invalid" in step.lower() for step in data["reasoning_steps"])


@pytest.mark.asyncio
async def test_logic_003_propositional_truth_table(client: AsyncClient):
    """LOGIC-003: Deterministic truth table evaluation for P AND NOT P (Contradiction)."""
    headers = await get_test_auth(client, "logic3@example.com")
    res = await client.post(
        "/api/v1/solvers/logic",
        headers=headers,
        json={"problem": "P AND NOT P"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["category"] == "truth_table"
    assert data["truth_table"] is not None
    assert data["truth_table"]["classification"] == "contradiction"
    assert len(data["truth_table"]["rows"]) == 2  # P is True, P is False
    # All rows must evaluate to False
    assert all(row["result"] is False for row in data["truth_table"]["rows"])


@pytest.mark.asyncio
async def test_logic_004_sequence_pattern(client: AsyncClient):
    """LOGIC-004: Number sequence and pattern detection."""
    headers = await get_test_auth(client, "logic4@example.com")
    res = await client.post(
        "/api/v1/solvers/logic",
        headers=headers,
        json={"problem": "2, 4, 8, 16, ?"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["category"] == "pattern_sequence"
    assert data["final_answer"] == "32"
    assert "geometric progression" in data["reasoning_steps"][1].lower()


@pytest.mark.asyncio
async def test_logic_005_assumptions_identification(client: AsyncClient):
    """LOGIC-005: Underspecified logic puzzle explicitly lists assumptions."""
    headers = await get_test_auth(client, "logic5@example.com")
    problem = "If it rains, the grass is wet. The grass is wet. Did it rain?"
    res = await client.post(
        "/api/v1/solvers/logic",
        headers=headers,
        json={"problem": problem},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert "assumptions" in data
    assert isinstance(data["assumptions"], list)
    assert len(data["reasoning_steps"]) > 0


@pytest.mark.asyncio
async def test_logic_006_no_fabricated_proof(client: AsyncClient):
    """LOGIC-006: Invalid argument must never be presented as a valid proof."""
    headers = await get_test_auth(client, "logic6@example.com")
    invalid_argument = "All cats are animals. Some animals are dogs. Therefore some cats are dogs."
    res = await client.post(
        "/api/v1/solvers/logic",
        headers=headers,
        json={"problem": invalid_argument},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    # Must explicitly refute or reject conclusion
    assert data["status"] != "valid"
    assert "does not logically follow" in data["final_answer"].lower()
