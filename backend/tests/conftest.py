import asyncio
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import get_db
from app.main import app as fastapi_app
from app.models.base import Base

# Base de données SQLite en mémoire pour les tests unitaires
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)

# Patch les session factories des workers pour utiliser la base SQLite de test
import app.workers.webhook_processor
import app.workers.print_queue_worker
app.workers.webhook_processor.AsyncSessionLocal = TestingSessionLocal
app.workers.print_queue_worker.AsyncSessionLocal = TestingSessionLocal


@pytest.fixture(scope="session")
def event_loop():
    """Garantit l'utilisation d'une seule boucle d'événements pour toute la session de test."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def initialize_db():
    """Crée les tables avant les tests et les supprime après."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Fournit une session de base de données propre pour chaque test (avec rollback automatique)."""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Fournit un client HTTP async de test configuré avec la db mockée."""
    async def override_get_db():
        try:
            yield db
            # Pas de commit automatique pendant les tests pour garder la db propre
        except Exception:
            await db.rollback()
            raise

    fastapi_app.dependency_overrides[get_db] = override_get_db

    # Utilisation d'ASGITransport pour httpx >= 0.28
    async with AsyncClient(
        transport=ASGITransport(app=fastapi_app), base_url="http://test"
    ) as ac:
        yield ac

    fastapi_app.dependency_overrides.clear()
