from fastapi.testclient import TestClient

from cdl_api.app import create_app
from cdl_api.contracts.session import SessionUser
from cdl_api.repositories.league_memberships import InMemoryLeagueMembershipRepository
from cdl_api.routers.auth import require_authenticated_session
from cdl_api.routers.league import get_membership_repository


def _client(
    user: SessionUser,
    repository: InMemoryLeagueMembershipRepository,
) -> TestClient:
    app = create_app()
    app.dependency_overrides[require_authenticated_session] = lambda: user
    app.dependency_overrides[get_membership_repository] = lambda: repository
    return TestClient(app)


def test_only_commissioners_can_create_invites() -> None:
    repository = InMemoryLeagueMembershipRepository()
    manager = SessionUser(
        id="manager-2",
        email="manager@example.com",
        display_name="Manager",
        roles=["manager"],
    )
    commissioner = SessionUser(
        id="commissioner-1",
        email="commissioner@example.com",
        display_name="Commissioner",
        roles=["manager", "commissioner"],
    )

    assert _client(manager, repository).get("/api/league/management").status_code == 403
    response = _client(commissioner, repository).post("/api/league/management/invites")

    assert response.status_code == 200
    assert response.json()["token"]
    assert response.json()["available_team_count"] == 4


def test_invite_preview_and_accept_assign_an_open_team_idempotently() -> None:
    repository = InMemoryLeagueMembershipRepository()
    commissioner = SessionUser(
        id="commissioner-1",
        email="commissioner@example.com",
        display_name="Commissioner",
        roles=["commissioner"],
    )
    invite_response = _client(commissioner, repository).post("/api/league/management/invites")
    token = invite_response.json()["token"]

    preview = _client(commissioner, repository).get(f"/api/league/invites/{token}")
    joined = _client(
        SessionUser(
            id="manager-2",
            email="manager@example.com",
            display_name="Manager",
            roles=["manager"],
        ),
        repository,
    ).post(f"/api/league/invites/{token}/accept")
    joined_again = _client(
        SessionUser(
            id="manager-2",
            email="manager@example.com",
            display_name="Manager",
            roles=["manager"],
        ),
        repository,
    ).post(f"/api/league/invites/{token}/accept")

    assert preview.status_code == 200
    assert preview.json()["available_team_count"] == 4
    assert joined.status_code == 200
    assert joined.json()["already_member"] is False
    assert joined.json()["team_name"] == "Castle United"
    assert joined_again.status_code == 200
    assert joined_again.json()["already_member"] is True
    assert joined_again.json()["team_id"] == joined.json()["team_id"]


def test_generating_a_new_invite_revokes_the_previous_link() -> None:
    repository = InMemoryLeagueMembershipRepository()
    commissioner = SessionUser(
        id="commissioner-1",
        email="commissioner@example.com",
        display_name="Commissioner",
        roles=["commissioner"],
    )
    client = _client(commissioner, repository)
    first = client.post("/api/league/management/invites").json()["token"]
    second = client.post("/api/league/management/invites").json()["token"]

    assert client.get(f"/api/league/invites/{first}").status_code == 404
    assert client.get(f"/api/league/invites/{second}").status_code == 200
