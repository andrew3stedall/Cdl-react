"""Database engine and session helpers."""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.settings import Settings


@lru_cache(maxsize=8)
def _build_cached_engine(
    database_url: str,
    pool_size: int,
    max_overflow: int,
    pool_recycle_seconds: int,
) -> Engine:
    """Build one resilient connection pool per runtime database configuration."""
    return create_engine(
        database_url,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_pre_ping=True,
        pool_recycle=pool_recycle_seconds,
    )


def build_engine(settings: Settings) -> Engine:
    if not settings.database_url:
        msg = "CDL_DATABASE_URL must be set when repository_mode is postgres."
        raise ValueError(msg)

    return _build_cached_engine(
        settings.database_url,
        settings.database_pool_size,
        settings.database_max_overflow,
        settings.database_pool_recycle_seconds,
    )


def build_session_factory(settings: Settings) -> sessionmaker[Session]:
    return sessionmaker(bind=build_engine(settings), expire_on_commit=False)


def session_scope(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    session = session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
