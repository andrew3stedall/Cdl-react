"""Apply a screenshot-verified current squad snapshot to staging only."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import MetaData, Table, create_engine, insert, select, update
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

EXPECTED_REPOSITORY = "andrew3stedall/Cdl-react"
EXPECTED_PROJECT = "cdl-react-staging-ast"
EXPECTED_INSTANCE = "cdl-react-staging-ast:australia-southeast1:cdl-react-staging-postgres"
EXPECTED_LEAGUE = "league-cdl-2026-27"
EXPECTED_SEASON = "season-cdl-2026-27"
CONFIRMATION = "APPLY CASTLE ROSTER SNAPSHOT TO STAGING"
TEAM_IDS = {
    "team-bayer-neverlusen",
    "team-dicks-dribbling-xi",
    "team-exeter-gently",
    "team-koden-all-stars",
    "team-sporting-lesbians",
    "team-stan-still-sells-tik",
    "team-class-of-84",
    "team-wilde-boars",
}
POSITION_LIMITS = {
    "GKP": (2, 3),
    "DEF": (4, 10),
    "MID": (5, 10),
    "FWD": (2, 4),
}


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(char for char in decomposed if char.isalnum())


def database_url(secret_value: str) -> str:
    url = make_url(secret_value)
    if (
        url.drivername != "postgresql+psycopg"
        or url.database != "cdl_react"
        or url.username != "cdl_app"
        or url.query.get("host") != f"/cloudsql/{EXPECTED_INSTANCE}"
    ):
        raise ValueError("Database secret is outside the expected staging boundary")
    return (
        url.difference_update_query(["host"])
        .set(host="127.0.0.1", port=5433)
        .render_as_string(hide_password=False)
    )


def guard_environment() -> None:
    if (
        os.environ.get("GITHUB_REF") != "refs/heads/main"
        or os.environ.get("GITHUB_REPOSITORY") != EXPECTED_REPOSITORY
        or os.environ.get("PROJECT_ID") != EXPECTED_PROJECT
    ):
        raise ValueError("Roster reconciliation requires the trusted staging Actions context")


def load_snapshot(path: Path) -> tuple[dict, datetime]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if (
        data.get("version") != 1
        or data.get("league_id") != EXPECTED_LEAGUE
        or data.get("season_id") != EXPECTED_SEASON
        or data.get("source") != "Castle app screenshots supplied by the league commissioner"
    ):
        raise ValueError("Roster snapshot binding is invalid")
    as_of = datetime.fromisoformat(data["as_of"]).replace(tzinfo=UTC)
    teams = data.get("teams")
    if set(teams or {}) != TEAM_IDS:
        raise ValueError("Snapshot must contain exactly the eight staging teams")

    seen: set[tuple[str, str, str]] = set()
    for team_id, players in teams.items():
        if len(players) != 20:
            raise ValueError(f"Snapshot team {team_id} must contain exactly 20 players")
        counts: Counter[str] = Counter()
        for player in players:
            if player.get("position") not in POSITION_LIMITS:
                raise ValueError("Snapshot contains an invalid position")
            if not player.get("name") or not re.fullmatch(r"[A-Z]{3}", player.get("club", "")):
                raise ValueError("Snapshot contains an invalid player identity")
            key = (normalize(player["name"]), player["position"], player["club"])
            if key in seen:
                raise ValueError("Snapshot assigns a player more than once")
            seen.add(key)
            counts[player["position"]] += 1
        for position, (minimum, maximum) in POSITION_LIMITS.items():
            if not minimum <= counts[position] <= maximum:
                raise ValueError(f"Snapshot team {team_id} has an invalid {position} count")
    return teams, as_of


def resolve_players(session: Session, metadata: MetaData, teams: dict) -> dict[str, list[dict]]:
    players_table = Table("fpl_players", metadata, autoload_with=session.connection())
    epl_teams_table = Table("epl_teams", metadata, autoload_with=session.connection())
    # Load position and club alongside the name fields so every match is exact
    # to the screenshot's position and Premier League team.
    statement = select(
        players_table.c.id,
        players_table.c.web_name,
        players_table.c.first_name,
        players_table.c.second_name,
        players_table.c.position_id,
        epl_teams_table.c.short_name,
    ).select_from(
        players_table.join(
            epl_teams_table,
            players_table.c.team_id == epl_teams_table.c.id,
        )
    )
    available = session.execute(statement).mappings().all()
    resolved: dict[str, list[dict]] = {}
    failures: list[str] = []
    for team_id, roster in teams.items():
        resolved[team_id] = []
        for item in roster:
            target_names = {normalize(item["name"])}
            target_names.update(normalize(alias) for alias in item.get("aliases", []))
            candidates = []
            for row in available:
                if row["position_id"] != item["position"] or row["short_name"] != item["club"]:
                    continue
                names = {
                    normalize(str(row.get("web_name") or "")),
                    normalize(str(row.get("second_name") or "")),
                    normalize(
                        " ".join(
                            part
                            for part in (
                                str(row.get("first_name") or ""),
                                str(row.get("second_name") or ""),
                            )
                            if part
                        )
                    ),
                }
                names.discard("")
                if target_names.intersection(names):
                    candidates.append(row)
            if len(candidates) != 1:
                failures.append(
                    f"{team_id}:{item['position']}:{item['club']}:{item['name']} "
                    f"matched {len(candidates)} cached players"
                )
                continue
            resolved[team_id].append({**item, "player_id": candidates[0]["id"]})
    ids = [item["player_id"] for roster in resolved.values() for item in roster]
    if failures:
        raise ValueError("Player identity review required: " + "; ".join(failures))
    if len(ids) != 160 or len(set(ids)) != 160:
        raise ValueError("Resolved snapshot does not contain 160 unique cached players")
    return resolved


def reconcile(session: Session, snapshot: Path) -> dict:
    metadata = MetaData()
    teams, as_of = load_snapshot(snapshot)
    seasons = Table("seasons", metadata, autoload_with=session.connection())
    draft_teams = Table("draft_teams", metadata, autoload_with=session.connection())
    ownerships = Table("squad_ownerships", metadata, autoload_with=session.connection())
    slots = Table("squad_roster_slots", metadata, autoload_with=session.connection())
    audit = Table("squad_audit_events", metadata, autoload_with=session.connection())

    season = (
        session.execute(
            select(seasons.c.id, seasons.c.league_id).where(seasons.c.id == EXPECTED_SEASON)
        )
        .mappings()
        .one_or_none()
    )
    if season is None or season["league_id"] != EXPECTED_LEAGUE:
        raise ValueError("Expected staging season is missing or bound to another league")
    existing_teams = set(
        session.execute(
            select(draft_teams.c.id).where(draft_teams.c.league_id == EXPECTED_LEAGUE)
        ).scalars()
    )
    if existing_teams != TEAM_IDS:
        raise ValueError("Staging team set differs from the reviewed snapshot")

    slot_rows = (
        session.execute(
            select(slots.c.id, slots.c.draft_team_id, slots.c.sort_order)
            .where(slots.c.season_id == EXPECTED_SEASON)
            .order_by(slots.c.draft_team_id, slots.c.sort_order)
        )
        .mappings()
        .all()
    )
    slot_ids: dict[str, list[str]] = defaultdict(list)
    for row in slot_rows:
        slot_ids[row["draft_team_id"]].append(row["id"])
    if set(slot_ids) != TEAM_IDS or any(len(slot_ids[team_id]) < 20 for team_id in TEAM_IDS):
        raise ValueError("Each staging team must have 20 existing roster slots")

    resolved = resolve_players(session, metadata, teams)
    expected_by_id = {
        item["player_id"]: (team_id, order, item)
        for team_id, roster in resolved.items()
        for order, item in enumerate(roster, start=1)
    }
    current_rows = (
        session.execute(
            select(
                ownerships.c.id,
                ownerships.c.player_id,
                ownerships.c.draft_team_id,
                ownerships.c.roster_slot_id,
                ownerships.c.started_at,
            ).where(
                ownerships.c.season_id == EXPECTED_SEASON,
                ownerships.c.ended_at.is_(None),
            )
        )
        .mappings()
        .all()
    )
    current_by_player: dict[str, list[dict]] = defaultdict(list)
    for row in current_rows:
        current_by_player[row["player_id"]].append(dict(row))
    duplicates = [player_id for player_id, rows in current_by_player.items() if len(rows) > 1]
    if duplicates:
        raise ValueError(
            f"Staging has {len(duplicates)} players with multiple current ownership rows"
        )

    for rows in current_by_player.values():
        row = rows[0]
        started_at = row["started_at"]
        if started_at and started_at.replace(tzinfo=started_at.tzinfo or UTC) > as_of:
            raise ValueError("A current ownership begins after the screenshot snapshot date")

    now = datetime.now(UTC)
    changed: list[dict] = []
    added = 0
    ended = 0
    for player_id, rows in current_by_player.items():
        if player_id not in expected_by_id:
            row = rows[0]
            session.execute(
                update(ownerships)
                .where(ownerships.c.id == row["id"])
                .values(ended_at=as_of, roster_slot_id=None)
            )
            changed.append(
                {
                    "player_id": player_id,
                    "from_team": row["draft_team_id"],
                    "to_team": None,
                    "change": "ended",
                }
            )
            ended += 1

    for player_id, (team_id, order, _item) in expected_by_id.items():
        slot_id = slot_ids[team_id][order - 1]
        rows = current_by_player.get(player_id, [])
        if rows:
            row = rows[0]
            if row["draft_team_id"] != team_id or row["roster_slot_id"] != slot_id:
                session.execute(
                    update(ownerships)
                    .where(ownerships.c.id == row["id"])
                    .values(draft_team_id=team_id, roster_slot_id=slot_id)
                )
                changed.append(
                    {
                        "player_id": player_id,
                        "from_team": row["draft_team_id"],
                        "to_team": team_id,
                        "change": "reallocated",
                    }
                )
        else:
            row_id = (
                "snapshot-"
                + hashlib.sha256(
                    f"{EXPECTED_SEASON}:{player_id}:{as_of.date().isoformat()}".encode()
                ).hexdigest()[:40]
            )
            session.execute(
                insert(ownerships).values(
                    id=row_id,
                    season_id=EXPECTED_SEASON,
                    draft_team_id=team_id,
                    player_id=player_id,
                    roster_slot_id=slot_id,
                    started_at=as_of,
                    ended_at=None,
                )
            )
            changed.append(
                {
                    "player_id": player_id,
                    "from_team": None,
                    "to_team": team_id,
                    "change": "added",
                }
            )
            added += 1

    verification_rows = (
        session.execute(
            select(ownerships.c.player_id, ownerships.c.draft_team_id).where(
                ownerships.c.season_id == EXPECTED_SEASON,
                ownerships.c.ended_at.is_(None),
            )
        )
        .mappings()
        .all()
    )
    actual: dict[str, set[str]] = defaultdict(set)
    for row in verification_rows:
        actual[row["draft_team_id"]].add(row["player_id"])
    expected: dict[str, set[str]] = defaultdict(set)
    for player_id, (team_id, _, _) in expected_by_id.items():
        expected[team_id].add(player_id)
    if actual != expected:
        raise ValueError("Post-reconciliation roster verification failed")

    if changed:
        digest = hashlib.sha256(
            json.dumps(changed, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest()
        audit_id = "roster-snapshot-20261104-" + digest[:16]
        session.execute(
            insert(audit).values(
                id=audit_id,
                subject_type="season",
                subject_id=EXPECTED_SEASON,
                action="current_roster_snapshot_reconciled",
                actor_manager_id=None,
                created_at=now,
                metadata_json={
                    "source": "castle_app_screenshots",
                    "as_of": as_of.isoformat(),
                    "league_id": EXPECTED_LEAGUE,
                    "season_id": EXPECTED_SEASON,
                    "reallocated_or_added_or_ended": len(changed),
                    "added": added,
                    "ended": ended,
                    "before_image": changed,
                },
            )
        )

    team_report = {}
    actual_counts = Counter(row["draft_team_id"] for row in verification_rows)
    for team_id in sorted(TEAM_IDS):
        team_report[team_id] = {
            "players": actual_counts[team_id],
            "changes": sum(
                1 for item in changed if item["from_team"] == team_id or item["to_team"] == team_id
            ),
        }
    return {
        "applied": True,
        "season_id": EXPECTED_SEASON,
        "snapshot_date": as_of.date().isoformat(),
        "rosters": team_report,
        "total_current_players": len(verification_rows),
        "allocations_changed": len(changed),
        "added": added,
        "ended": ended,
        "verified": True,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    parser.add_argument("--confirmation", required=True)
    args = parser.parse_args()
    guard_environment()
    if args.confirmation != CONFIRMATION:
        raise ValueError("Roster apply confirmation did not match")
    url = database_url(os.environ["CDL_DATABASE_URL"])
    engine = create_engine(
        url,
        isolation_level="SERIALIZABLE",
        hide_parameters=True,
    )
    try:
        with sessionmaker(engine, expire_on_commit=False)() as session, session.begin():
            report = reconcile(session, args.snapshot)
    finally:
        engine.dispose()
    output = json.dumps(report, indent=2)
    print(output)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with Path(summary_path).open("a", encoding="utf-8") as summary:
            summary.write("\n### Castle roster snapshot reconciliation\n\n")
            summary.write(f"- Current players verified: {report['total_current_players']}\n")
            summary.write(f"- Allocations changed: {report['allocations_changed']}\n\n")
            summary.write("| Team | Players | Affected |\n|---|---:|---:|\n")
            for team_id, details in report["rosters"].items():
                summary.write(f"| {team_id} | {details['players']} | {details['changes']} |\n")


if __name__ == "__main__":
    main()
