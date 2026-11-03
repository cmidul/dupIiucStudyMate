"""Chat repository handling persistence and ownership checks for conversations and messages."""

from typing import List, Optional
from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import Conversation
from app.models.message import Message


class ChatRepository:
    """Repository managing conversations and messages with strict ownership filtering."""

    async def create_conversation(
        self,
        db: AsyncSession,
        user_id: str,
        title: Optional[str] = None,
    ) -> Conversation:
        """Create and persist a new conversation session for a user."""
        conversation = Conversation(
            user_id=user_id,
            title=title.strip() if title and title.strip() else "New Conversation",
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
        return conversation

    async def get_conversation(
        self,
        db: AsyncSession,
        conversation_id: str,
        user_id: str,
        include_messages: bool = True,
    ) -> Optional[Conversation]:
        """Retrieve conversation enforcing strict ownership check."""
        stmt = select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        )
        if include_messages:
            stmt = stmt.options(selectinload(Conversation.messages))

        result = await db.execute(stmt)
        return result.scalars().first()

    async def list_conversations(
        self,
        db: AsyncSession,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Conversation]:
        """List a user's conversations in reverse chronological order."""
        stmt = (
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(desc(Conversation.created_at))
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def delete_conversation(
        self,
        db: AsyncSession,
        conversation_id: str,
        user_id: str,
    ) -> bool:
        """Delete a conversation belonging to user (cascades to messages)."""
        conversation = await self.get_conversation(db, conversation_id, user_id, include_messages=False)
        if not conversation:
            return False

        await db.delete(conversation)
        await db.commit()
        return True

    async def update_title(
        self,
        db: AsyncSession,
        conversation_id: str,
        user_id: str,
        title: str,
    ) -> Optional[Conversation]:
        """Update conversation title."""
        conversation = await self.get_conversation(db, conversation_id, user_id, include_messages=False)
        if not conversation:
            return None
        conversation.title = title.strip()[:255]
        await db.commit()
        await db.refresh(conversation)
        return conversation

    async def add_message(
        self,
        db: AsyncSession,
        conversation_id: str,
        role: str,
        content: str,
        intent: Optional[str] = None,
        subject: Optional[str] = None,
        topic: Optional[str] = None,
        tokens_used: Optional[int] = None,
    ) -> Message:
        """Add and persist a message to a conversation."""
        message = Message(
            conversation_id=conversation_id,
            role=role,
            content=content,
            intent=intent,
            subject=subject,
            topic=topic,
            tokens_used=tokens_used,
        )
        db.add(message)
        await db.commit()
        await db.refresh(message)
        return message

    async def get_recent_messages(
        self,
        db: AsyncSession,
        conversation_id: str,
        limit: int = 10,
    ) -> List[Message]:
        """Get the most recent messages for a conversation ordered oldest-to-newest for context."""
        stmt = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(desc(Message.created_at))
            .limit(limit)
        )
        result = await db.execute(stmt)
        messages = list(result.scalars().all())
        messages.reverse()  # Return in chronological order
        return messages


chat_repo = ChatRepository()

