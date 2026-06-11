from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.postgres_auth import (
    PostgreSQLSessionRepository,
    PostgreSQLUserRepository,
    metadata,
)


def build_session_factory() -> sessionmaker[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_postgres_user_repository_seeds_and_reads_demo_user() -> None:
    session_factory = build_session_factory()
    repository = PostgreSQLUserRepository(session_factory)

    repository.seed_demo_user()
    user = repository.get_by_email("manager@example.com")

    assert user is not None
    assert user.id == "user-1"
    assert user.email == "manager@example.com"
    assert user.roles == ["manager"]


def test_postgres_session_repository_persists_and_deletes_session() -> None:
    session_factory = build_session_factory()
    PostgreSQLUserRepository(session_factory).seed_demo_user()
    repository = PostgreSQLSessionRepository(session_factory)

    session_id = repository.create(
        SessionUser(
            id="user-1",
            email="manager@example.com",
            display_name="Demo Manager",
            roles=["manager"],
        )
    )

    session = repository.get(session_id)
    assert session is not None
    assert session.email == "manager@example.com"

    repository.delete(session_id)
    assert repository.get(session_id) is None
