"""Upload and ExtractedContent repository with strict user ownership enforcement."""

from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.upload import ExtractedContent, UploadedFile


class UploadRepository:
    """Data access layer for uploaded files and extracted contents."""

    async def create_uploaded_file(
        self,
        db: AsyncSession,
        user_id: str,
        storage_path: str,
        mime_type: str,
        file_size: int,
        original_filename: str,
    ) -> UploadedFile:
        """Persist a new uploaded file record."""
        record = UploadedFile(
            user_id=user_id,
            storage_path=storage_path,
            mime_type=mime_type,
            file_size=file_size,
            original_filename=original_filename,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return record

    async def get_uploaded_file(
        self,
        db: AsyncSession,
        file_id: str,
        user_id: str,
    ) -> Optional[UploadedFile]:
        """Fetch uploaded file by ID strictly scoped to user_id."""
        stmt = select(UploadedFile).where(
            UploadedFile.id == file_id,
            UploadedFile.user_id == user_id,
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def list_uploaded_files(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[UploadedFile]:
        """List uploaded files for a user ordered newest first."""
        stmt = (
            select(UploadedFile)
            .where(UploadedFile.user_id == user_id)
            .order_by(UploadedFile.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def delete_uploaded_file(
        self,
        db: AsyncSession,
        file_id: str,
        user_id: str,
    ) -> bool:
        """Delete uploaded file record scoped to user_id."""
        record = await self.get_uploaded_file(db, file_id, user_id)
        if not record:
            return False
        await db.delete(record)
        await db.commit()
        return True

    async def create_extracted_content(
        self,
        db: AsyncSession,
        user_id: str,
        uploaded_file_id: Optional[str],
        title: str,
        subject: str,
        topic: str,
        subtopics: str,
        extracted_text: str,
        key_concepts: str,
        equations: str,
        visual_elements: str,
        uncertainties: str,
        language: str = "en",
    ) -> ExtractedContent:
        """Persist extracted educational content."""
        record = ExtractedContent(
            user_id=user_id,
            uploaded_file_id=uploaded_file_id,
            title=title,
            subject=subject,
            topic=topic,
            subtopics=subtopics,
            extracted_text=extracted_text,
            key_concepts=key_concepts,
            equations=equations,
            visual_elements=visual_elements,
            uncertainties=uncertainties,
            language=language,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return record

    async def get_extracted_content(
        self,
        db: AsyncSession,
        content_id: str,
        user_id: str,
    ) -> Optional[ExtractedContent]:
        """Fetch extracted content by ID strictly scoped to user_id."""
        stmt = select(ExtractedContent).where(
            ExtractedContent.id == content_id,
            ExtractedContent.user_id == user_id,
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_extracted_content_by_file_id(
        self,
        db: AsyncSession,
        file_id: str,
        user_id: str,
    ) -> Optional[ExtractedContent]:
        """Fetch extracted content associated with an uploaded file strictly scoped to user_id."""
        stmt = select(ExtractedContent).where(
            ExtractedContent.uploaded_file_id == file_id,
            ExtractedContent.user_id == user_id,
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()


# Shared repository instance
upload_repo = UploadRepository()

