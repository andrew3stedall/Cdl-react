"""PostgreSQL-backed squad repository runtime."""

from cdl_api.repositories.squad import InMemorySquadRepository


class PostgreSQLSquadRepository(InMemorySquadRepository):
    """Temporary runtime shell for issue #65 follow-up."""
