"""Server-side deadline and official FPL result settlement jobs."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import insert, select, update
from sqlalchemy.orm import Session

from cdl_api.repositories.postgres_fpl_data import (
    external_payload_cache_table,
    fpl_gameweeks_table,
)
from cdl_api.repositories.postgres_league_fixtures import (
    cdl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
)
from cdl_api.repositories.postgres_league_fpl import draft_teams_table
from cdl_api.repositories.postgres_team_selection import (
    team_selection_chips_table,
    team_selection_fixture_locks_table,
    team_selection_lineup_slots_table,
)
from cdl_api.staging_draft_seed import LEAGUE_ID, SEASON_ID


@dataclass(frozen=True)
class FplSettlementResult:
    """Counts emitted by the idempotent scheduled maintenance pass."""

    locked_gameweeks: int = 0
    locked_teams: int = 0
    settled_fixtures: int = 0
    skipped_fixtures: int = 0


class FplSettlementService:
    """Finalise due selections and frozen CDL results from official FPL data."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def settle(self) -> FplSettlementResult:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            due_gameweeks = self._due_gameweeks(session, now)
            locked_teams = self._finalise_due_selections(session, due_gameweeks, now)
            settled, skipped = self._settle_completed_fixtures(session, now)
            session.commit()
        return FplSettlementResult(
            locked_gameweeks=len(due_gameweeks),
            locked_teams=locked_teams,
            settled_fixtures=settled,
            skipped_fixtures=skipped,
        )

    @staticmethod
    def _due_gameweeks(session: Session, now: datetime) -> dict[int, datetime]:
        rows = session.execute(
            select(
                fpl_gameweeks_table.c.id,
                fpl_gameweeks_table.c.deadline_time,
            ).where(fpl_gameweeks_table.c.deadline_time.is_not(None))
        ).mappings()
        due: dict[int, datetime] = {}
        for row in rows:
            try:
                number = int(str(row["id"]))
            except (TypeError, ValueError):
                continue
            deadline = row["deadline_time"]
            if not isinstance(deadline, datetime):
                continue
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=UTC)
            if deadline <= now:
                due[number] = deadline
        return due

    @staticmethod
    def _finalise_due_selections(
        session: Session,
        due_gameweeks: Mapping[int, datetime],
        now: datetime,
    ) -> int:
        if not due_gameweeks:
            return 0
        team_ids = list(
            session.execute(
                select(draft_teams_table.c.id).where(draft_teams_table.c.league_id == LEAGUE_ID)
            ).scalars()
        )
        existing = {
            (int(row["gameweek"]), str(row["draft_team_id"]))
            for row in session.execute(
                select(
                    team_selection_fixture_locks_table.c.gameweek,
                    team_selection_fixture_locks_table.c.draft_team_id,
                ).where(
                    team_selection_fixture_locks_table.c.season_id == SEASON_ID,
                    team_selection_fixture_locks_table.c.draft_team_id.is_not(None),
                )
            ).mappings()
        }
        created = 0
        for gameweek, deadline in sorted(due_gameweeks.items()):
            for team_id in team_ids:
                team_id = str(team_id)
                FplSettlementService._roll_forward_lineup(
                    session,
                    team_id=team_id,
                    next_gameweek=gameweek,
                    now=now,
                    locked_at=deadline,
                )
                if (gameweek, team_id) not in existing:
                    session.execute(
                        insert(team_selection_fixture_locks_table).values(
                            id=f"fpl-deadline-{gameweek}-{team_id}",
                            season_id=SEASON_ID,
                            draft_team_id=team_id,
                            gameweek=gameweek,
                            fixture_id=f"fpl-gameweek-{gameweek}",
                            fixture_type="fpl",
                            lock_scope="gameweek",
                            locked_at=deadline,
                            reason="FPL deadline passed.",
                        )
                    )
                    created += 1

                session.execute(
                    update(team_selection_lineup_slots_table)
                    .where(
                        team_selection_lineup_slots_table.c.season_id == SEASON_ID,
                        team_selection_lineup_slots_table.c.draft_team_id == team_id,
                        team_selection_lineup_slots_table.c.gameweek == gameweek,
                    )
                    .values(locked_at=deadline, updated_at=now)
                )

                # Keep the activation gameweek on the used row so the scorer can
                # explain which chip was applied to the frozen result.
                session.execute(
                    update(team_selection_chips_table)
                    .where(
                        team_selection_chips_table.c.season_id == SEASON_ID,
                        team_selection_chips_table.c.draft_team_id == team_id,
                        team_selection_chips_table.c.status == "active",
                        team_selection_chips_table.c.active_gameweek == gameweek,
                    )
                    .values(
                        status="used",
                        used_gameweek=gameweek,
                        updated_at=now,
                    )
                )

        # A manager who never opens the app still needs an editable next-week
        # selection. Copy only when the next gameweek has no saved rows so a
        # manager's earlier edits cannot be overwritten by a later scheduler run.
        next_gameweek = FplSettlementService._next_gameweek(session)
        if next_gameweek is not None:
            for team_id in (str(team_id) for team_id in team_ids):
                FplSettlementService._roll_forward_lineup(
                    session,
                    team_id=team_id,
                    next_gameweek=next_gameweek,
                    now=now,
                )
        return created

    @staticmethod
    def _next_gameweek(session: Session) -> int | None:
        row = session.execute(
            select(fpl_gameweeks_table.c.id)
            .where(fpl_gameweeks_table.c.is_next.is_(True))
            .order_by(fpl_gameweeks_table.c.deadline_time.asc().nulls_last())
            .limit(1)
        ).scalar_one_or_none()
        try:
            return int(str(row)) if row is not None else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _roll_forward_lineup(
        session: Session,
        *,
        team_id: str,
        next_gameweek: int,
        now: datetime,
        locked_at: datetime | None = None,
    ) -> None:
        has_next = session.execute(
            select(team_selection_lineup_slots_table.c.id)
            .where(
                team_selection_lineup_slots_table.c.season_id == SEASON_ID,
                team_selection_lineup_slots_table.c.draft_team_id == team_id,
                team_selection_lineup_slots_table.c.gameweek == next_gameweek,
            )
            .limit(1)
        ).scalar_one_or_none()
        if has_next is not None:
            return

        source_rows = list(
            session.execute(
                select(
                    team_selection_lineup_slots_table.c.gameweek,
                    team_selection_lineup_slots_table.c.player_id,
                    team_selection_lineup_slots_table.c.slot,
                    team_selection_lineup_slots_table.c.slot_order,
                    team_selection_lineup_slots_table.c.is_captain,
                    team_selection_lineup_slots_table.c.is_vice_captain,
                )
                .where(
                    team_selection_lineup_slots_table.c.season_id == SEASON_ID,
                    team_selection_lineup_slots_table.c.draft_team_id == team_id,
                    team_selection_lineup_slots_table.c.gameweek < next_gameweek,
                )
                .order_by(
                    team_selection_lineup_slots_table.c.gameweek.desc(),
                    team_selection_lineup_slots_table.c.slot,
                    team_selection_lineup_slots_table.c.slot_order,
                )
            ).mappings()
        )
        if not source_rows:
            return
        source_gameweek = source_rows[0]["gameweek"]
        source_rows = [row for row in source_rows if row["gameweek"] == source_gameweek]
        session.execute(
            insert(team_selection_lineup_slots_table),
            [
                {
                    "id": f"lineup-{team_id}-{next_gameweek}-{row['player_id']}",
                    "season_id": SEASON_ID,
                    "draft_team_id": team_id,
                    "player_id": row["player_id"],
                    "gameweek": next_gameweek,
                    "slot": row["slot"],
                    "slot_order": row["slot_order"],
                    "is_captain": row["is_captain"],
                    "is_vice_captain": row["is_vice_captain"],
                    "locked_at": locked_at,
                    "updated_at": now,
                }
                for row in source_rows
            ],
        )

    @classmethod
    def _settle_completed_fixtures(
        cls,
        session: Session,
        now: datetime,
    ) -> tuple[int, int]:
        ready_gameweeks = cls._ready_gameweeks(session)
        if not ready_gameweeks:
            return 0, 0

        live_rows = session.execute(
            select(
                external_payload_cache_table.c.resource,
                external_payload_cache_table.c.payload_json,
                external_payload_cache_table.c.response_sha256,
            ).where(external_payload_cache_table.c.resource.like("event-live:%"))
        ).mappings()
        live_payloads = {
            int(str(row["resource"]).removeprefix("event-live:")): (
                row["payload_json"],
                str(row["response_sha256"]),
            )
            for row in live_rows
            if str(row["resource"]).removeprefix("event-live:").isdigit()
        }
        result_rows = {
            str(row["payload_json"].get("fixture_id")): (str(row["id"]), row["payload_json"])
            for row in session.execute(
                select(fixture_results_table.c.id, fixture_results_table.c.payload_json)
            ).mappings()
            if isinstance(row["payload_json"], Mapping)
            and row["payload_json"].get("fixture_id") is not None
        }
        snapshot_rows = {
            str(row["payload_json"].get("fixture_id")): row["payload_json"]
            for row in session.execute(
                select(fixture_scoring_snapshots_table.c.payload_json)
            ).mappings()
            if isinstance(row["payload_json"], Mapping)
            and row["payload_json"].get("fixture_id") is not None
        }
        fixture_rows = list(
            session.execute(select(cdl_fixtures_table.c.id, cdl_fixtures_table.c.payload_json))
            .mappings()
        )
        settled = skipped = 0
        for row in fixture_rows:
            payload = row["payload_json"]
            if not isinstance(payload, Mapping):
                skipped += 1
                continue
            fixture_id = str(payload.get("id") or row["id"])
            gameweek = _gameweek_number(payload)
            if gameweek is None or gameweek not in ready_gameweeks:
                continue
            result_row = result_rows.get(fixture_id)
            current_result = result_row[1] if result_row is not None else {}
            if (
                result_row is not None
                and (
                    not isinstance(current_result, Mapping)
                    or current_result.get("finalised") is True
                )
            ):
                continue
            live_payload, source_hash = live_payloads.get(gameweek, (None, ""))
            player_points = _event_player_points(live_payload)
            if not player_points:
                skipped += 1
                continue
            home_team = payload.get("home_team")
            away_team = payload.get("away_team")
            if not isinstance(home_team, Mapping) or not isinstance(away_team, Mapping):
                skipped += 1
                continue
            home_id = str(home_team.get("id", ""))
            away_id = str(away_team.get("id", ""))
            scores = cls._team_scores(session, gameweek, (home_id, away_id), player_points)
            if scores is None:
                skipped += 1
                continue
            home_score, away_score, player_scores, chips_played = scores
            outcome = (
                "home_win"
                if home_score > away_score
                else "away_win"
                if away_score > home_score
                else "draw"
            )
            finalised_at = now.isoformat()
            result_payload = {
                **dict(current_result),
                "fixture_id": fixture_id,
                "home_score": home_score,
                "away_score": away_score,
                "outcome": outcome,
                "finalised": True,
                "finalised_at": finalised_at,
                "gameweek": gameweek,
                "source_resource": f"event-live:{gameweek}",
                "source_response_sha256": source_hash,
                "synthetic": False,
            }
            snapshot_payload = {
                **dict(snapshot_rows.get(fixture_id, {})),
                "fixture_id": fixture_id,
                "home_score": home_score,
                "away_score": away_score,
                "player_scores": player_scores,
                "chips_played": chips_played,
                "source_resource": f"event-live:{gameweek}",
                "source_response_sha256": source_hash,
                "finalised_at": finalised_at,
                "synthetic": False,
            }
            result_id = f"result-{fixture_id}"
            snapshot_id = f"snapshot-{fixture_id}"
            if result_row is not None:
                session.execute(
                    update(fixture_results_table)
                    .where(fixture_results_table.c.id == result_row[0])
                    .values(payload_json=result_payload)
                )
            else:
                session.execute(
                    insert(fixture_results_table).values(id=result_id, payload_json=result_payload)
                )
            snapshot_exists = session.execute(
                select(fixture_scoring_snapshots_table.c.id).where(
                    fixture_scoring_snapshots_table.c.id == snapshot_id
                )
            ).scalar_one_or_none()
            if snapshot_exists is None:
                session.execute(
                    insert(fixture_scoring_snapshots_table).values(
                        id=snapshot_id,
                        payload_json=snapshot_payload,
                    )
                )
            else:
                session.execute(
                    update(fixture_scoring_snapshots_table)
                    .where(fixture_scoring_snapshots_table.c.id == snapshot_id)
                    .values(payload_json=snapshot_payload)
                )
            settled += 1
        return settled, skipped

    @staticmethod
    def _ready_gameweeks(session: Session) -> set[int]:
        return {
            int(str(row["id"]))
            for row in session.execute(
                select(fpl_gameweeks_table.c.id).where(
                    fpl_gameweeks_table.c.data_checked.is_(True),
                    fpl_gameweeks_table.c.finished.is_(True),
                )
            ).mappings()
            if str(row["id"]).isdigit()
        }

    @staticmethod
    def _team_scores(
        session: Session,
        gameweek: int,
        team_ids: tuple[str, str],
        player_points: Mapping[str, int],
    ) -> tuple[int, int, dict[str, int], dict[str, list[str]]] | None:
        rows = list(
            session.execute(
                select(
                    team_selection_lineup_slots_table.c.draft_team_id,
                    team_selection_lineup_slots_table.c.player_id,
                    team_selection_lineup_slots_table.c.slot,
                    team_selection_lineup_slots_table.c.slot_order,
                    team_selection_lineup_slots_table.c.is_captain,
                    team_selection_lineup_slots_table.c.is_vice_captain,
                ).where(
                    team_selection_lineup_slots_table.c.season_id == SEASON_ID,
                    team_selection_lineup_slots_table.c.gameweek == gameweek,
                    team_selection_lineup_slots_table.c.draft_team_id.in_(team_ids),
                )
            ).mappings()
        )
        by_team: dict[str, list[Mapping[str, object]]] = {team_id: [] for team_id in team_ids}
        for row in rows:
            by_team.setdefault(str(row["draft_team_id"]), []).append(row)
        if any(
            sum(row["slot"] == "starter" for row in by_team.get(team_id, [])) < 11
            for team_id in team_ids
        ):
            return None

        chip_rows = list(
            session.execute(
                select(
                    team_selection_chips_table.c.draft_team_id,
                    team_selection_chips_table.c.chip_id,
                ).where(
                    team_selection_chips_table.c.season_id == SEASON_ID,
                    team_selection_chips_table.c.draft_team_id.in_(team_ids),
                    team_selection_chips_table.c.active_gameweek == gameweek,
                    team_selection_chips_table.c.status.in_(("active", "used")),
                )
            ).mappings()
        )
        chips_by_team: dict[str, list[str]] = {team_id: [] for team_id in team_ids}
        for row in chip_rows:
            chips_by_team.setdefault(str(row["draft_team_id"]), []).append(
                _chip_display_name(str(row["chip_id"]))
            )

        totals: dict[str, int] = {}
        player_scores: dict[str, int] = {}
        for team_id in team_ids:
            team_rows = by_team[team_id]
            starters = [row for row in team_rows if row["slot"] == "starter"]
            chip_ids = {
                str(row["chip_id"])
                for row in chip_rows
                if str(row["draft_team_id"]) == team_id
            }
            scoring_rows = starters
            if "bench-boost" in chip_ids:
                scoring_rows = [*starters, *[row for row in team_rows if row["slot"] == "bench"]]
            elif "best-xi" in chip_ids:
                scoring_rows = sorted(
                    [*starters, *[row for row in team_rows if row["slot"] == "bench"]],
                    key=lambda row: (
                        -int(player_points.get(str(row["player_id"]).removeprefix("fpl-"), 0)),
                        int(row.get("slot_order", 0)),
                    ),
                )[:11]

            captain = next((row for row in starters if row["is_captain"]), None)
            vice_captain = next((row for row in starters if row["is_vice_captain"]), None)
            auto_captain = None
            if "auto-captain" in chip_ids and scoring_rows:
                auto_captain = min(
                    scoring_rows,
                    key=lambda row: (
                        -int(player_points.get(str(row["player_id"]).removeprefix("fpl-"), 0)),
                        int(row.get("slot_order", 0)),
                    ),
                )

            total = 0
            for row in scoring_rows:
                player_id = str(row["player_id"])
                points = int(player_points.get(player_id.removeprefix("fpl-"), 0))
                multiplier = 1
                if auto_captain is row:
                    multiplier = 2
                elif row is captain:
                    multiplier = 3 if "triple-captain" in chip_ids else 2
                elif row is vice_captain and "dual-captain" in chip_ids:
                    multiplier = 2
                final_points = points * multiplier
                player_scores[f"{team_id}:{player_id}"] = final_points
                total += final_points
            totals[team_id] = total
        return totals[team_ids[0]], totals[team_ids[1]], player_scores, chips_by_team


def _gameweek_number(payload: Mapping[str, object]) -> int | None:
    gameweek = payload.get("gameweek")
    if isinstance(gameweek, Mapping):
        value = gameweek.get("number")
    else:
        value = None
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _event_player_points(payload: object) -> dict[str, int]:
    if not isinstance(payload, Mapping) or not isinstance(payload.get("elements"), list):
        return {}
    points: dict[str, int] = {}
    for element in payload["elements"]:
        if not isinstance(element, Mapping) or element.get("id") is None:
            continue
        stats = element.get("stats")
        if not isinstance(stats, Mapping):
            continue
        try:
            points[str(element["id"])] = int(stats.get("total_points", 0) or 0)
        except (TypeError, ValueError):
            continue
    return points


def _chip_display_name(chip_id: str) -> str:
    return {
        "triple-captain": "Triple Captain",
        "dual-captain": "Dual Captain",
        "auto-captain": "Auto Captain",
        "bench-boost": "Bench Boost",
        "best-xi": "Best XI",
    }.get(chip_id, chip_id)
