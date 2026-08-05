"""Refresh official FPL cache resources from a controlled runtime job."""

from __future__ import annotations

import json

from cdl_api.contracts.fpl_data import FplRefreshResource
from cdl_api.database import build_session_factory
from cdl_api.fpl_client import FplApiClient
from cdl_api.repositories.postgres_fpl_data import PostgreSQLFplDataRepository
from cdl_api.services.fpl_data_service import FplDataService
from cdl_api.settings import Settings


def main() -> None:
    settings = Settings()
    if settings.repository_mode != "postgres":
        raise RuntimeError("Official FPL refresh requires PostgreSQL repository mode.")

    service = FplDataService(
        FplApiClient(
            base_url=settings.fpl_api_base_url,
            timeout_seconds=settings.fpl_api_timeout_seconds,
        ),
        PostgreSQLFplDataRepository(build_session_factory(settings)),
    )
    refresh = service.refresh(list(FplRefreshResource))
    status = service.status()

    required_counts = ("teams", "players", "fixtures")
    empty_resources = [
        resource for resource in required_counts if status.normalized_counts.get(resource, 0) <= 0
    ]
    if empty_resources:
        raise RuntimeError(
            "Official FPL refresh produced empty normalized resources: "
            + ", ".join(empty_resources)
        )

    failed_resources = [
        resource.resource.value
        for resource in status.resources
        if resource.last_updated_at is None or resource.last_fetch_error is not None
    ]
    if failed_resources:
        raise RuntimeError(
            "Official FPL refresh did not establish fresh successful resources: "
            + ", ".join(failed_resources)
        )

    print(
        json.dumps(
            {
                "refresh": refresh.model_dump(mode="json"),
                "status": status.model_dump(mode="json"),
            },
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
