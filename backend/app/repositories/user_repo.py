"""User repository for persistence operations with explicit ownership filtering."""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    """Repository handling database queries for User entities."""

    async def get_by_id(self, db: AsyncSession, user_id: str) -> Optional[User]:
        """Find user by unique primary key."""
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Find user by email address (case-insensitive)."""
        stmt = select(User).where(User.email == email.strip().lower())
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_by_telegram_id(self, db: AsyncSession, telegram_id: str) -> Optional[User]:
        """Find user by linked Telegram ID."""
        stmt = select(User).where(User.telegram_id == str(telegram_id))
        result = await db.execute(stmt)
        return result.scalars().first()

    async def create(
        self,
        db: AsyncSession,
        email: str,
        hashed_password: str,
        name: Optional[str] = None,
    ) -> User:
        """Create and persist a new user."""
        user = User(
            email=email.strip().lower(),
            hashed_password=hashed_password,
            name=name.strip() if name else None,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def update_telegram_id(
        self,
        db: AsyncSession,
        user_id: str,
        telegram_id: Optional[str],
    ) -> Optional[User]:
        """Link or unlink a Telegram identity."""
        user = await self.get_by_id(db, user_id)
        if not user:
            return None
        user.telegram_id = telegram_id
        await db.commit()
        await db.refresh(user)
        return user


user_repo = UserRepository()

