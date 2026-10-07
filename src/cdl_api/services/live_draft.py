"""Transactional orchestration for one configured league-season live draft."""

from __future__ import annotations

import random
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.engine import RowMapping
from sqlalchemy.orm import Session

from cdl_api.repositories.live_draft import (
    live_draft_events_table,
    live_draft_picks_table,
    live_draft_queue_table,
    live_drafts_table,
)
from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    fpl_player_values_table,
    fpl_players_table,
    league_memberships_table,
    managers_table,
    seasons_table,
)
from cdl_api.repositories.postgres_squad import squad_ownerships_table, squad_roster_slots_table
from cdl_api.repositories.postgres_team_selection import team_selection_lineup_slots_table
from cdl_api.staging_draft_seed import LEAGUE_ID, POSITION_LIMITS, SEASON_ID, SQUAD_SIZE


class LiveDraftError(ValueError):
    """A user-correctable live-draft rule violation."""


def ensure_squad_moves_allowed(session: Session, season_id: str) -> None:
    """Block ownership mutations while a season's draft is being filled."""
    status = session.execute(
        select(live_drafts_table.c.status).where(live_drafts_table.c.season_id == season_id)
    ).scalar_one_or_none()
    if status is not None and status != "complete":
        raise LiveDraftError("Squad ownership cannot change while the draft is in progress.")


def _now() -> datetime:
    return datetime.now(UTC)


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class LiveDraftService:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def membership(self, user_id: str) -> dict[str, str] | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(
                        league_memberships_table.c.role,
                        draft_teams_table.c.id.label("team_id"),
                    )
                    .join(
                        managers_table, managers_table.c.id == league_memberships_table.c.manager_id
                    )
                    .outerjoin(
                        draft_teams_table,
                        (draft_teams_table.c.manager_id == managers_table.c.id)
                        & (draft_teams_table.c.league_id == LEAGUE_ID),
                    )
                    .where(
                        league_memberships_table.c.league_id == LEAGUE_ID,
                        managers_table.c.user_id == user_id,
                    )
                )
                .mappings()
                .first()
            )
        return dict(row) if row else None

    def teams(self) -> list[dict[str, str]]:
        with self._session_factory() as session:
            rows = (
                session.execute(
                    select(draft_teams_table.c.id, draft_teams_table.c.name)
                    .where(draft_teams_table.c.league_id == LEAGUE_ID)
                    .order_by(draft_teams_table.c.name)
                )
                .mappings()
                .all()
            )
        return [{"id": str(row["id"]), "name": str(row["name"])} for row in rows]

    def creation_availability(self) -> dict[str, bool | str | None]:
        """Expose the configured season's ownership guard to the draft setup UI."""
        with self._session_factory() as session:
            active_ownership = session.execute(
                select(squad_ownerships_table.c.id)
                .where(
                    squad_ownerships_table.c.season_id == SEASON_ID,
                    squad_ownerships_table.c.ended_at.is_(None),
                )
                .limit(1)
            ).scalar_one_or_none()
        if active_ownership:
            return {"can_create": False, "reason": "active_squad_ownerships"}
        return {"can_create": True, "reason": None}

    def create(
        self,
        *,
        actor_id: str,
        mode: str,
        rounds: int,
        clock_enabled: bool,
        pick_seconds: int | None,
        manual_team_order: list[str] | None,
    ) -> str:
        now = _now()
        with self._session_factory() as session:
            with session.begin():
                session.execute(
                    select(seasons_table.c.id)
                    .where(seasons_table.c.id == SEASON_ID)
                    .with_for_update()
                ).scalar_one_or_none()
                if rounds != SQUAD_SIZE:
                    raise LiveDraftError(f"A draft must fill all {SQUAD_SIZE} roster slots.")
                if clock_enabled and pick_seconds is None:
                    raise LiveDraftError("A pick duration is required when the clock is enabled.")
                if session.execute(
                    select(live_drafts_table.c.id).where(
                        live_drafts_table.c.league_id == LEAGUE_ID,
                        live_drafts_table.c.season_id == SEASON_ID,
                    )
                ).scalar_one_or_none():
                    raise LiveDraftError("A draft room already exists for this league season.")
                teams = (
                    session.execute(
                        select(draft_teams_table.c.id)
                        .where(draft_teams_table.c.league_id == LEAGUE_ID)
                        .order_by(draft_teams_table.c.id)
                    )
                    .scalars()
                    .all()
                )
                if not teams:
                    raise LiveDraftError("This league has no assigned draft teams.")
                order = list(teams)
                if mode == "random_repeat":
                    random.SystemRandom().shuffle(order)
                elif mode == "manual":
                    if manual_team_order is None or len(manual_team_order) != len(teams):
                        raise LiveDraftError("Manual order must include every league team once.")
                    if len(set(manual_team_order)) != len(teams) or set(manual_team_order) != set(
                        teams
                    ):
                        raise LiveDraftError("Manual order must use every league team.")
                    order = list(manual_team_order)
                elif mode != "snake":
                    raise LiveDraftError("Unsupported draft order mode.")
                if mode == "snake":
                    order = [
                        team
                        for rnd in range(rounds)
                        for team in (teams if rnd % 2 == 0 else list(reversed(teams)))
                    ]
                else:
                    order = order * rounds
                slot_counts = dict(
                    session.execute(
                        select(
                            squad_roster_slots_table.c.draft_team_id,
                            func.count().label("slot_count"),
                        )
                        .where(
                            squad_roster_slots_table.c.season_id == SEASON_ID,
                            squad_roster_slots_table.c.draft_team_id.in_(teams),
                        )
                        .group_by(squad_roster_slots_table.c.draft_team_id)
                    ).all()
                )
                if any(slot_counts.get(team, 0) < rounds for team in teams):
                    raise LiveDraftError(
                        "Draft length exceeds a team's configured roster capacity."
                    )
                pool_counts = dict(
                    session.execute(
                        select(fpl_players_table.c.position_id, func.count()).group_by(
                            fpl_players_table.c.position_id
                        )
                    ).all()
                )
                if any(
                    pool_counts.get(position, 0) < minimum * len(teams)
                    for position, (minimum, _) in POSITION_LIMITS.items()
                ):
                    raise LiveDraftError("The player pool cannot fill all required positions.")
                already_owned = session.execute(
                    select(squad_ownerships_table.c.id)
                    .where(
                        squad_ownerships_table.c.season_id == SEASON_ID,
                        squad_ownerships_table.c.ended_at.is_(None),
                    )
                    .limit(1)
                ).scalar_one_or_none()
                if already_owned:
                    raise LiveDraftError("This season already has active squad ownerships.")
                draft_id = str(uuid4())
                session.execute(
                    insert(live_drafts_table).values(
                        id=draft_id,
                        league_id=LEAGUE_ID,
                        season_id=SEASON_ID,
                        status="setup",
                        mode=mode,
                        team_order=order,
                        rounds=rounds,
                        pick_index=0,
                        clock_enabled=clock_enabled,
                        pick_seconds=pick_seconds if clock_enabled else None,
                        clock_seconds_remaining=pick_seconds if clock_enabled else None,
                        clock_started_at=None,
                        clock_deadline_at=None,
                        created_by_user_id=actor_id,
                        created_at=now,
                        updated_at=now,
                    )
                )
                self._event(
                    session, draft_id, "draft_created", actor_id, None, None, {"mode": mode}
                )
                return draft_id

    def control(self, actor_id: str, action: str) -> None:
        now = _now()
        with self._session_factory() as session, session.begin():
            session.execute(
                select(seasons_table.c.id).where(seasons_table.c.id == SEASON_ID).with_for_update()
            ).scalar_one_or_none()
            draft = self._draft(session, lock=True)
            if draft is None:
                raise LiveDraftError("No draft room exists for this league season.")
            status = {
                "start": "active",
                "pause": "paused",
                "resume": "active",
                "complete": "complete",
            }[action]
            if action == "start" and draft["status"] != "setup":
                raise LiveDraftError("Only a setup draft can be started.")
            if action == "pause" and draft["status"] != "active":
                raise LiveDraftError("Only an active draft can be paused.")
            if action == "resume" and draft["status"] != "paused":
                raise LiveDraftError("Only a paused draft can be resumed.")
            if action == "complete" and draft["status"] not in {"active", "paused"}:
                raise LiveDraftError("This draft cannot be completed from its current state.")
            if action == "complete" and draft["pick_index"] < len(draft["team_order"]):
                raise LiveDraftError(
                    "Every scheduled pick must be made before completing the draft."
                )
            remaining = draft["clock_seconds_remaining"]
            if action == "pause" and draft["clock_deadline_at"]:
                remaining = max(0, int((_utc(draft["clock_deadline_at"]) - now).total_seconds()))
            if action == "start":
                remaining = draft["pick_seconds"]
            clock_start = None
            deadline = None
            if status == "active" and draft["clock_enabled"] and remaining is not None:
                elapsed = max(0, draft["pick_seconds"] - remaining)
                clock_start = now - timedelta(seconds=elapsed)
                deadline = now + timedelta(seconds=remaining)
            session.execute(
                update(live_drafts_table)
                .where(live_drafts_table.c.id == draft["id"])
                .values(
                    status=status,
                    clock_started_at=clock_start,
                    clock_deadline_at=deadline,
                    clock_seconds_remaining=remaining,
                    updated_at=now,
                )
            )
            self._event(session, draft["id"], f"draft_{action}", actor_id, None, None, {})

    def set_queue(self, actor_id: str, team_id: str, player_ids: list[str]) -> None:
        now = _now()
        with self._session_factory() as session, session.begin():
            draft = self._draft(session, lock=True)
            if draft is None or draft["status"] in {"complete", "cancelled"}:
                raise LiveDraftError("There is no editable draft queue.")
            if len(set(player_ids)) != len(player_ids):
                raise LiveDraftError("A player can only appear once in the queue.")
            valid_ids = (
                set(
                    session.execute(
                        select(fpl_players_table.c.id).where(fpl_players_table.c.id.in_(player_ids))
                    ).scalars()
                )
                if player_ids
                else set()
            )
            if valid_ids != set(player_ids):
                raise LiveDraftError("Queue contains an unknown player.")
            session.execute(
                delete(live_draft_queue_table).where(
                    live_draft_queue_table.c.draft_id == draft["id"],
                    live_draft_queue_table.c.team_id == team_id,
                )
            )
            for rank, player_id in enumerate(player_ids):
                session.execute(
                    insert(live_draft_queue_table).values(
                        id=str(uuid4()),
                        draft_id=draft["id"],
                        team_id=team_id,
                        player_id=player_id,
                        rank=rank,
                    )
                )
            self._event(
                session,
                draft["id"],
                "preselection_queue_updated",
                actor_id,
                team_id,
                None,
                {"count": len(player_ids), "at": now.isoformat()},
            )

    def make_pick(
        self,
        *,
        actor_id: str | None,
        team_id: str,
        player_id: str | None,
        idempotency_key: str,
        source: str = "manager_manual",
        commissioner: bool = False,
    ) -> dict[str, object]:
        now = _now()
        with self._session_factory() as session, session.begin():
            session.execute(
                select(seasons_table.c.id).where(seasons_table.c.id == SEASON_ID).with_for_update()
            ).scalar_one_or_none()
            draft = self._draft(session, lock=True)
            if draft is None or draft["status"] != "active":
                raise LiveDraftError("The draft is not active.")
            if source == "auto":
                source = (
                    "system_timeout_auto" if draft["clock_enabled"] else "manager_preselection_auto"
                )
            old = (
                session.execute(
                    select(live_draft_picks_table).where(
                        live_draft_picks_table.c.draft_id == draft["id"],
                        live_draft_picks_table.c.idempotency_key == idempotency_key,
                    )
                )
                .mappings()
                .first()
            )
            if old:
                if old["team_id"] != team_id or old["actor_user_id"] != actor_id:
                    raise LiveDraftError("Idempotency key was already used for another pick.")
                return dict(old)
            index = draft["pick_index"]
            max_picks = len(draft["team_order"])
            if index >= max_picks:
                raise LiveDraftError("The draft has no picks remaining.")
            on_clock = draft["team_order"][index]
            if on_clock != team_id:
                raise LiveDraftError("It is not this team's turn.")
            if not commissioner and source not in {
                "manager_manual",
                "manager_preselection_auto",
                "system_timeout_auto",
            }:
                raise LiveDraftError("Invalid pick source.")
            if (
                draft["clock_enabled"]
                and draft["clock_deadline_at"]
                and now < _utc(draft["clock_deadline_at"])
            ):
                if source == "system_timeout_auto":
                    raise LiveDraftError("The pick clock has not expired.")
            elif (
                source == "system_timeout_auto"
                and draft["clock_enabled"]
                and not draft["clock_deadline_at"]
            ):
                raise LiveDraftError("The pick clock has not expired.")
            if player_id is None:
                player_id = self._autopick_player(session, draft["id"], team_id)
            player = (
                session.execute(
                    select(fpl_players_table).where(fpl_players_table.c.id == player_id)
                )
                .mappings()
                .first()
            )
            if player is None:
                raise LiveDraftError("Unknown player.")
            duplicate = session.execute(
                select(live_draft_picks_table.c.id).where(
                    live_draft_picks_table.c.draft_id == draft["id"],
                    live_draft_picks_table.c.player_id == player_id,
                )
            ).scalar_one_or_none()
            if duplicate:
                raise LiveDraftError("This player has already been drafted.")
            active_owner = session.execute(
                select(squad_ownerships_table.c.id).where(
                    squad_ownerships_table.c.season_id == draft["season_id"],
                    squad_ownerships_table.c.player_id == player_id,
                    squad_ownerships_table.c.ended_at.is_(None),
                )
            ).scalar_one_or_none()
            if active_owner:
                raise LiveDraftError("This player is already owned by a league team.")
            if not self._legal_position_pick(session, draft, team_id, player_id):
                raise LiveDraftError(
                    "This pick would make the team's required position limits impossible."
                )
            slot = session.execute(
                select(squad_roster_slots_table.c.id)
                .where(
                    squad_roster_slots_table.c.season_id == draft["season_id"],
                    squad_roster_slots_table.c.draft_team_id == team_id,
                    ~squad_roster_slots_table.c.id.in_(
                        select(squad_ownerships_table.c.roster_slot_id).where(
                            squad_ownerships_table.c.ended_at.is_(None),
                            squad_ownerships_table.c.roster_slot_id.is_not(None),
                        )
                    ),
                )
                .order_by(squad_roster_slots_table.c.sort_order)
                .limit(1)
            ).scalar_one_or_none()
            if slot is None:
                raise LiveDraftError("This team has no open roster slot.")
            seconds_taken = None
            if draft["clock_started_at"]:
                seconds_taken = max(0, int((now - _utc(draft["clock_started_at"])).total_seconds()))
            pick_id = str(uuid4())
            round_number = index // len(set(draft["team_order"])) + 1
            session.execute(
                insert(live_draft_picks_table).values(
                    id=pick_id,
                    draft_id=draft["id"],
                    pick_index=index,
                    round_number=round_number,
                    team_id=team_id,
                    player_id=player_id,
                    source=source,
                    actor_user_id=actor_id,
                    idempotency_key=idempotency_key,
                    picked_at=now,
                    seconds_taken=seconds_taken,
                )
            )
            session.execute(
                insert(squad_ownerships_table).values(
                    id=str(uuid4()),
                    season_id=draft["season_id"],
                    draft_team_id=team_id,
                    player_id=player_id,
                    roster_slot_id=slot,
                    started_at=now,
                    ended_at=None,
                )
            )
            next_index = index + 1
            complete = next_index >= max_picks
            clock_started = now if draft["clock_enabled"] and not complete else None
            deadline = (
                now + timedelta(seconds=draft["pick_seconds"])
                if clock_started and draft["pick_seconds"]
                else None
            )
            remaining = draft["pick_seconds"] if draft["clock_enabled"] else None
            session.execute(
                update(live_drafts_table)
                .where(live_drafts_table.c.id == draft["id"])
                .values(
                    pick_index=next_index,
                    status="complete" if complete else "active",
                    clock_started_at=clock_started,
                    clock_deadline_at=deadline,
                    clock_seconds_remaining=remaining,
                    updated_at=now,
                )
            )
            self._event(
                session,
                draft["id"],
                "draft_pick",
                actor_id,
                team_id,
                player_id,
                {"pick_number": index + 1, "source": source, "player_name": player["web_name"]},
            )
            return {
                "id": pick_id,
                "pick_index": index,
                "team_id": team_id,
                "player_id": player_id,
                "actor_user_id": actor_id,
            }

    def room(
        self, user_id: str, team_id: str | None, role: str = "manager"
    ) -> dict[str, object] | None:
        expired_pick: tuple[str, str, int] | None = None
        with self._session_factory() as session:
            current = self._draft(session)
            if (
                current is not None
                and current["status"] == "active"
                and current["clock_enabled"]
                and current["clock_deadline_at"] is not None
                and _now() >= _utc(current["clock_deadline_at"])
                and current["pick_index"] < len(current["team_order"])
            ):
                expired_pick = (
                    str(current["id"]),
                    str(current["team_order"][current["pick_index"]]),
                    int(current["pick_index"]),
                )
        if expired_pick:
            draft_id, current_team, pick_index = expired_pick
            try:
                self.make_pick(
                    actor_id=None,
                    team_id=current_team,
                    player_id=None,
                    idempotency_key=f"timeout:{draft_id}:{pick_index}",
                    source="system_timeout_auto",
                    commissioner=True,
                )
            except LiveDraftError:
                # A concurrent pick or pause may have won the room-row lock.
                pass
        with self._session_factory() as session:
            draft = self._draft(session)
            if draft is None:
                return None
            teams = (
                session.execute(
                    select(draft_teams_table.c.id, draft_teams_table.c.name).where(
                        draft_teams_table.c.id.in_(set(draft["team_order"]))
                    )
                )
                .mappings()
                .all()
            )
            names = {row["id"]: row["name"] for row in teams}
            index = draft["pick_index"]
            current_team = (
                draft["team_order"][index]
                if draft["status"] == "active" and index < len(draft["team_order"])
                else None
            )
            picks = (
                session.execute(
                    select(live_draft_picks_table, fpl_players_table.c.web_name)
                    .join(
                        fpl_players_table,
                        fpl_players_table.c.id == live_draft_picks_table.c.player_id,
                    )
                    .where(live_draft_picks_table.c.draft_id == draft["id"])
                    .order_by(live_draft_picks_table.c.pick_index)
                )
                .mappings()
                .all()
            )
            picked_ids = [row["player_id"] for row in picks]
            latest_cost = (
                select(fpl_player_values_table.c.value)
                .where(fpl_player_values_table.c.player_id == fpl_players_table.c.id)
                .order_by(fpl_player_values_table.c.gameweek.desc())
                .limit(1)
                .scalar_subquery()
            )
            available = (
                session.execute(
                    select(
                        fpl_players_table.c.id,
                        fpl_players_table.c.web_name,
                        fpl_players_table.c.position_id,
                        latest_cost.label("value"),
                    )
                    .where(~fpl_players_table.c.id.in_(picked_ids or [""]))
                    .order_by(fpl_players_table.c.web_name, fpl_players_table.c.id)
                )
                .mappings()
                .all()
            )
            queue = []
            if team_id:
                queue = (
                    session.execute(
                        select(live_draft_queue_table.c.player_id)
                        .where(
                            live_draft_queue_table.c.draft_id == draft["id"],
                            live_draft_queue_table.c.team_id == team_id,
                        )
                        .order_by(live_draft_queue_table.c.rank)
                    )
                    .scalars()
                    .all()
                )
            events = (
                session.execute(
                    select(live_draft_events_table)
                    .where(live_draft_events_table.c.draft_id == draft["id"])
                    .order_by(live_draft_events_table.c.created_at.desc())
                    .limit(100)
                )
                .mappings()
                .all()
            )
            return {
                "id": draft["id"],
                "my_team_id": team_id,
                "can_commission": role in {"commissioner", "admin"},
                "status": draft["status"],
                "mode": draft["mode"],
                "rounds": draft["rounds"],
                "pick_number": index + 1 if current_team else None,
                "current_team_id": current_team,
                "current_team_name": names.get(current_team) if current_team else None,
                "clock_enabled": bool(draft["clock_enabled"]),
                "pick_seconds": draft["pick_seconds"],
                "clock_started_at": draft["clock_started_at"],
                "clock_deadline_at": draft["clock_deadline_at"],
                "picks": [
                    {
                        "pick_number": row["pick_index"] + 1,
                        "round_number": row["round_number"],
                        "team_id": row["team_id"],
                        "team_name": names.get(row["team_id"], ""),
                        "player_id": row["player_id"],
                        "player_name": row["web_name"],
                        "source": row["source"],
                        "picked_at": row["picked_at"],
                        "seconds_taken": row["seconds_taken"],
                    }
                    for row in picks
                ],
                "available_players": [
                    {
                        "id": row["id"],
                        "name": row["web_name"],
                        "position": row["position_id"],
                        "cost": row["value"],
                    }
                    for row in available
                ],
                "my_queue": list(queue),
                "events": [
                    {
                        "id": e["id"],
                        "type": e["event_type"],
                        "team_id": e["team_id"],
                        "player_id": e["player_id"],
                        "details": e["details"],
                        "created_at": e["created_at"],
                    }
                    for e in events
                ],
            }

    def correct_pick(self, *, actor_id: str, pick_number: int, player_id: str, reason: str) -> None:
        if pick_number < 1:
            raise LiveDraftError("Pick number must be positive.")
        now = _now()
        with self._session_factory() as session, session.begin():
            session.execute(
                select(seasons_table.c.id).where(seasons_table.c.id == SEASON_ID).with_for_update()
            ).scalar_one_or_none()
            draft = self._draft(session, lock=True)
            if draft is None:
                raise LiveDraftError("No draft room exists for this league season.")
            if draft["status"] not in {"active", "paused"}:
                raise LiveDraftError(
                    "Pick corrections are only allowed before the draft completes."
                )
            locked_lineup = session.execute(
                select(team_selection_lineup_slots_table.c.id)
                .where(
                    team_selection_lineup_slots_table.c.season_id == draft["season_id"],
                    team_selection_lineup_slots_table.c.locked_at.is_not(None),
                )
                .limit(1)
            ).scalar_one_or_none()
            if locked_lineup:
                raise LiveDraftError("Draft picks cannot be corrected after a season lineup locks.")
            picked = (
                session.execute(
                    select(live_draft_picks_table)
                    .where(
                        live_draft_picks_table.c.draft_id == draft["id"],
                        live_draft_picks_table.c.pick_index == pick_number - 1,
                    )
                    .with_for_update()
                )
                .mappings()
                .first()
            )
            if picked is None:
                raise LiveDraftError("Pick does not exist.")
            if picked["player_id"] == player_id:
                raise LiveDraftError("Correction must select a different player.")
            player = session.execute(
                select(fpl_players_table.c.id).where(fpl_players_table.c.id == player_id)
            ).scalar_one_or_none()
            if player is None:
                raise LiveDraftError("Unknown player.")
            already_picked = session.execute(
                select(live_draft_picks_table.c.id).where(
                    live_draft_picks_table.c.draft_id == draft["id"],
                    live_draft_picks_table.c.player_id == player_id,
                    live_draft_picks_table.c.id != picked["id"],
                )
            ).scalar_one_or_none()
            already_owned = session.execute(
                select(squad_ownerships_table.c.id).where(
                    squad_ownerships_table.c.season_id == draft["season_id"],
                    squad_ownerships_table.c.player_id == player_id,
                    squad_ownerships_table.c.ended_at.is_(None),
                )
            ).scalar_one_or_none()
            if already_picked or already_owned:
                raise LiveDraftError("This player is already owned by a league team.")
            old_ownership = (
                session.execute(
                    select(squad_ownerships_table)
                    .where(
                        squad_ownerships_table.c.season_id == draft["season_id"],
                        squad_ownerships_table.c.draft_team_id == picked["team_id"],
                        squad_ownerships_table.c.player_id == picked["player_id"],
                        squad_ownerships_table.c.ended_at.is_(None),
                    )
                    .with_for_update()
                )
                .mappings()
                .first()
            )
            if old_ownership is None:
                raise LiveDraftError("The squad assignment for this pick is missing.")
            session.execute(
                update(squad_ownerships_table)
                .where(squad_ownerships_table.c.id == old_ownership["id"])
                .values(ended_at=now)
            )
            if not self._legal_position_pick(session, draft, str(picked["team_id"]), player_id):
                raise LiveDraftError(
                    "Correction would make the team's roster position rules impossible."
                )
            session.execute(
                insert(squad_ownerships_table).values(
                    id=str(uuid4()),
                    season_id=draft["season_id"],
                    draft_team_id=picked["team_id"],
                    player_id=player_id,
                    roster_slot_id=old_ownership["roster_slot_id"],
                    started_at=now,
                    ended_at=None,
                )
            )
            session.execute(
                update(live_draft_picks_table)
                .where(live_draft_picks_table.c.id == picked["id"])
                .values(
                    player_id=player_id,
                    source="commissioner_correction",
                    actor_user_id=actor_id,
                )
            )
            self._event(
                session,
                draft["id"],
                "draft_pick_corrected",
                actor_id,
                str(picked["team_id"]),
                player_id,
                {
                    "pick_number": pick_number,
                    "previous_player_id": picked["player_id"],
                    "reason": reason,
                },
            )

    @staticmethod
    def _draft(session: Session, lock: bool = False) -> RowMapping | None:
        query = select(live_drafts_table).where(
            live_drafts_table.c.league_id == LEAGUE_ID,
            live_drafts_table.c.season_id == SEASON_ID,
        )
        if lock:
            query = query.with_for_update()
        return session.execute(query).mappings().first()

    @staticmethod
    def _legal_position_pick(
        session: Session, draft: RowMapping, team_id: str, player_id: str
    ) -> bool:
        position = session.execute(
            select(fpl_players_table.c.position_id).where(fpl_players_table.c.id == player_id)
        ).scalar_one_or_none()
        if position not in POSITION_LIMITS:
            return False
        rows = session.execute(
            select(
                squad_ownerships_table.c.draft_team_id,
                fpl_players_table.c.position_id,
                func.count().label("player_count"),
            )
            .join(fpl_players_table, fpl_players_table.c.id == squad_ownerships_table.c.player_id)
            .where(
                squad_ownerships_table.c.season_id == draft["season_id"],
                squad_ownerships_table.c.ended_at.is_(None),
            )
            .group_by(squad_ownerships_table.c.draft_team_id, fpl_players_table.c.position_id)
        ).all()
        counts = {(team, pos): int(count) for team, pos, count in rows}
        counts[(team_id, position)] = counts.get((team_id, position), 0) + 1
        team_ids = set(draft["team_order"])
        remaining_picks = 0
        remaining_capacity = 0
        for team in team_ids:
            team_count = sum(count for (owner, _), count in counts.items() if owner == team)
            team_remaining = draft["rounds"] - team_count
            if team_remaining < 0:
                return False
            remaining_picks += team_remaining
            for pos, (_, maximum) in POSITION_LIMITS.items():
                if counts.get((team, pos), 0) > maximum:
                    return False
                remaining_capacity += maximum - counts.get((team, pos), 0)

        owned_ids = (
            session.execute(
                select(squad_ownerships_table.c.player_id).where(
                    squad_ownerships_table.c.season_id == draft["season_id"],
                    squad_ownerships_table.c.ended_at.is_(None),
                )
            )
            .scalars()
            .all()
        )
        if player_id in owned_ids:
            return False
        excluded_ids = [*owned_ids, player_id]
        available_counts = dict(
            session.execute(
                select(fpl_players_table.c.position_id, func.count())
                .where(~fpl_players_table.c.id.in_(excluded_ids or [""]))
                .group_by(fpl_players_table.c.position_id)
            ).all()
        )
        if sum(available_counts.get(pos, 0) for pos in POSITION_LIMITS) < remaining_picks:
            return False
        if remaining_capacity < remaining_picks:
            return False
        for pos, (minimum, _) in POSITION_LIMITS.items():
            still_needed = sum(max(0, minimum - counts.get((team, pos), 0)) for team in team_ids)
            if available_counts.get(pos, 0) < still_needed:
                return False
        return True

    @staticmethod
    def _autopick_player(session: Session, draft_id: str, team_id: str) -> str:
        draft = LiveDraftService._draft(session)
        if draft is None:
            raise LiveDraftError("No draft room exists for this league season.")
        queued = session.execute(
            select(live_draft_queue_table.c.player_id)
            .where(
                live_draft_queue_table.c.draft_id == draft_id,
                live_draft_queue_table.c.team_id == team_id,
                ~live_draft_queue_table.c.player_id.in_(
                    select(live_draft_picks_table.c.player_id).where(
                        live_draft_picks_table.c.draft_id == draft_id
                    )
                ),
            )
            .order_by(live_draft_queue_table.c.rank)
            .limit(1)
        ).scalar_one_or_none()
        if queued:
            queued_ids = (
                session.execute(
                    select(live_draft_queue_table.c.player_id)
                    .where(
                        live_draft_queue_table.c.draft_id == draft_id,
                        live_draft_queue_table.c.team_id == team_id,
                        ~live_draft_queue_table.c.player_id.in_(
                            select(live_draft_picks_table.c.player_id).where(
                                live_draft_picks_table.c.draft_id == draft_id
                            )
                        ),
                        ~live_draft_queue_table.c.player_id.in_(
                            select(squad_ownerships_table.c.player_id).where(
                                squad_ownerships_table.c.season_id == draft["season_id"],
                                squad_ownerships_table.c.ended_at.is_(None),
                            )
                        ),
                    )
                    .order_by(live_draft_queue_table.c.rank)
                )
                .scalars()
                .all()
            )
            for queued_id in queued_ids:
                if LiveDraftService._legal_position_pick(session, draft, team_id, str(queued_id)):
                    return str(queued_id)
        latest_cost = (
            select(fpl_player_values_table.c.value)
            .where(fpl_player_values_table.c.player_id == fpl_players_table.c.id)
            .order_by(fpl_player_values_table.c.gameweek.desc())
            .limit(1)
            .scalar_subquery()
        )
        candidates = (
            session.execute(
                select(fpl_players_table.c.id)
                .where(
                    ~fpl_players_table.c.id.in_(
                        select(live_draft_picks_table.c.player_id).where(
                            live_draft_picks_table.c.draft_id == draft_id
                        )
                    ),
                    ~fpl_players_table.c.id.in_(
                        select(squad_ownerships_table.c.player_id).where(
                            squad_ownerships_table.c.season_id == draft["season_id"],
                            squad_ownerships_table.c.ended_at.is_(None),
                        )
                    ),
                )
                .order_by(latest_cost.desc().nullslast(), fpl_players_table.c.id)
            )
            .scalars()
            .all()
        )
        for player_id in candidates:
            if LiveDraftService._legal_position_pick(session, draft, team_id, str(player_id)):
                return str(player_id)
        raise LiveDraftError("No position-legal players remain in the available pool.")

    @staticmethod
    def _event(
        session: Session,
        draft_id: str,
        event_type: str,
        actor_id: str | None,
        team_id: str | None,
        player_id: str | None,
        details: dict[str, object],
    ) -> None:
        session.execute(
            insert(live_draft_events_table).values(
                id=str(uuid4()),
                draft_id=draft_id,
                event_type=event_type,
                actor_user_id=actor_id,
                team_id=team_id,
                player_id=player_id,
                details=details,
                created_at=_now(),
            )
        )
