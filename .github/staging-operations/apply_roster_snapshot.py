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
    metrics_table = Table(
        "fpl_player_current_metrics", metadata, autoload_with=session.connection()
    )
    # Load position and club alongside the name fields so every match is exact
    # to the screenshot's position and Premier League team.
    statement = select(
        players_table.c.id,
        players_table.c.web_name,
        players_table.c.first_name,
        players_table.c.second_name,
        players_table.c.position_id,
        epl_teams_table.c.short_name,
        metrics_table.c.total_points,
    ).select_from(
        players_table.join(
            epl_teams_table,
            players_table.c.team_id == epl_teams_table.c.id,
        ).outerjoin(metrics_table, metrics_table.c.player_id == players_table.c.id)
    )
    available = session.execute(statement).mappings().all()
    ownerships_table = Table("squad_ownerships", metadata, autoload_with=session.connection())
    active_player_ids = set(
        session.execute(
            select(ownerships_table.c.player_id).where(
                ownerships_table.c.season_id == EXPECTED_SEASON,
                ownerships_table.c.ended_at.is_(None),
            )
        ).scalars()
    )
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
            if len(candidates) > 1 and item.get("points") is not None:
                points_candidates = [
                    candidate
                    for candidate in candidates
                    if candidate["total_points"] == item["points"]
                ]
                if len(points_candidates) == 1:
                    candidates = points_candidates
            if len(candidates) > 1:
                active_candidates = [
                    candidate for candidate in candidates if candidate["id"] in active_player_ids
                ]
                if len(active_candidates) == 1:
                    candidates = active_candidates
            if len(candidates) != 1:
                points = [candidate["total_points"] for candidate in candidates]
                failures.append(
                    f"{team_id}:{item['position']}:{item['club']}:{item['name']} "
                    f"matched {len(candidates)} cached players at points {points}"
                )
                continue
            resolved[team_id].append({**item, "player_id": candidates[0]["id"]})
    ids = [item["player_id"] for roster in resolved.values() for item in roster]
    if failures:
        raise ValueError("Player identity review required: " + "; ".join(failures))
    if len(ids) != 160 or len(set(ids)) != 160:
        raise ValueError("Resolved snapshot does not contain 160 unique cached players")
    return resolved


def apply_movement_history(
    session: Session,
    metadata: MetaData,
    snapshot: Path,
    resolved: dict[str, list[dict]],
) -> dict:
    data = json.loads(snapshot.read_text(encoding="utf-8"))
    movements = data.get("movements", [])
    if not movements:
        return {"events": 0, "updated": 0, "unmatched": []}

    ownerships = Table("squad_ownerships", metadata, autoload_with=session.connection())
    players = Table("fpl_players", metadata, autoload_with=session.connection())
    epl_teams = Table("epl_teams", metadata, autoload_with=session.connection())
    available = (
        session.execute(
            select(
                players.c.id,
                players.c.web_name,
                players.c.first_name,
                players.c.second_name,
                players.c.position_id,
                epl_teams.c.short_name,
            ).select_from(players.join(epl_teams, players.c.team_id == epl_teams.c.id))
        )
        .mappings()
        .all()
    )

    roster_by_name: dict[str, set[str]] = defaultdict(set)
    roster_by_team_name: dict[tuple[str, str], set[str]] = defaultdict(set)
    for team_id, roster in resolved.items():
        for item in roster:
            for name in [item["name"], *item.get("aliases", [])]:
                key = normalize(name)
                roster_by_name[key].add(item["player_id"])
                roster_by_team_name[(team_id, key)].add(item["player_id"])

    ownerships = Table("squad_ownerships", metadata, autoload_with=session.connection())
    corrections: list[dict] = []
    unmatched: list[str] = []
    event_keys: set[tuple[str, str, str, str]] = set()
    resolved_by_team_name: dict[tuple[str, str], str] = {}
    ordered_movements = sorted(
        movements,
        key=lambda event: (event["date"], event["direction"] == "OUT"),
    )
    for event in ordered_movements:
        team_id = event["team_id"]
        direction = event["direction"]
        name = event["player"]
        date = datetime.fromisoformat(event["date"]).replace(tzinfo=UTC)
        key = (team_id, direction, normalize(name), date.date().isoformat())
        if key in event_keys:
            raise ValueError(f"Duplicate screenshot movement: {key}")
        event_keys.add(key)

        name_keys = [
            normalize(name),
            *(normalize(alias) for alias in event.get("aliases", [])),
        ]
        team_candidates = {
            player_id
            for name_key in name_keys
            for player_id in roster_by_team_name.get((team_id, name_key), set())
        }
        paired_key = (team_id, normalize(name))
        known_player_id = resolved_by_team_name.get(paired_key)
        has_opposite_movement = any(
            other["team_id"] == team_id
            and other["direction"] != direction
            and normalize(other["player"]) == normalize(name)
            for other in movements
        )
        if known_player_id and has_opposite_movement:
            candidate_ids = {known_player_id}
        else:
            candidate_ids = team_candidates or {
                player_id
                for name_key in name_keys
                for player_id in roster_by_name.get(name_key, set())
            }
        if (
            candidate_ids
            and (event.get("club") or event.get("position"))
            and not (known_player_id and has_opposite_movement)
        ):
            metadata_by_id = {row["id"]: row for row in available}
            candidate_ids = {
                player_id
                for player_id in candidate_ids
                if player_id in metadata_by_id
                and (
                    not event.get("club")
                    or metadata_by_id[player_id]["short_name"] == event["club"]
                )
                and (
                    not event.get("position")
                    or metadata_by_id[player_id]["position_id"] == event["position"]
                )
            }
        if not candidate_ids:
            wanted = {
                normalize(name),
                *(normalize(alias) for alias in event.get("aliases", [])),
            }
            candidates = []
            for row in available:
                names = {
                    normalize(str(row["web_name"] or "")),
                    normalize(str(row["second_name"] or "")),
                    normalize(
                        " ".join(
                            part
                            for part in (
                                str(row["first_name"] or ""),
                                str(row["second_name"] or ""),
                            )
                            if part
                        )
                    ),
                }
                names.discard("")
                if not wanted.intersection(names):
                    continue
                if event.get("club") and row["short_name"] != event["club"]:
                    continue
                if event.get("position") and row["position_id"] != event["position"]:
                    continue
                candidates.append(row["id"])
            candidate_ids.update(candidates)
        if event.get("aliases"):
            alias_names = {normalize(alias) for alias in event["aliases"]}
            alias_matches = set()
            for row in available:
                names = {
                    normalize(str(row["web_name"] or "")),
                    normalize(str(row["second_name"] or "")),
                    normalize(
                        " ".join(
                            part
                            for part in (
                                str(row["first_name"] or ""),
                                str(row["second_name"] or ""),
                            )
                            if part
                        )
                    ),
                }
                if not alias_names.intersection(names):
                    continue
                if event.get("club") and row["short_name"] != event["club"]:
                    continue
                if event.get("position") and row["position_id"] != event["position"]:
                    continue
                alias_matches.add(row["id"])
            if len(alias_matches) == 1:
                candidate_ids = alias_matches
        if len(candidate_ids) > 1:
            # Legacy cache rows can coexist with canonical FPL identities such
            # as "224" and "fpl-224". Collapse only exact prefixed/unprefixed
            # duplicates; the documented canonical identity is fpl-<element id>.
            canonical_ids = {str(player_id).removeprefix("fpl-") for player_id in candidate_ids}
            if len(canonical_ids) == 1:
                prefixed_ids = {
                    player_id for player_id in candidate_ids if str(player_id).startswith("fpl-")
                }
                if len(prefixed_ids) == 1:
                    candidate_ids = prefixed_ids
        if len(candidate_ids) > 1:
            owned_matches = set(
                session.execute(
                    select(ownerships.c.player_id).where(
                        ownerships.c.season_id == EXPECTED_SEASON,
                        ownerships.c.draft_team_id == team_id,
                        ownerships.c.player_id.in_(candidate_ids),
                    )
                ).scalars()
            )
            if len(owned_matches) == 1:
                candidate_ids = owned_matches
        if len(candidate_ids) != 1:
            candidate_details = [
                f"{row['id']}:{row['first_name']} {row['second_name']} "
                f"({row['short_name']}/{row['position_id']})"
                for row in available
                if str(row["id"]) in {str(value) for value in candidate_ids}
            ]
            unmatched.append(
                f"{team_id} {direction} {name} {date.date().isoformat()}: "
                f"identity matched {len(candidate_ids)} players {candidate_details}"
            )
            continue
        player_id = next(iter(candidate_ids))
        if has_opposite_movement:
            resolved_by_team_name[paired_key] = player_id
        rows = (
            session.execute(
                select(
                    ownerships.c.id,
                    ownerships.c.started_at,
                    ownerships.c.ended_at,
                    ownerships.c.roster_slot_id,
                ).where(
                    ownerships.c.season_id == EXPECTED_SEASON,
                    ownerships.c.draft_team_id == team_id,
                    ownerships.c.player_id == player_id,
                )
            )
            .mappings()
            .all()
        )
        if not rows:
            if direction == "IN":
                exits = [
                    datetime.fromisoformat(other["date"]).replace(tzinfo=UTC)
                    for other in movements
                    if other["team_id"] == team_id
                    and other["direction"] == "OUT"
                    and normalize(other["player"]) == normalize(name)
                    and datetime.fromisoformat(other["date"]).replace(tzinfo=UTC) >= date
                ]
                if exits:
                    end_date = min(exits)
                    ownership_id = (
                        "history-"
                        + hashlib.sha256(
                            f"{EXPECTED_SEASON}:{team_id}:{player_id}:{date.isoformat()}:{end_date.isoformat()}".encode()
                        ).hexdigest()[:40]
                    )
                    session.execute(
                        insert(ownerships).values(
                            id=ownership_id,
                            season_id=EXPECTED_SEASON,
                            draft_team_id=team_id,
                            player_id=player_id,
                            roster_slot_id=None,
                            started_at=date,
                            ended_at=end_date,
                        )
                    )
                    corrections.append(
                        {
                            "ownership_id": ownership_id,
                            "player_id": player_id,
                            "team_id": team_id,
                            "direction": "IN/OUT",
                            "effective_at": date.isoformat(),
                            "ended_at": end_date.isoformat(),
                        }
                    )
                    continue
            unmatched.append(
                f"{team_id} {direction} {name} {date.date().isoformat()}: no ownership period"
            )
            continue

        if direction == "IN":
            eligible = [
                row
                for row in rows
                if row["started_at"] is not None
                and row["started_at"].replace(tzinfo=row["started_at"].tzinfo or UTC) >= date
                and (
                    row["ended_at"] is None
                    or row["ended_at"].replace(tzinfo=row["ended_at"].tzinfo or UTC) >= date
                )
            ]
            if len(eligible) != 1:
                eligible = [
                    row
                    for row in rows
                    if row["started_at"] is not None
                    and row["started_at"].replace(tzinfo=row["started_at"].tzinfo or UTC) <= date
                    and (
                        row["ended_at"] is None
                        or row["ended_at"].replace(tzinfo=row["ended_at"].tzinfo or UTC) >= date
                    )
                ]
            if len(eligible) != 1:
                unmatched.append(
                    f"{team_id} IN {name} {date.date().isoformat()}: period not uniquely matched"
                )
                continue
            row = eligible[0]
            if row["started_at"].replace(tzinfo=row["started_at"].tzinfo or UTC) != date:
                session.execute(
                    update(ownerships).where(ownerships.c.id == row["id"]).values(started_at=date)
                )
                corrections.append(
                    {
                        "ownership_id": row["id"],
                        "player_id": player_id,
                        "team_id": team_id,
                        "direction": direction,
                        "effective_at": date.isoformat(),
                    }
                )
        elif direction == "OUT":
            eligible = [
                row
                for row in rows
                if row["started_at"] is not None
                and row["started_at"].replace(tzinfo=row["started_at"].tzinfo or UTC) <= date
                and (
                    row["ended_at"] is None
                    or row["ended_at"].replace(tzinfo=row["ended_at"].tzinfo or UTC) >= date
                )
            ]
            if len(eligible) != 1:
                unmatched.append(
                    f"{team_id} OUT {name} {date.date().isoformat()}: period not uniquely matched"
                )
                continue
            row = eligible[0]
            end = row["ended_at"]
            if end is None or end.replace(tzinfo=end.tzinfo or UTC) != date:
                session.execute(
                    update(ownerships)
                    .where(ownerships.c.id == row["id"])
                    .values(ended_at=date, roster_slot_id=None)
                )
                corrections.append(
                    {
                        "ownership_id": row["id"],
                        "player_id": player_id,
                        "team_id": team_id,
                        "direction": direction,
                        "effective_at": date.isoformat(),
                    }
                )
        else:
            raise ValueError(f"Unsupported screenshot movement direction: {direction}")

    if corrections:
        digest = hashlib.sha256(
            json.dumps(corrections, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest()
        audit = Table("squad_audit_events", metadata, autoload_with=session.connection())
        session.execute(
            insert(audit).values(
                id="squad-history-20261105-" + digest[:16],
                subject_type="season",
                subject_id=EXPECTED_SEASON,
                action="screenshot_ownership_periods_backfilled",
                actor_manager_id=None,
                created_at=datetime.now(UTC),
                metadata_json={
                    "source": "castle_scout_report_screenshots",
                    "league_id": EXPECTED_LEAGUE,
                    "season_id": EXPECTED_SEASON,
                    "updated_periods": len(corrections),
                    "corrections": corrections,
                    "unmatched": unmatched,
                },
            )
        )
    return {
        "events": len(movements),
        "updated": len(corrections),
        "unmatched": unmatched,
    }


def inspect_history(session: Session, snapshot: Path) -> dict:
    """Reconstruct dated checkpoints backwards from the actual current squads."""
    from datetime import timedelta
    from zoneinfo import ZoneInfo

    metadata = MetaData()
    payloads = Table("import_source_payloads", metadata, autoload_with=session.connection())
    owners = Table("squad_ownerships", metadata, autoload_with=session.connection())
    players = Table("fpl_players", metadata, autoload_with=session.connection())
    audit = Table("squad_audit_events", metadata, autoload_with=session.connection())
    source: dict[str, list] = {}
    root = "leagues/e0bbe341-1aff-4acc-98f0-7c76911aa915/"
    for payload in session.execute(select(payloads.c.payload_json)).scalars():
        value = payload.get("payload", {})
        if payload.get("archived") or not isinstance(value, dict):
            continue
        path = value.get("file", "")
        if path.startswith(root):
            source[path.removeprefix(root).removesuffix(".json")] = value.get("data", [])
    if len(source.get("castle_teams", [])) != 8:
        raise ValueError("Expected Castle league archive missing")
    source_teams = source["castle_teams"]
    # Source owner IDs remain internal mapping keys and never enter the report.
    aliases = {
        "The Class of 84": "team-class-of-84",
        "Wilde Boars FC": "team-wilde-boars",
        "Stan Still Sells Tik": "team-stan-still-sells-tik",
        "Sporting Lesbians": "team-sporting-lesbians",
        "Koden All Stars": "team-koden-all-stars",
        "Exeter Gently": "team-exeter-gently",
        "Dribbling Dicks": "team-dicks-dribbling-xi",
        "BayerNeverlusen": "team-bayer-neverlusen",
    }
    team_map = {}
    for team in source_teams:
        match = next(
            (
                target
                for name, target in aliases.items()
                if normalize(name) == normalize(team["name"])
            ),
            None,
        )
        if match is None:
            raise ValueError("Unrecognized archived team")
        team_map[team["owner_user_id"]] = match
    cache = [dict(row) for row in session.execute(select(players)).mappings()]
    by_id = {str(row["id"]): row for row in cache}
    all_rows = [
        dict(row)
        for row in session.execute(
            select(owners).where(owners.c.season_id == EXPECTED_SEASON)
        ).mappings()
    ]
    current = [row for row in all_rows if row["ended_at"] is None]
    if len(current) != 160 or {row["draft_team_id"] for row in current} != TEAM_IDS:
        raise ValueError("Current squads must contain 160 players across eight teams")
    if any(sum(row["draft_team_id"] == team for row in current) != 20 for team in TEAM_IDS):
        raise ValueError("Current team count differs from twenty")
    canonical = {}
    for row in current:
        canonical[str(row["player_id"]).removeprefix("fpl-")] = str(row["player_id"])

    def player_id(external: str) -> str:
        key = str(external).removeprefix("fpl-")
        result = canonical.get(key, "fpl-" + key if "fpl-" + key in by_id else key)
        if result not in by_id:
            raise ValueError("Archived player is absent from the cache")
        return result

    def names(row: dict) -> set[str]:
        return {
            normalize(str(row.get(key) or ""))
            for key in ("player_web_name", "web_name", "second_name")
        }

    data = json.loads(snapshot.read_text(encoding="utf-8"))
    ledger = []
    unresolved = []
    local = ZoneInfo("Australia/Melbourne")
    awards = [
        row
        for row in source.get("draw_results", [])
        if row.get("confirmed") and not row.get("forfeited")
    ]
    candidates = source.get("draft_picks", []) + awards
    # Interest entries provide identity aliases only, never acquisition evidence.
    for draw in source.get("draws", []):
        for entries in (draw.get("interests_snapshot") or {}).values():
            candidates.extend(entries)
    for event in data["movements"]:
        wanted = {normalize(name) for name in [event["player"], *event.get("aliases", [])]}
        matches = [
            row
            for row in candidates
            if wanted & names(row)
            and (not row.get("user_id") or team_map.get(row["user_id"]) == event["team_id"])
        ]
        exact = [row for row in matches if row in awards]
        matches = exact or matches
        primary = [row for row in matches if normalize(event["player"]) in names(row)]
        if len({str(row["fpl_player_id"]) for row in primary}) == 1:
            matches = primary
        external_ids = {str(row["fpl_player_id"]) for row in matches}
        if len(external_ids) != 1:
            cached = [row for row in cache if wanted & names(row)]
            external_ids = {str(row["id"]).removeprefix("fpl-") for row in cached}
        if len(external_ids) != 1:
            unresolved.append({**event, "reason": "identity_ambiguous"})
            continue
        pid = player_id(next(iter(external_ids)))
        day = datetime.fromisoformat(event["date"]).replace(tzinfo=local)
        when = (day + timedelta(days=1)).astimezone(UTC)
        precision = "local_day_end"
        if event["direction"] == "IN":
            confirmed = [
                row
                for row in matches
                if row.get("confirmed_at")
                and datetime.fromisoformat(row["confirmed_at"]).astimezone(local).date()
                == day.date()
            ]
            if len(confirmed) == 1:
                when = datetime.fromisoformat(confirmed[0]["confirmed_at"])
                precision = "source_confirmation"
            else:
                when = day.astimezone(UTC)
                precision = "local_day_start"
        ledger.append(
            {
                "team_id": event["team_id"],
                "player_id": pid,
                "player": event["player"],
                "direction": event["direction"],
                "effective_at": when.isoformat(),
                "precision": precision,
                "source": "commissioner_screenshot",
            }
        )
    bulletin = next(
        (
            row
            for row in source.get("trade-bulletins", [])
            if (row.get("metadata") or {}).get("trade_id") == "40e50fdc-d583-4ef2-84fb-25889ab700e2"
        ),
        None,
    )
    expected_body = "DJ sends Yalcouyé, Solanke to Richard in exchange for Martinez, David."
    if bulletin is None or bulletin.get("body") != expected_body:
        raise ValueError("Reviewed four-player trade bulletin missing or changed")
    trade_time = datetime.fromisoformat(bulletin["created_at"])
    trade = [
        ("605", "Yalcouyé", "team-wilde-boars", "team-dicks-dribbling-xi"),
        ("526", "Solanke", "team-wilde-boars", "team-dicks-dribbling-xi"),
        ("28", "Martinez", "team-dicks-dribbling-xi", "team-wilde-boars"),
        ("594", "David", "team-dicks-dribbling-xi", "team-wilde-boars"),
    ]
    changes = []
    for external, name, before, after in trade:
        pid = player_id(external)
        for team, direction in ((before, "OUT"), (after, "IN")):
            ledger.append(
                {
                    "team_id": team,
                    "player_id": pid,
                    "player": name,
                    "direction": direction,
                    "effective_at": trade_time.isoformat(),
                    "precision": "source_bulletin",
                    "source": "castle_trade_bulletin",
                    "trade_id": bulletin["metadata"]["trade_id"],
                }
            )
        acquisitions = [
            datetime.fromisoformat(e["effective_at"])
            for e in ledger
            if e["player_id"] == pid
            and e["team_id"] == before
            and e["direction"] == "IN"
            and datetime.fromisoformat(e["effective_at"]) < trade_time
        ]
        if not acquisitions:
            picks = [
                row
                for row in source.get("draft_picks", [])
                if str(row["fpl_player_id"]) == external and row.get("picked_at")
            ]
            acquisitions = [datetime.fromisoformat(row["picked_at"]) for row in picks]
        if not acquisitions:
            raise ValueError("Trade origin has no acquisition evidence")
        start = min(acquisitions)
        exits = [
            datetime.fromisoformat(e["effective_at"])
            for e in ledger
            if e["player_id"] == pid
            and e["team_id"] == after
            and e["direction"] == "OUT"
            and datetime.fromisoformat(e["effective_at"]) >= trade_time
        ]
        end = min(exits) if exits else None
        for team, began, ended in (
            (before, start, trade_time),
            (after, trade_time, end),
        ):
            rows = [
                row for row in all_rows if row["player_id"] == pid and row["draft_team_id"] == team
            ]
            if len(rows) > 1:
                raise ValueError("Multiple ownership periods require explicit matching")
            values = {"started_at": began, "ended_at": ended}
            if ended is not None:
                values["roster_slot_id"] = None
            if rows:
                row = rows[0]
                if row["started_at"] == began and row["ended_at"] == ended:
                    continue
                session.execute(update(owners).where(owners.c.id == row["id"]).values(**values))
                changes.append(
                    {
                        "ownership_id": row["id"],
                        "before": {key: str(row[key]) for key in ("started_at", "ended_at")},
                        "after": {key: str(value) for key, value in values.items()},
                    }
                )
            else:
                oid = (
                    "history-trade-"
                    + hashlib.sha256(f"{team}:{pid}:{began}".encode()).hexdigest()[:36]
                )
                session.execute(
                    insert(owners).values(
                        id=oid,
                        season_id=EXPECTED_SEASON,
                        draft_team_id=team,
                        player_id=pid,
                        **values,
                    )
                )
                changes.append(
                    {
                        "ownership_id": oid,
                        "created": True,
                        "player_id": pid,
                        "team_id": team,
                        "started_at": began.isoformat(),
                        "ended_at": ended.isoformat() if ended else None,
                    }
                )
    # Reverse complete local-day groups so same-day trades and releases remain atomic.
    anchor = datetime.now(UTC)
    state = {
        team: {row["player_id"] for row in current if row["draft_team_id"] == team}
        for team in TEAM_IDS
    }

    def checkpoint(at: str) -> dict:
        return {
            "as_of": at,
            "teams": {team: sorted(ids) for team, ids in sorted(state.items())},
        }

    snapshots = [checkpoint(anchor.isoformat())]
    lineup_evidence = []
    for lineup in source.get("lineups", []):
        team = team_map.get(lineup.get("user_id"))
        if team:
            ids = lineup.get("starter_ids", []) + lineup.get("bench_ids", [])
            lineup_evidence.append(
                {
                    "team_id": team,
                    "gameweek": lineup.get("gameweek"),
                    "player_ids": sorted({player_id(str(pid)) for pid in ids}),
                    "scope": "recorded_selection_only",
                }
            )
    grouped: dict[str, list] = defaultdict(list)
    for event in ledger:
        moment = datetime.fromisoformat(event["effective_at"]).astimezone(local)
        if event["precision"] == "local_day_end":
            moment -= timedelta(microseconds=1)
        grouped[moment.date().isoformat()].append(event)
    gaps = []
    for day, events in sorted(grouped.items(), reverse=True):
        for event in sorted(
            events,
            key=lambda e: (e["effective_at"], e["direction"] == "IN"),
            reverse=True,
        ):
            members = state[event["team_id"]]
            pid = event["player_id"]
            if event["direction"] == "IN":
                if pid not in members:
                    gaps.append(
                        {
                            "team_id": event["team_id"],
                            "player_id": pid,
                            "player": event["player"],
                            "reason": "unrecorded_exit_after_acquisition",
                            "acquired_at": event["effective_at"],
                            "absent_by": anchor.isoformat(),
                        }
                    )
                members.discard(pid)
            else:
                members.add(pid)
        snapshots.append(checkpoint(day + " before movements (Australia/Melbourne)"))
    for gap in gaps:
        gap["observed_gameweeks"] = sorted(
            {
                row["gameweek"]
                for row in lineup_evidence
                if row["team_id"] == gap["team_id"] and gap["player_id"] in row["player_ids"]
            }
        )
    for index, snap in enumerate(snapshots):
        snap["squad_counts"] = {team: len(ids) for team, ids in snap["teams"].items()}
        snap["completeness"] = "current_verified" if index == 0 else "known_continuity_only"
    for snap in snapshots:
        flattened = [pid for ids in snap["teams"].values() for pid in ids]
        if len(flattened) != len(set(flattened)):
            raise ValueError("Backwards snapshot assigns a player to multiple teams")
    verified = [
        dict(row)
        for row in session.execute(
            select(owners).where(owners.c.season_id == EXPECTED_SEASON, owners.c.ended_at.is_(None))
        ).mappings()
    ]
    if {(r["player_id"], r["draft_team_id"], r["roster_slot_id"]) for r in verified} != {
        (r["player_id"], r["draft_team_id"], r["roster_slot_id"]) for r in current
    }:
        raise ValueError("History reconstruction changed current allocations")
    # Store the complete event ledger and checkpoints using existing audit storage.
    report = {
        "version": 1,
        "source": "castle_archive_and_commissioner_screenshots",
        "season_id": EXPECTED_SEASON,
        "anchor_at": anchor.isoformat(),
        "ledger": ledger,
        "snapshots": snapshots,
        "archived_selection_evidence": lineup_evidence,
        "gaps": gaps + unresolved,
        "ownership_changes": changes,
        "completeness": "partial" if gaps or unresolved else "complete",
        "gap_semantics": (
            "Snapshots represent known continuity; players with an unrecorded exit are uncertain "
            "between acquisition and the current anchor. Day-only releases use the exclusive "
            "end of the Melbourne calendar day."
        ),
    }
    audit_id = (
        "history-reconstruction-"
        + hashlib.sha256(
            json.dumps(
                {"ledger": ledger, "current": snapshots[0]["teams"]}, sort_keys=True
            ).encode()
        ).hexdigest()[:32]
    )
    if (
        session.execute(select(audit.c.id).where(audit.c.id == audit_id)).scalar_one_or_none()
        is None
    ):
        session.execute(
            insert(audit).values(
                id=audit_id,
                subject_type="season",
                subject_id=EXPECTED_SEASON,
                action="squad_history_reconstructed",
                actor_manager_id=None,
                created_at=anchor,
                metadata_json=report,
            )
        )
    return {
        "total_current_players": len(current),
        "allocations_changed": 0,
        "rosters": {team: {"players": 20, "changes": 0} for team in sorted(TEAM_IDS)},
        "history_reconstruction": {
            "events": len(ledger),
            "snapshots": len(snapshots),
            "archived_selection_records": len(lineup_evidence),
            "source_lineup_fields": sorted({key for row in source.get("lineups", []) for key in row}),
            "source_lineup_sample": [{key: value for key, value in row.items() if key not in {"user_id", "league_id", "id"}} for row in source.get("lineups", [])[:2]],
            "ownership_periods_changed": len(changes),
            "identity_gaps": len(unresolved),
            "unresolved_identities": unresolved,
            "unknown_exits": gaps,
            "audit_id": audit_id,
            "current_rosters_verified": True,
            "completeness": report["completeness"],
        },
    }


def reconcile(session: Session, snapshot: Path) -> dict:
    if json.loads(snapshot.read_text(encoding="utf-8")).get("reconstruct_history"):
        return inspect_history(session, snapshot)
    return reconcile_current_snapshot(session, snapshot)


def reconcile_current_snapshot(session: Session, snapshot: Path) -> dict:
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

    movement_report = apply_movement_history(session, metadata, snapshot, resolved)

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
        "movement_history": movement_report,
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
    output = json.dumps(report, indent=2, default=str)
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
