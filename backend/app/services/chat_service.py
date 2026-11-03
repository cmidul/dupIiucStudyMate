"""Chat service orchestrating conversations, context windows, and learning QA."""

import logging
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.router import ai_router
from app.ai.schemas import TextGenerationRequest
from app.core.quota import quota_manager
from app.core.responses import AppException
from app.models.conversation import Conversation
from app.models.message import Message
from app.repositories.chat_repo import chat_repo
from app.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    ConversationDetailResponse,
    ConversationResponse,
    MessageResponse,
)
from app.services.topic_detector import topic_detector

logger = logging.getLogger("learning_assistant.chat_service")


class ChatService:
    """Service handling conversation management and AI chat interactions."""

    async def send_message(
        self,
        db: AsyncSession,
        user_id: str,
        data: ChatMessageRequest,
    ) -> ChatMessageResponse:
        """Process a user question, classify intent, assemble context, and return an answer."""
        content = data.message.strip()
        if not content:
            raise AppException(
                code="INVALID_INPUT",
                message="Message cannot be empty.",
                status_code=422,
            )
        if len(content) > 8000:
            raise AppException(
                code="INVALID_INPUT",
                message="Message exceeds maximum allowed length of 8000 characters.",
                status_code=422,
            )

        # Check user quota before proceeding with AI processing (F-17, SEC-002)
        quota_manager.check_quota(user_id=user_id, category="ai_chat")

        # 1. Resolve or create conversation with strict ownership check
        conversation: Optional[Conversation] = None
        if data.conversation_id:
            conversation = await chat_repo.get_conversation(
                db=db,
                conversation_id=data.conversation_id,
                user_id=user_id,
                include_messages=False,
            )
            if not conversation:
                raise AppException(
                    code="NOT_FOUND",
                    message="Conversation not found or access denied.",
                    status_code=404,
                )
        else:
            conversation = await chat_repo.create_conversation(db=db, user_id=user_id)

        # 2. Retrieve recent conversation history for context BEFORE saving current message
        prior_messages = await chat_repo.get_recent_messages(db, conversation.id, limit=6)

        # 3. Detect intent and topic
        topic_info = await topic_detector.detect_topic_and_intent(
            message=content,
            recent_messages=prior_messages,
        )

        # 4. Save user message
        user_msg = await chat_repo.add_message(
            db=db,
            conversation_id=conversation.id,
            role="user",
            content=content,
            intent=topic_info.intent,
            subject=topic_info.subject,
            topic=topic_info.topic,
        )

        # 5. Handle ambiguous requests (CHAT-003)
        if topic_info.needs_clarification and topic_info.clarification_question:
            assistant_content = topic_info.clarification_question
            tokens_used = None
        else:
            # 6. Generate answer using conversation context (CHAT-004, CHAT-005)
            assistant_content, tokens_used = await self._generate_assistant_answer(
                user_message=content,
                prior_messages=prior_messages,
                topic_info=topic_info,
            )

        # 7. Save assistant message
        asst_msg = await chat_repo.add_message(
            db=db,
            conversation_id=conversation.id,
            role="assistant",
            content=assistant_content,
            intent=topic_info.intent,
            subject=topic_info.subject,
            topic=topic_info.topic,
            tokens_used=tokens_used,
        )

        # 8. Auto-generate title if this is the first interaction in conversation
        if conversation.title in ("New Conversation", "", None):
            title_candidate = content[:50].strip()
            if len(content) > 50:
                title_candidate += "..."
            await chat_repo.update_title(db, conversation.id, user_id, title_candidate)

        # Record quota usage on successful assistant reply
        quota_manager.record_usage(user_id=user_id, category="ai_chat")

        return ChatMessageResponse(
            conversation_id=conversation.id,
            user_message=MessageResponse.model_validate(user_msg),
            assistant_message=MessageResponse.model_validate(asst_msg),
            topic_metadata=topic_info,
        )

    async def _generate_assistant_answer(
        self,
        user_message: str,
        prior_messages: List[Message],
        topic_info: Any,
    ) -> tuple[str, Optional[int]]:
        """Assemble context and call AI router for response generation."""
        # Build prompt incorporating bounded context
        context_parts = []
        for msg in prior_messages:
            context_parts.append(f"{msg.role.capitalize()}: {msg.content}")

        context_str = "\n".join(context_parts)
        if context_str:
            prompt = (
                f"Previous conversation:\n{context_str}\n\n"
                f"Student question: {user_message}\n\n"
                f"Please provide an accurate, clear educational response."
            )
        else:
            prompt = (
                f"Student question: {user_message}\n\n"
                f"Please provide an accurate, clear educational response."
            )

        system_prompt = (
            "You are an encouraging, highly knowledgeable AI Learning Assistant. "
            "Explain concepts clearly with examples, definitions, and step-by-step clarity. "
            "Maintain context from prior turns in the conversation when answering follow-up questions."
        )

        req = TextGenerationRequest(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=2048,
        )

        res = await ai_router.generate_text(req)
        return res.content, res.tokens_used

    async def list_conversations(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[ConversationResponse]:
        """List conversations owned by the user."""
        conversations = await chat_repo.list_conversations(db, user_id, limit=limit, offset=offset)
        return [ConversationResponse.model_validate(c) for c in conversations]

    async def get_conversation(
        self,
        db: AsyncSession,
        conversation_id: str,
        user_id: str,
    ) -> ConversationDetailResponse:
        """Get conversation and its messages enforcing ownership."""
        conv = await chat_repo.get_conversation(db, conversation_id, user_id, include_messages=True)
        if not conv:
            raise AppException(
                code="NOT_FOUND",
                message="Conversation not found or access denied.",
                status_code=404,
            )
        return ConversationDetailResponse.model_validate(conv)

    async def delete_conversation(
        self,
        db: AsyncSession,
        conversation_id: str,
        user_id: str,
    ) -> None:
        """Delete a conversation enforcing ownership."""
        deleted = await chat_repo.delete_conversation(db, conversation_id, user_id)
        if not deleted:
            raise AppException(
                code="NOT_FOUND",
                message="Conversation not found or access denied.",
                status_code=404,
            )


chat_service = ChatService()

