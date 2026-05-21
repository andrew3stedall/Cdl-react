"""Base service contracts for domain workflows."""

from typing import Protocol, TypeVar

RequestT = TypeVar("RequestT")
ResponseT = TypeVar("ResponseT")


class Service(Protocol[RequestT, ResponseT]):
    def execute(self, request: RequestT) -> ResponseT:
        """Execute a domain use case."""
