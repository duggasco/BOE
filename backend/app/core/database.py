"""
Database configuration and session management
Using SQLAlchemy with async support
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from app.core.config import settings

# Create async engine
engine = create_async_engine(
    str(settings.DATABASE_URL),
    echo=settings.DEBUG,
    future=True,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True,  # Verify connections before using
    poolclass=NullPool if settings.DEBUG else None,  # Disable pooling in debug mode
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# Create declarative base for models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting database session
    Used with FastAPI's Depends()
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()