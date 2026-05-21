"""Base repository contracts for data access."""

from typing import Protocol, TypeVar

EntityT = TypeVar("EntityT")


class Repository(Protocol[EntityT]):
    def get_by_id(self, entity_id: str) -> EntityT | None:
        """Return one entity by identifier."""
