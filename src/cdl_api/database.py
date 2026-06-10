"""Database engine and session helpers."""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.settings import Settings


def build_engine(settings: Settings) -> Engine:
    if not settings.database_url:
        msg = "CDL_DATABASE_URL must be set when repository_mode is postgres."
        raise ValueError(msg)

    return create_engine(
        settings.database_url,
        pool_size=settings.database_pool_size,
        max_overflow=settings.database_max_overflow,
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
