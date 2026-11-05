"""Pytest configuration and async test fixtures.

Provides an isolated in-memory SQLite database and async test client.
"""

from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.config import settings
from app.core.quota import quota_manager
from app.core.rate_limit import rate_limiter
from app.main import app

# Isolated in-memory SQLite database for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(autouse=True)
def use_offline_services(monkeypatch):
    """Keep regular tests independent of local credentials and external APIs."""
    monkeypatch.setattr(settings, "AI_DEFAULT_PROVIDER", "mock")
    monkeypatch.setattr(settings, "AI_FALLBACK_PROVIDER", "")
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", None)
    monkeypatch.setattr(settings, "TELEGRAM_BOT_SECRET", "dev-telegram-bot-secret")
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", None)

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    future=True,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Create all tables in memory before each test and drop them after."""
    rate_limiter.reset()
    quota_manager.reset()
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    rate_limiter.reset()
    quota_manager.reset()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an isolated test database session."""
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide an AsyncClient wired with the test database."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()
