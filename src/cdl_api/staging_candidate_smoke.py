"""Authenticated no-traffic staging candidate smoke.

The release workflow uses an existing seeded staging reviewer and writes the exact
lineup it just read. This exercises authenticated PostgreSQL read/write/reload
behavior without leaving a manager's team changed.
"""

from __future__ import annotations

import argparse
import json
from http.cookiejar import CookieJar
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import HTTPCookieProcessor, Request, build_opener


class CandidateSmokeError(RuntimeError):
    """Raised when the candidate cannot prove the authenticated release contract."""


def _read_first_email(path: Path) -> str:
    emails = [item.strip() for item in path.read_text(encoding="utf-8").split(",") if item.strip()]
    if not emails or "@" not in emails[0]:
        raise CandidateSmokeError("Candidate smoke reviewer allowlist is empty or invalid.")
    return emails[0]


def _read_password(path: Path) -> str:
    password = path.read_text(encoding="utf-8").strip()
    if not password:
        raise CandidateSmokeError("Candidate smoke login secret is empty.")
    return password


def _request_json(
    opener: Any,
    base_url: str,
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        urljoin(base_url.rstrip("/") + "/", path.lstrip("/")),
        data=body,
        method=method,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    )
    try:
        with opener.open(request, timeout=30) as response:
            if response.status != 200:
                raise CandidateSmokeError(f"{method} {path} returned HTTP {response.status}.")
            decoded = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise CandidateSmokeError(f"{method} {path} returned HTTP {exc.code}.") from None
    except URLError as exc:
        raise CandidateSmokeError(f"{method} {path} could not reach the candidate.") from exc

    if not isinstance(decoded, dict):
        raise CandidateSmokeError(f"{method} {path} returned a non-object response.")
    return decoded


def lineup_write_payload(snapshot: dict[str, Any]) -> dict[str, Any]:
    lineup = snapshot.get("lineup")
    chips = snapshot.get("chips")
    if not isinstance(lineup, list) or len(lineup) != 20:
        raise CandidateSmokeError("Candidate team selection must contain the current 20-player squad.")
    if not isinstance(chips, list) or len(chips) != 5:
        raise CandidateSmokeError("Candidate team selection must contain the current five-chip contract.")

    players: list[dict[str, Any]] = []
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


def _lineup_state(snapshot: dict[str, Any]) -> tuple[tuple[Any, ...], ...]:
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
    opener = build_opener(HTTPCookieProcessor(CookieJar()))
    logged_in = False
    try:
        login = _request_json(
            opener,
            base_url,
            "/api/auth/login",
            method="POST",
            payload={"email": email, "password": password},
        )
        session = login.get("session")
        if not isinstance(session, dict) or session.get("is_authenticated") is not True:
            raise CandidateSmokeError("Candidate staging login did not create an authenticated session.")
        logged_in = True

        before = _request_json(opener, base_url, "/api/team-selection")
        manager_team = before.get("manager_team")
        if not isinstance(manager_team, dict) or not manager_team.get("id"):
            raise CandidateSmokeError("Candidate staging reviewer has no assigned manager team.")
        before_state = _lineup_state(before)

        payload = lineup_write_payload(before)
        saved = _request_json(
            opener,
            base_url,
            "/api/team-selection/lineup",
            method="PUT",
            payload=payload,
        )
        if _lineup_state(saved) != before_state:
            raise CandidateSmokeError("Candidate no-op lineup write changed the saved lineup.")

        reloaded = _request_json(opener, base_url, "/api/team-selection")
        reloaded_team = reloaded.get("manager_team")
        if not isinstance(reloaded_team, dict) or reloaded_team.get("id") != manager_team["id"]:
            raise CandidateSmokeError("Candidate reload changed the authenticated manager team.")
        if _lineup_state(reloaded) != before_state:
            raise CandidateSmokeError("Candidate lineup changed after authenticated write/reload.")
    finally:
        if logged_in:
            _request_json(opener, base_url, "/api/auth/logout", method="POST", payload={})


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
