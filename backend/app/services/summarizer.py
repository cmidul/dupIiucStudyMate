"""Summarization service generating short, detailed, and exam-notes summaries (F-06)."""

import json
import logging
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.router import ai_router
from app.ai.schemas import SummarySchema, TextGenerationRequest
from app.core.responses import AppException
from app.models.summary import Summary
from app.repositories.summary_repo import summary_repo
from app.schemas.summary import SummaryGenerateRequest, SummaryResponse

logger = logging.getLogger("learning_assistant.summarizer")


class SummarizerService:
    """Service producing structured educational summaries."""

    async def generate_summary(
        self,
        db: AsyncSession,
        user_id: str,
        data: SummaryGenerateRequest,
    ) -> SummaryResponse:
        """Generate, validate, and persist a learning summary."""
        source_text = ""
        if data.source_text and data.source_text.strip():
            source_text = data.source_text.strip()
        elif data.source_content_id:
            from app.repositories.upload_repo import upload_repo
            ext_content = await upload_repo.get_extracted_content(db, data.source_content_id, user_id)
            if not ext_content:
                raise AppException(code="NOT_FOUND", message="Source extracted content not found or access denied.", status_code=404)
            source_text = ext_content.extracted_text
        elif data.conversation_id:
            from app.repositories.chat_repo import chat_repo
            conv = await chat_repo.get_conversation(db, data.conversation_id, user_id, include_messages=True)
            if not conv:
                raise AppException(code="NOT_FOUND", message="Conversation not found or access denied.", status_code=404)
            source_text = "\n".join([f"{m.role}: {m.content}" for m in conv.messages])

        if not source_text:
            raise AppException(
                code="INVALID_INPUT",
                message="Source text, source_content_id, or conversation ID is required to generate a summary.",
                status_code=422,
            )

        # Style guidance for prompt
        style_instructions = {
            "short": "Produce a concise high-level overview highlighting only the main core points.",
            "detailed": "Produce an organized, thorough breakdown covering all important sections and key terms.",
            "exam_notes": "Produce structured exam revision notes with definitions, key terms, formulas, and revision points.",
        }
        instruction = style_instructions.get(data.style, style_instructions["exam_notes"])

        # Check for incomplete source (SUM-005)
        is_incomplete = len(source_text) < 40 or "incomplete" in source_text.lower()
        incomplete_note = (
            " NOTE: The source material appears brief or incomplete. Acknowledge this limitation "
            "and do NOT invent unsupported facts."
            if is_incomplete
            else ""
        )

        prompt = (
            f"Generate a structured educational summary in '{data.style}' style.\n"
            f"Style guidance: {instruction}{incomplete_note}\n\n"
            f"Source material:\n{source_text[:6000]}\n\n"
            f"Output strictly matching the required SummarySchema JSON."
        )

        system_prompt = (
            "You are an expert educational summarizer. Preserve factual relationships and equations from source. "
            "Do not fabricate facts not present in the source."
        )

        req = TextGenerationRequest(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.2,
            response_schema=SummarySchema,
        )

        res = await ai_router.generate_text(req)
        if not res.structured_data:
            raise AppException(
                code="INVALID_AI_OUTPUT",
                message="Failed to generate a valid structured summary.",
                status_code=502,
            )

        summary_schema = SummarySchema.model_validate(res.structured_data)
        summary_schema.style = data.style  # Enforce requested style

        # Persist summary
        summary = await summary_repo.create(
            db=db,
            user_id=user_id,
            title=summary_schema.title,
            topic=summary_schema.topic,
            style=data.style,
            overview=summary_schema.overview,
            structured_content=summary_schema.model_dump_json(),
            source_content_id=data.source_content_id,
            conversation_id=data.conversation_id,
        )

        return self._to_response(summary, summary_schema)

    async def get_summary(
        self,
        db: AsyncSession,
        summary_id: str,
        user_id: str,
    ) -> SummaryResponse:
        """Get a summary strictly belonging to user."""
        summary = await summary_repo.get_by_id(db, summary_id, user_id)
        if not summary:
            raise AppException(
                code="NOT_FOUND",
                message="Summary not found or access denied.",
                status_code=404,
            )
        parsed_content = SummarySchema.model_validate_json(summary.structured_content)
        return self._to_response(summary, parsed_content)

    async def list_summaries(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[SummaryResponse]:
        """List summaries belonging to user."""
        summaries = await summary_repo.list_by_user(db, user_id, limit=limit, offset=offset)
        return [
            self._to_response(s, SummarySchema.model_validate_json(s.structured_content))
            for s in summaries
        ]

    async def delete_summary(
        self,
        db: AsyncSession,
        summary_id: str,
        user_id: str,
    ) -> None:
        """Delete summary strictly belonging to user."""
        deleted = await summary_repo.delete(db, summary_id, user_id)
        if not deleted:
            raise AppException(
                code="NOT_FOUND",
                message="Summary not found or access denied.",
                status_code=404,
            )

    def _to_response(self, summary: Summary, content: SummarySchema) -> SummaryResponse:
        return SummaryResponse(
            id=summary.id,
            user_id=summary.user_id,
            source_content_id=summary.source_content_id,
            conversation_id=summary.conversation_id,
            title=summary.title,
            topic=summary.topic,
            style=summary.style,
            overview=summary.overview,
            content=content,
            created_at=summary.created_at,
        )


summarizer_service = SummarizerService()

