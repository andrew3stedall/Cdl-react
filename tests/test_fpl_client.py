import pytest
import requests

from cdl_api.fpl_client import FplApiClient, FplApiError


class FakeResponse:
    def __init__(self, payload: object, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError("upstream failure")

    def json(self) -> object:
        return self._payload


class FakeSession:
    def __init__(self, responses: dict[str, FakeResponse]) -> None:
        self.responses = responses
        self.requests: list[tuple[str, float]] = []

    def get(self, endpoint: str, *, headers: dict[str, str], timeout: float) -> FakeResponse:
        assert headers["Accept"] == "application/json"
        self.requests.append((endpoint, timeout))
        return self.responses[endpoint]


def test_client_fetches_bound_endpoints_with_timeout() -> None:
    base_url = "https://fantasy.premierleague.com/api"
    session = FakeSession(
        {
            f"{base_url}/bootstrap-static/": FakeResponse(
                {"events": [], "teams": [], "elements": [], "element_types": []}
            ),
            f"{base_url}/fixtures/": FakeResponse([]),
        }
    )
    client = FplApiClient(base_url, 12.5, session=session)  # type: ignore[arg-type]

    bootstrap = client.fetch_bootstrap_static()
    fixtures = client.fetch_fixtures()

    assert bootstrap.status_code == 200
    assert fixtures.payload == []
    assert session.requests == [
        (f"{base_url}/bootstrap-static/", 12.5),
        (f"{base_url}/fixtures/", 12.5),
    ]


def test_client_fails_closed_for_invalid_bootstrap_shape() -> None:
    endpoint = "https://fantasy.premierleague.com/api/bootstrap-static/"
    client = FplApiClient(
        "https://fantasy.premierleague.com/api",
        10,
        session=FakeSession({endpoint: FakeResponse({"events": []})}),  # type: ignore[arg-type]
    )

    with pytest.raises(FplApiError, match="missing list field"):
        client.fetch_bootstrap_static()
