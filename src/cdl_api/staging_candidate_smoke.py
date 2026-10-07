"""Authenticated no-traffic staging candidate smoke.

The release workflow uses an existing seeded staging reviewer and writes the exact
lineup it just read. This exercises authenticated PostgreSQL read/write/reload
behavior without leaving a manager's team changed.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from urllib.parse import urljoin

import requests


class CandidateSmokeError(RuntimeError):
    """Raised when the candidate cannot prove the authenticated release contract."""


def _read_first_email(path: Path) -> str:
    emails = [
        item.strip()
        for item in path.read_text(encoding="utf-8").split(",")
        if item.strip()
    ]
    if not emails or "@" not in emails[0]:
        raise CandidateSmokeError("Candidate smoke reviewer allowlist is empty or invalid.")
    return emails[0]


def _read_password(path: Path) -> str:
    password = path.read_text(encoding="utf-8").strip()
    if not password:
        raise CandidateSmokeError("Candidate smoke login secret is empty.")
    return password


def _request_json(
    session: requests.Session,
    base_url: str,
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, object] | None = None,
) -> dict[str, object]:
    url = urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
    try:
        response = session.request(
            method,
            url,
            json=payload,
            headers={"Accept": "application/json"},
            timeout=30,
        )
    except requests.RequestException as exc:
        raise CandidateSmokeError(f"{method} {path} could not reach the candidate.") from exc

    if response.status_code != 200:
        raise CandidateSmokeError(f"{method} {path} returned HTTP {response.status_code}.")
    decoded = response.json()
    if not isinstance(decoded, dict):
        raise CandidateSmokeError(f"{method} {path} returned a non-object response.")
    return decoded


def lineup_write_payload(snapshot: dict[str, object]) -> dict[str, object]:
    lineup = snapshot.get("lineup")
    chips = snapshot.get("chips")
    if not isinstance(lineup, list) or len(lineup) != 20:
        raise CandidateSmokeError(
            "Candidate team selection must contain the current 20-player squad."
        )
    if not isinstance(chips, list) or len(chips) != 5:
        raise CandidateSmokeError(
            "Candidate team selection must contain the current five-chip contract."
        )

    players: list[dict[str, object]] = []
    for item in lineup:
        if not isinstance(item, dict) or not item.get("id"):
            raise CandidateSmokeError("Candidate lineup contains an invalid player row.")
        players.append(
            {
                "player_id": item["id"],
                "slot": item["slot"],
                "slot_order": item["slot_order"],
                "is_captain": bool(item["is_captain"]),
                "is_vice_captain": bool(item["is_vice_captain"]),
            }
        )
    return {"players": players}


def _lineup_state(snapshot: dict[str, object]) -> tuple[tuple[object, ...], ...]:
    lineup = snapshot.get("lineup")
    if not isinstance(lineup, list):
        raise CandidateSmokeError("Candidate team-selection response has no lineup.")
    return tuple(
        sorted(
            (
                item["id"],
                item["slot"],
                item["slot_order"],
                bool(item["is_captain"]),
                bool(item["is_vice_captain"]),
            )
            for item in lineup
        )
    )


def run_candidate_smoke(base_url: str, email: str, password: str) -> None:
    session = requests.Session()
    logged_in = False
    try:
        login = _request_json(
            session,
            base_url,
            "/api/auth/login",
            method="POST",
            payload={"email": email, "password": password},
        )
        session_state = login.get("session")
        if (
            not isinstance(session_state, dict)
            or session_state.get("is_authenticated") is not True
        ):
            raise CandidateSmokeError(
                "Candidate staging login did not create an authenticated session."
            )
        logged_in = True

        before = _request_json(session, base_url, "/api/team-selection")
        manager_team = before.get("manager_team")
        if not isinstance(manager_team, dict) or not manager_team.get("id"):
            raise CandidateSmokeError("Candidate staging reviewer has no assigned manager team.")
        before_state = _lineup_state(before)

        payload = lineup_write_payload(before)
        saved = _request_json(
            session,
            base_url,
            "/api/team-selection/lineup",
            method="PUT",
            payload=payload,
        )
        if _lineup_state(saved) != before_state:
            raise CandidateSmokeError("Candidate no-op lineup write changed the saved lineup.")

        reloaded = _request_json(session, base_url, "/api/team-selection")
        reloaded_team = reloaded.get("manager_team")
        if not isinstance(reloaded_team, dict) or reloaded_team.get("id") != manager_team["id"]:
            raise CandidateSmokeError("Candidate reload changed the authenticated manager team.")
        if _lineup_state(reloaded) != before_state:
            raise CandidateSmokeError("Candidate lineup changed after authenticated write/reload.")
    finally:
        if logged_in:
            _request_json(session, base_url, "/api/auth/logout", method="POST", payload={})
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--reviewer-emails-file", required=True, type=Path)
    parser.add_argument("--login-secret-file", required=True, type=Path)
    args = parser.parse_args()

    run_candidate_smoke(
        args.base_url,
        _read_first_email(args.reviewer_emails_file),
        _read_password(args.login_secret_file),
    )
    print("Authenticated candidate read/write/reload smoke passed.")


if __name__ == "__main__":
    main()
