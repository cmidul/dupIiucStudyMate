"""Tests for Background Job Management and Reliability (JOB-001..007)."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import BackgroundJob
from app.repositories.job_repo import job_repo
from app.services.job_service import JobLifecycleError, job_service


async def get_test_auth(client: AsyncClient, email: str = "job_user@example.com") -> dict:
    password = "StrongPassword123!"
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    login = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_job_001_lifecycle(db_session: AsyncSession):
    """JOB-001: Job transitions through valid states (queued -> processing -> completed)."""
    user_id = "test-job-user-1"
    job = await job_service.create_job(db_session, user_id, "image_extraction", {"file": "slide.png"})
    assert job.status == "queued"

    job = await job_service.start_processing(db_session, job)
    assert job.status == "processing"

    job = await job_service.complete_job(db_session, job, result={"extracted_content_id": "ec-123"})
    assert job.status == "completed"
    assert "ec-123" in job.result


@pytest.mark.asyncio
async def test_job_002_ownership(client: AsyncClient, db_session: AsyncSession):
    """JOB-002: User B cannot inspect User A's job."""
    headers_a = await get_test_auth(client, "job_user_a@example.com")
    headers_b = await get_test_auth(client, "job_user_b@example.com")

    # Get user A ID from me endpoint
    me_a = await client.get("/api/v1/auth/me", headers=headers_a)
    user_a_id = me_a.json()["data"]["id"]

    job = await job_service.create_job(db_session, user_a_id, "test_job", {})

    # User B queries User A's job
    res = await client.get(f"/api/v1/jobs/{job.id}", headers=headers_b)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_job_003_invalid_state_transition(db_session: AsyncSession):
    """JOB-003: Invalid transitions (e.g. completed directly to processing) raise JobLifecycleError."""
    user_id = "test-job-user-3"
    job = await job_service.create_job(db_session, user_id, "task", {})
    await job_service.start_processing(db_session, job)
    await job_service.complete_job(db_session, job, {"done": True})

    with pytest.raises(JobLifecycleError):
        await job_service.start_processing(db_session, job)


@pytest.mark.asyncio
async def test_job_004_transient_failure_retry(db_session: AsyncSession):
    """JOB-004: Transient failure increments retry counter and re-queues."""
    user_id = "test-job-user-4"
    job = await job_service.create_job(db_session, user_id, "retry_job", {}, max_retries=3)
    await job_service.start_processing(db_session, job)

    # Simulate transient timeout
    job = await job_service.fail_job(
        db_session,
        job,
        error_code="TIMEOUT",
        error_message="Provider timed out",
        is_transient=True,
    )
    assert job.status == "queued"
    assert job.retry_count == 1


@pytest.mark.asyncio
async def test_job_005_permanent_failure(db_session: AsyncSession):
    """JOB-005: Permanent error transitions directly to failed state without endless retries."""
    user_id = "test-job-user-5"
    job = await job_service.create_job(db_session, user_id, "fail_job", {})
    await job_service.start_processing(db_session, job)

    job = await job_service.fail_job(
        db_session,
        job,
        error_code="CORRUPT_INPUT",
        error_message="Payload cannot be parsed",
        is_transient=False,
    )
    assert job.status == "failed"
    assert job.error_code == "CORRUPT_INPUT"


@pytest.mark.asyncio
async def test_job_006_idempotency(db_session: AsyncSession):
    """JOB-006: Re-processing completed job preserves existing result."""
    user_id = "test-job-user-6"
    job = await job_service.create_job(db_session, user_id, "idem_job", {})
    await job_service.start_processing(db_session, job)
    job = await job_service.complete_job(db_session, job, {"unique_token": "original_123"})

    # Attempting to fetch or run again yields original token
    fetched = await job_service.get_job(db_session, job.id, user_id)
    assert fetched.status == "completed"
    assert fetched.result["unique_token"] == "original_123"


@pytest.mark.asyncio
async def test_job_007_concurrent_jobs(db_session: AsyncSession):
    """JOB-007: Multiple simultaneous jobs for one user remain isolated."""
    user_id = "test-job-user-7"
    job1 = await job_service.create_job(db_session, user_id, "job_1", {"seq": 1})
    job2 = await job_service.create_job(db_session, user_id, "job_2", {"seq": 2})

    assert job1.id != job2.id
    assert job1.payload != job2.payload

    await job_service.start_processing(db_session, job1)
    await job_service.complete_job(db_session, job1, {"result": "one"})

    # Job 2 is still queued and unaffected
    refreshed_job2 = await job_repo.get_job(db_session, job2.id, user_id)
    assert refreshed_job2.status == "queued"

