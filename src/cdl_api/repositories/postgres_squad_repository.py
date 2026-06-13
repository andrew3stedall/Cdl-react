"""PostgreSQL-backed squad repository runtime."""

from cdl_api.repositories.squad import InMemorySquadRepository


class PostgreSQLSquadRepository(InMemorySquadRepository):
    def seed_demo_data(self) -> None:
        return None
