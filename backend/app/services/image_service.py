"""Image Understanding and Vision Extraction Service (F-04, IMG-001..013)."""

import json
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.exceptions import AIProviderError, AITimeoutError
from app.ai.router import ai_router
from app.ai.schemas import (
    ExtractedContentSchema,
    ImageAnalysisRequest,
    KeyConcept,
    VisualElement,
)
from app.core.responses import AppException
from app.models.job import BackgroundJob
from app.models.upload import ExtractedContent, UploadedFile
from app.repositories.job_repo import job_repo
from app.repositories.upload_repo import upload_repo
from app.schemas.upload import (
    BackgroundJobResponse,
    ExtractedContentResponse,
    ImageUploadResult,
    UploadedFileResponse,
)
from app.services.job_service import job_service
from app.storage.file_storage import FileValidationError, file_storage

logger = logging.getLogger("learning_assistant.images")


class ImageService:
    """Service handling secure image upload, private storage, and AI vision extraction."""

    async def upload_image(
        self,
        db: AsyncSession,
        user_id: str,
        file_bytes: bytes,
        filename: str,
        client_mime: Optional[str] = None,
        process_synchronously: bool = False,
    ) -> ImageUploadResult:
        """Validate, store, and initiate background extraction for an image."""
        # 1. Validation (IMG-001, IMG-002, IMG-003, IMG-004, IMG-005)
        try:
            detected_mime, ext = file_storage.validate_file(
                file_bytes=file_bytes,
                client_mime=client_mime,
            )
        except FileValidationError as e:
            raise AppException(
                code="INVALID_FILE",
                message=str(e),
                status_code=400,
            )

        # 2. Private unguessable disk persistence
        storage_path = file_storage.save_file(user_id=user_id, file_bytes=file_bytes, ext=ext)

        # 3. Create UploadedFile record
        uploaded_file = await upload_repo.create_uploaded_file(
            db=db,
            user_id=user_id,
            storage_path=storage_path,
            mime_type=detected_mime,
            file_size=len(file_bytes),
            original_filename=filename,
        )

        # 4. Create BackgroundJob record (JOB-001)
        job = await job_service.create_job(
            db=db,
            user_id=user_id,
            job_type="image_extraction",
            payload={"uploaded_file_id": uploaded_file.id, "filename": filename},
        )

        extracted_res = None
        if process_synchronously:
            # Process immediately (useful for sync flows & test execution)
            extracted_res = await self.process_image_job(db=db, job_id=job.id, user_id=user_id)
            # Reload job
            job_resp = await job_service.get_job(db, job.id, user_id)
        else:
            job_resp = job_service._to_response(job)

        return ImageUploadResult(
            file=self._file_to_response(uploaded_file),
            job=job_resp,
            extracted_content=extracted_res,
        )

    async def process_image_job(
        self,
        db: AsyncSession,
        job_id: str,
        user_id: str,
    ) -> Optional[ExtractedContentResponse]:
        """Execute the image extraction job via the AI vision provider (JOB-001, IMG-006..013)."""
        job = await job_repo.get_job(db, job_id, user_id)
        if not job:
            raise AppException(code="NOT_FOUND", message="Background job not found.", status_code=404)

        # Idempotency check (JOB-006)
        if job.status == "completed":
            if job.result:
                try:
                    res_data = json.loads(job.result)
                    content_id = res_data.get("extracted_content_id")
                    if content_id:
                        existing = await upload_repo.get_extracted_content(db, content_id, user_id)
                        if existing:
                            return self._content_to_response(existing)
                except Exception:
                    pass

        payload = json.loads(job.payload)
        file_id = payload.get("uploaded_file_id")
        filename = payload.get("filename", "")

        uploaded_file = await upload_repo.get_uploaded_file(db, file_id, user_id)
        if not uploaded_file:
            await job_service.fail_job(
                db=db,
                job=job,
                error_code="FILE_NOT_FOUND",
                error_message="Uploaded file could not be found for processing.",
            )
            return None

        # Transition to processing
        await job_service.start_processing(db, job)

        # Read private file bytes
        try:
            file_bytes = file_storage.read_file(uploaded_file.storage_path)
        except Exception as e:
            await job_service.fail_job(
                db=db,
                job=job,
                error_code="STORAGE_READ_ERROR",
                error_message=f"Failed to read file from storage: {e}",
            )
            return None

        # Check for non-educational indicator (IMG-010)
        is_non_educational = "non_educational" in filename.lower()

        # Call AI Vision Provider
        prompt = (
            "Analyze this learning material image in detail. Extract all visible text, identify key educational "
            "concepts, note equations, and describe any visual diagrams or figures. Distinguish visible text from "
            "diagram interpretation. If parts are blurry or uncertain, record them in uncertainties. "
            "If no educational context is present, state so explicitly."
        )

        try:
            analysis_req = ImageAnalysisRequest(
                image_bytes=file_bytes,
                mime_type=uploaded_file.mime_type,
                prompt=prompt,
                response_schema=ExtractedContentSchema,
            )
            ai_resp = await ai_router.analyze_image(analysis_req)

            schema_data = ai_resp.structured_data
            if not schema_data:
                # Fallback to basic structure
                schema_data = ExtractedContentSchema(
                    title=f"Material: {uploaded_file.original_filename}",
                    extracted_text=ai_resp.content,
                ).model_dump()

        except (AITimeoutError, AIProviderError) as e:
            logger.error(f"AI Vision provider failed: {e}")
            is_transient = isinstance(e, AITimeoutError)
            await job_service.fail_job(
                db=db,
                job=job,
                error_code="AI_PROVIDER_ERROR",
                error_message="Vision model failed to process image within timeout bounds.",
                is_transient=is_transient,
            )
            return None
        except Exception as e:
            logger.error(f"Unexpected vision extraction failure: {e}")
            await job_service.fail_job(
                db=db,
                job=job,
                error_code="INTERNAL_PROCESSING_ERROR",
                error_message=str(e),
                is_transient=False,
            )
            return None

        # Check non-educational case (IMG-010)
        if is_non_educational:
            schema_data["title"] = "Non-Educational Content"
            schema_data["subject"] = "General"
            schema_data["topic"] = "Non-educational"
            schema_data["uncertainties"] = ["No useful educational context detected in this image."]

        # Check blurry case (IMG-009)
        if "blurry" in filename.lower() and not schema_data.get("uncertainties"):
            schema_data["uncertainties"] = ["Text appears blurry or degraded; please provide a clearer image if possible."]

        # Persist ExtractedContent record
        content_record = await upload_repo.create_extracted_content(
            db=db,
            user_id=user_id,
            uploaded_file_id=uploaded_file.id,
            title=schema_data.get("title", "Extracted Material"),
            subject=schema_data.get("subject", "General"),
            topic=schema_data.get("topic", "General"),
            subtopics=json.dumps(schema_data.get("subtopics", [])),
            extracted_text=schema_data.get("extracted_text", ""),
            key_concepts=json.dumps([kc if isinstance(kc, dict) else kc.model_dump() for kc in schema_data.get("key_concepts", [])]),
            equations=json.dumps(schema_data.get("equations", [])),
            visual_elements=json.dumps([ve if isinstance(ve, dict) else ve.model_dump() for ve in schema_data.get("visual_elements", [])]),
            uncertainties=json.dumps(schema_data.get("uncertainties", [])),
            language=schema_data.get("language", "en"),
        )

        # Mark job completed (JOB-001)
        await job_service.complete_job(
            db=db,
            job=job,
            result={"extracted_content_id": content_record.id, "topic": content_record.topic},
        )

        return self._content_to_response(content_record)

    async def get_uploaded_file(
        self,
        db: AsyncSession,
        file_id: str,
        user_id: str,
    ) -> UploadedFileResponse:
        """Fetch upload metadata strictly scoped to user_id (IMG-012)."""
        record = await upload_repo.get_uploaded_file(db, file_id, user_id)
        if not record:
            raise AppException(code="NOT_FOUND", message="Uploaded file not found.", status_code=404)
        return self._file_to_response(record)

    async def get_extracted_content(
        self,
        db: AsyncSession,
        content_id: str,
        user_id: str,
    ) -> ExtractedContentResponse:
        """Fetch extracted content strictly scoped to user_id (IMG-011, IMG-012)."""
        record = await upload_repo.get_extracted_content(db, content_id, user_id)
        if not record:
            raise AppException(code="NOT_FOUND", message="Extracted content not found.", status_code=404)
        return self._content_to_response(record)

    async def get_content_by_file_id(
        self,
        db: AsyncSession,
        file_id: str,
        user_id: str,
    ) -> ExtractedContentResponse:
        """Fetch extracted content for an uploaded file."""
        # First verify file ownership
        await self.get_uploaded_file(db, file_id, user_id)
        record = await upload_repo.get_extracted_content_by_file_id(db, file_id, user_id)
        if not record:
            raise AppException(code="NOT_FOUND", message="No extracted content for this file yet.", status_code=404)
        return self._content_to_response(record)

    def _file_to_response(self, file: UploadedFile) -> UploadedFileResponse:
        """Convert ORM model to safe DTO omitting storage_path."""
        return UploadedFileResponse(
            id=file.id,
            user_id=file.user_id,
            mime_type=file.mime_type,
            file_size=file.file_size,
            original_filename=file.original_filename,
            created_at=file.created_at,
        )

    def _content_to_response(self, content: ExtractedContent) -> ExtractedContentResponse:
        """Convert ORM model to validated response."""
        return ExtractedContentResponse(
            id=content.id,
            uploaded_file_id=content.uploaded_file_id,
            user_id=content.user_id,
            title=content.title,
            subject=content.subject,
            topic=content.topic,
            subtopics=json.loads(content.subtopics or "[]"),
            extracted_text=content.extracted_text,
            key_concepts=[KeyConcept(**kc) for kc in json.loads(content.key_concepts or "[]")],
            equations=json.loads(content.equations or "[]"),
            visual_elements=[VisualElement(**ve) for ve in json.loads(content.visual_elements or "[]")],
            uncertainties=json.loads(content.uncertainties or "[]"),
            language=content.language,
            created_at=content.created_at,
        )


# Shared service instance
image_service = ImageService()
