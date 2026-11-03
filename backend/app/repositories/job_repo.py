"""BackgroundJob repository with strict user ownership enforcement."""

import json
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import BackgroundJob


class JobRepository:
    """Data access layer for background jobs."""

    VALID_STATUSES = {"queued", "processing", "completed", "failed"}

    async def create_job(
        self,
        db: AsyncSession,
        user_id: str,
        job_type: str,
        payload: Dict[str, Any],
        max_retries: int = 3,
    ) -> BackgroundJob:
        """Create a new queued background job."""
        job = BackgroundJob(
            user_id=user_id,
            job_type=job_type,
            status="queued",
            payload=json.dumps(payload),
            max_retries=max_retries,
            retry_count=0,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        return job

    async def get_job(
        self,
        db: AsyncSession,
        job_id: str,
        user_id: str,
    ) -> Optional[BackgroundJob]:
        """Fetch background job by ID strictly scoped to user_id."""
        stmt = select(BackgroundJob).where(
            BackgroundJob.id == job_id,
            BackgroundJob.user_id == user_id,
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def update_job(
        self,
        db: AsyncSession,
        job: BackgroundJob,
        status: Optional[str] = None,
        result: Optional[Dict[str, Any]] = None,
        error_code: Optional[str] = None,
        error_message: Optional[str] = None,
        increment_retry: bool = False,
    ) -> BackgroundJob:
        """Update job status, payload results, and retry counters."""
        if status:
            if status not in self.VALID_STATUSES:
                raise ValueError(f"Invalid job status '{status}'. Must be one of {self.VALID_STATUSES}")
            job.status = status

        if result is not None:
            job.result = json.dumps(result)

        if error_code is not None:
            job.error_code = error_code

        if error_message is not None:
            job.error_message = error_message

        if increment_retry:
            job.retry_count += 1

        await db.commit()
        await db.refresh(job)
        return job

    async def list_jobs(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[BackgroundJob]:
        """List background jobs for a user ordered newest first."""
        stmt = (
            select(BackgroundJob)
            .where(BackgroundJob.user_id == user_id)
            .order_by(BackgroundJob.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())


# Shared repository instance
job_repo = JobRepository()

