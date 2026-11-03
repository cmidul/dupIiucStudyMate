"""Summary repository with ownership filtering."""

from typing import List, Optional
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.summary import Summary


class SummaryRepository:
    """Repository managing summaries with user ownership enforcement."""

    async def create(
        self,
        db: AsyncSession,
        user_id: str,
        title: str,
        topic: str,
        style: str,
        overview: str,
        structured_content: str,
        source_content_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> Summary:
        """Create and persist a new summary."""
        summary = Summary(
            user_id=user_id,
            title=title,
            topic=topic,
            style=style,
            overview=overview,
            structured_content=structured_content,
            source_content_id=source_content_id,
            conversation_id=conversation_id,
        )
        db.add(summary)
        await db.commit()
        await db.refresh(summary)
        return summary

    async def get_by_id(
        self,
        db: AsyncSession,
        summary_id: str,
        user_id: str,
    ) -> Optional[Summary]:
        """Get summary strictly belonging to user."""
        stmt = select(Summary).where(
            Summary.id == summary_id,
            Summary.user_id == user_id,
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    async def list_by_user(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Summary]:
        """List user's summaries ordered newest first."""
        stmt = (
            select(Summary)
            .where(Summary.user_id == user_id)
            .order_by(desc(Summary.created_at))
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def delete(
        self,
        db: AsyncSession,
        summary_id: str,
        user_id: str,
    ) -> bool:
        """Delete summary strictly belonging to user."""
        summary = await self.get_by_id(db, summary_id, user_id)
        if not summary:
            return False
        await db.delete(summary)
        await db.commit()
        return True


summary_repo = SummaryRepository()

