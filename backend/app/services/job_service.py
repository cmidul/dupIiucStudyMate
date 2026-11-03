"""Background Job Service managing lifecycles, retries, and worker tasks (JOB-001..007)."""

import asyncio
import json
import logging
from typing import Any, Callable, Coroutine, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import BackgroundJob
from app.repositories.job_repo import job_repo
from app.schemas.upload import BackgroundJobResponse

logger = logging.getLogger("learning_assistant.jobs")


class JobLifecycleError(Exception):
    """Raised when an invalid job state transition is attempted."""
    pass


class JobService:
    """Manages background job lifecycles, retry semantics, and ownership."""

    VALID_TRANSITIONS = {
        "queued": {"processing", "failed"},
        "processing": {"completed", "failed", "queued"},
        "completed": set(),  # terminal state
        "failed": {"queued"},  # retry state
    }

    def validate_transition(self, current_status: str, target_status: str) -> None:
        """Validate state transition according to JOB-001."""
        allowed = self.VALID_TRANSITIONS.get(current_status, set())
        if target_status not in allowed:
            raise JobLifecycleError(
                f"Invalid job state transition from '{current_status}' to '{target_status}'. "
                f"Allowed transitions: {allowed or 'None (terminal)'}"
            )

    async def create_job(
        self,
        db: AsyncSession,
        user_id: str,
        job_type: str,
        payload: Dict[str, Any],
        max_retries: int = 3,
    ) -> BackgroundJob:
        """Create a new background job in 'queued' status."""
        return await job_repo.create_job(
            db=db,
            user_id=user_id,
            job_type=job_type,
            payload=payload,
            max_retries=max_retries,
        )

    async def get_job(
        self,
        db: AsyncSession,
        job_id: str,
        user_id: str,
    ) -> Optional[BackgroundJobResponse]:
        """Fetch job strictly scoped to user_id (JOB-002)."""
        job = await job_repo.get_job(db, job_id, user_id)
        if not job:
            return None
        return self._to_response(job)

    async def start_processing(
        self,
        db: AsyncSession,
        job: BackgroundJob,
    ) -> BackgroundJob:
        """Transition job from 'queued' to 'processing'."""
        self.validate_transition(job.status, "processing")
        return await job_repo.update_job(db, job, status="processing")

    async def complete_job(
        self,
        db: AsyncSession,
        job: BackgroundJob,
        result: Dict[str, Any],
    ) -> BackgroundJob:
        """Transition job from 'processing' to 'completed'."""
        self.validate_transition(job.status, "completed")
        return await job_repo.update_job(db, job, status="completed", result=result)

    async def fail_job(
        self,
        db: AsyncSession,
        job: BackgroundJob,
        error_code: str,
        error_message: str,
        is_transient: bool = False,
    ) -> BackgroundJob:
        """Handle failure with bounded retries (JOB-004, JOB-005)."""
        if is_transient and job.retry_count < job.max_retries:
            # Re-queue for retry
            self.validate_transition(job.status, "queued")
            return await job_repo.update_job(
                db=db,
                job=job,
                status="queued",
                error_code=error_code,
                error_message=error_message,
                increment_retry=True,
            )
        else:
            # Permanent failure or retries exhausted
            self.validate_transition(job.status, "failed")
            return await job_repo.update_job(
                db=db,
                job=job,
                status="failed",
                error_code=error_code,
                error_message=error_message,
                increment_retry=True,
            )

    def _to_response(self, job: BackgroundJob) -> BackgroundJobResponse:
        """Map ORM BackgroundJob to safe Pydantic response."""
        result_dict = None
        if job.result:
            try:
                result_dict = json.loads(job.result)
            except Exception:
                result_dict = {"raw": job.result}

        return BackgroundJobResponse(
            id=job.id,
            user_id=job.user_id,
            job_type=job.job_type,
            status=job.status,
            retry_count=job.retry_count,
            max_retries=job.max_retries,
            result=result_dict,
            error_code=job.error_code,
            error_message=job.error_message,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )


# Shared service instance
job_service = JobService()

