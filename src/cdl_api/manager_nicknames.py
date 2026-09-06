"""Canonical manager nicknames used by league-facing surfaces."""

from collections.abc import Mapping

TEAM_MANAGER_NICKNAMES: Mapping[str, str] = {
    "team-stan-still-sells-tik": "Andrew",
    "team-wilde-boars": "DJ",
    "team-bayer-neverlusen": "Kev",
    "team-class-of-84": "Warren",
    "team-sporting-lesbians": "Daniel",
    "team-dicks-dribbling-xi": "Rich",
    "team-koden-all-stars": "Nath",
    "team-exeter-gently": "Dilson",
}

TEAM_NAME_MANAGER_NICKNAMES: Mapping[str, str] = {
    "Stan Still Sells Tik": "Andrew",
    "Wilde Boars": "DJ",
    "Bayer Neverlusen": "Kev",
    "Class of 84": "Warren",
    "Sporting Lesbians": "Daniel",
    "Dicks Dribbling XI": "Rich",
    "Koden All Stars": "Nath",
    "Exeter Gently": "Dilson",
}

# Keep legacy manager labels from leaking when a payload predates nickname
# enrichment and does not contain a canonical team id or name.
LEGACY_MANAGER_NICKNAMES: Mapping[str, str] = {
    "kevin": "Kev",
    "nielsen": "Nath",
    "nilson": "Nath",
    "richard": "Rich",
}


def manager_nickname_for_team(
    team_id: str | None,
    team_name: str | None,
    fallback: str | None = None,
) -> str | None:
    """Return the canonical nickname for a team, with a safe legacy fallback."""
    if team_id:
        nickname = TEAM_MANAGER_NICKNAMES.get(team_id)
        if nickname:
            return nickname
    if team_name:
        nickname = TEAM_NAME_MANAGER_NICKNAMES.get(team_name)
        if nickname:
            return nickname
    if fallback:
        return LEGACY_MANAGER_NICKNAMES.get(fallback.casefold(), fallback)
    return None
