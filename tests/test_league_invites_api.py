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
    response = _client(commissioner, repository).post(
        "/api/league/management/invites",
        json={"team_id": "castle"},
    )

    assert response.status_code == 200
    assert response.json()["token"]
    assert response.json()["team_id"] == "castle"
    assert response.json()["team_name"] == "Castle United"
    assert response.json()["available_team_count"] == 4


def test_invite_preview_and_accept_assign_the_target_team_idempotently() -> None:
    repository = InMemoryLeagueMembershipRepository()
    commissioner = SessionUser(
        id="commissioner-1",
        email="commissioner@example.com",
        display_name="Commissioner",
        roles=["commissioner"],
    )
    invite_response = _client(commissioner, repository).post(
        "/api/league/management/invites",
        json={"team_id": "wildcards"},
    )
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
    assert preview.json()["team_id"] == "wildcards"
    assert preview.json()["team_name"] == "Wildcard Athletic"
    assert joined.status_code == 200
    assert joined.json()["already_member"] is False
    assert joined.json()["team_name"] == "Wildcard Athletic"
    assert joined_again.status_code == 200
    assert joined_again.json()["already_member"] is True
    assert joined_again.json()["team_id"] == joined.json()["team_id"]


def test_generating_a_new_invite_revokes_the_previous_link_for_that_team() -> None:
    repository = InMemoryLeagueMembershipRepository()
    commissioner = SessionUser(
        id="commissioner-1",
        email="commissioner@example.com",
        display_name="Commissioner",
        roles=["commissioner"],
    )
    client = _client(commissioner, repository)
    first = client.post(
        "/api/league/management/invites",
        json={"team_id": "castle"},
    ).json()["token"]
    second = client.post(
        "/api/league/management/invites",
        json={"team_id": "castle"},
    ).json()["token"]
    other_team = client.post(
        "/api/league/management/invites",
        json={"team_id": "drafton"},
    ).json()["token"]

    assert client.get(f"/api/league/invites/{first}").status_code == 404
    assert client.get(f"/api/league/invites/{second}").status_code == 200
    assert client.get(f"/api/league/invites/{other_team}").status_code == 200


def test_management_lists_active_users_and_their_teams() -> None:
    repository = InMemoryLeagueMembershipRepository()
    commissioner = SessionUser(
        id="commissioner-1",
        email="commissioner@example.com",
        display_name="Commissioner",
        roles=["commissioner"],
    )
    invite = (
        _client(commissioner, repository)
        .post(
            "/api/league/management/invites",
            json={"team_id": "keepers"},
        )
        .json()["token"]
    )
    _client(
        SessionUser(
            id="manager-2",
            email="manager@example.com",
            display_name="New Manager",
            roles=["manager"],
        ),
        repository,
    ).post(f"/api/league/invites/{invite}/accept")

    response = _client(commissioner, repository).get("/api/league/management")

    assert response.status_code == 200
    teams = {team["team_id"]: team for team in response.json()["teams"]}
    assert teams["keepers"] == {
        "team_id": "keepers",
        "team_name": "Keeper City",
        "manager_name": "New Manager",
        "manager_email": "manager@example.com",
        "is_assigned": True,
    }
    assert teams["castle"]["is_assigned"] is False
