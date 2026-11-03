"""Tests for health check endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_v1(client: AsyncClient):
    """Verify /api/v1/health returns status ok with request ID."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert "data" in payload
    assert "request_id" in payload
    assert payload["data"]["status"] == "ok"
    assert "version" in payload["data"]


@pytest.mark.asyncio
async def test_health_check_root_alias(client: AsyncClient):
    """Verify /health alias returns status ok with request ID."""
    response = await client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["status"] == "ok"
    assert payload["request_id"] != ""

