"""HTTP client for the official Fantasy Premier League data endpoints."""

from dataclasses import dataclass

import requests


class FplApiError(RuntimeError):
    """Raised when the official FPL API cannot return a valid payload."""


@dataclass(frozen=True)
class FplApiResponse:
    endpoint: str
    payload: dict[str, object] | list[dict[str, object]]
    status_code: int


class FplApiClient:
    """Small, timeout-bound client for public FPL JSON endpoints."""

    def __init__(
        self,
        base_url: str,
        timeout_seconds: float,
        session: requests.Session | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds
        self._session = session or requests.Session()

    def endpoint_for(self, path: str) -> str:
        return f"{self._base_url}/{path.lstrip('/')}"

    def fetch_bootstrap_static(self) -> FplApiResponse:
        response = self._get("bootstrap-static/")
        if not isinstance(response.payload, dict):
            raise FplApiError("FPL bootstrap-static returned a non-object payload.")
        for key in ("events", "teams", "elements", "element_types"):
            if not isinstance(response.payload.get(key), list):
                raise FplApiError(f"FPL bootstrap-static is missing list field {key!r}.")
        return response

    def fetch_fixtures(self) -> FplApiResponse:
        response = self._get("fixtures/")
        if not isinstance(response.payload, list):
            raise FplApiError("FPL fixtures returned a non-list payload.")
        return response

    def fetch_element_summary(self, player_id: int) -> FplApiResponse:
        response = self._get(f"element-summary/{player_id}/")
        if not isinstance(response.payload, dict):
            raise FplApiError("FPL element-summary returned a non-object payload.")
        for key in ("history", "fixtures"):
            if not isinstance(response.payload.get(key), list):
                raise FplApiError(f"FPL element-summary is missing list field {key!r}.")
        return response

    def _get(self, path: str) -> FplApiResponse:
        endpoint = self.endpoint_for(path)
        try:
            response = self._session.get(
                endpoint,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "CastleDraftLeague/0.1 FPL cache",
                },
                timeout=self._timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise FplApiError(f"Unable to fetch valid FPL data from {endpoint}.") from exc

        return FplApiResponse(
            endpoint=endpoint,
            payload=payload,
            status_code=response.status_code,
        )
