"""League membership and invite-link persistence."""

from __future__ import annotations

import hashlib
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, MetaData, String, Table, insert, select, update
from sqlalchemy.orm import Session

from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    league_memberships_table,
    leagues_table,
    managers_table,
)
from cdl_api.staging_draft_seed import LEAGUE_ID

metadata = MetaData()

league_invites_table = Table(
    "league_invites",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("league_id", String(64), nullable=False),
    Column("created_by_user_id", String(64), nullable=False),
    Column("token_hash", String(64), nullable=False, unique=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=True),
    Column("revoked_at", DateTime(timezone=True), nullable=True),
)


@dataclass(frozen=True)
class LeagueAccess:
    league_id: str
    league_name: str
    role: str
    team_id: str | None
    team_name: str | None


@dataclass(frozen=True)
class InvitePreview:
    league_id: str
    league_name: str
    available_team_count: int
    is_expired: bool = False


@dataclass(frozen=True)
class InviteCreation:
    token: str
    league_name: str
    available_team_count: int


@dataclass(frozen=True)
class LeagueJoin:
    league_id: str
    league_name: str
    team_id: str
    team_name: str
    already_member: bool


def hash_invite_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class PostgreSQLLeagueMembershipRepository:
    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    def access_for_user(self, user_id: str, league_id: str = LEAGUE_ID) -> LeagueAccess | None:
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(
                        leagues_table.c.id.label("league_id"),
                        leagues_table.c.name.label("league_name"),
                        league_memberships_table.c.role,
                        draft_teams_table.c.id.label("team_id"),
                        draft_teams_table.c.name.label("team_name"),
                    )
                    .join(
                        league_memberships_table,
                        league_memberships_table.c.league_id == leagues_table.c.id,
                    )
                    .join(
                        managers_table,
                        managers_table.c.id == league_memberships_table.c.manager_id,
                    )
                    .outerjoin(
                        draft_teams_table,
                        draft_teams_table.c.manager_id == managers_table.c.id,
                    )
                    .where(
                        leagues_table.c.id == league_id,
                        managers_table.c.user_id == user_id,
                    )
                )
                .mappings()
                .first()
            )
        if row is None:
            return None
        return LeagueAccess(
            league_id=str(row["league_id"]),
            league_name=str(row["league_name"]),
            role=str(row["role"]),
            team_id=str(row["team_id"]) if row["team_id"] is not None else None,
            team_name=str(row["team_name"]) if row["team_name"] is not None else None,
        )

    def create_invite(self, user_id: str, league_id: str = LEAGUE_ID) -> InviteCreation:
        token = secrets.token_urlsafe(32)
        now = datetime.now(UTC)
        with self._session_factory() as session:
            league = session.execute(
                select(leagues_table.c.name).where(leagues_table.c.id == league_id)
            ).scalar_one_or_none()
            if league is None:
                raise LookupError("League not found.")

            session.execute(
                update(league_invites_table)
                .where(
                    league_invites_table.c.league_id == league_id,
                    league_invites_table.c.revoked_at.is_(None),
                )
                .values(revoked_at=now)
            )
            session.execute(
                insert(league_invites_table).values(
                    id=f"invite-{uuid4()}",
                    league_id=league_id,
                    created_by_user_id=user_id,
                    token_hash=hash_invite_token(token),
                    created_at=now,
                )
            )
            available_team_count = self._available_team_count(session, league_id)
            session.commit()
        return InviteCreation(
            token=token,
            league_name=str(league),
            available_team_count=available_team_count,
        )

    def league_summary(self, league_id: str = LEAGUE_ID) -> tuple[str, int]:
        with self._session_factory() as session:
            league_name = session.execute(
                select(leagues_table.c.name).where(leagues_table.c.id == league_id)
            ).scalar_one_or_none()
            if league_name is None:
                raise LookupError("League not found.")
            return str(league_name), self._available_team_count(session, league_id)

    def preview_invite(self, token: str) -> InvitePreview | None:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            row = (
                session.execute(
                    select(
                        league_invites_table.c.league_id,
                        leagues_table.c.name.label("league_name"),
                        league_invites_table.c.expires_at,
                    )
                    .join(leagues_table, leagues_table.c.id == league_invites_table.c.league_id)
                    .where(
                        league_invites_table.c.token_hash == hash_invite_token(token),
                        league_invites_table.c.revoked_at.is_(None),
                    )
                )
                .mappings()
                .first()
            )
            if row is None:
                return None
            expires_at = row["expires_at"]
            if expires_at is not None and expires_at <= now:
                return None
            return InvitePreview(
                league_id=str(row["league_id"]),
                league_name=str(row["league_name"]),
                available_team_count=self._available_team_count(session, str(row["league_id"])),
            )

    def accept_invite(self, token: str, user_id: str) -> LeagueJoin:
        now = datetime.now(UTC)
        with self._session_factory() as session:
            invite = (
                session.execute(
                    select(
                        league_invites_table.c.league_id,
                        leagues_table.c.name.label("league_name"),
                        league_invites_table.c.expires_at,
                    )
                    .join(leagues_table, leagues_table.c.id == league_invites_table.c.league_id)
                    .where(
                        league_invites_table.c.token_hash == hash_invite_token(token),
                        league_invites_table.c.revoked_at.is_(None),
                    )
                )
                .mappings()
                .first()
            )
            if invite is None or (
                invite["expires_at"] is not None and invite["expires_at"] <= now
            ):
                raise LookupError("This invite link is invalid or has expired.")

            league_id = str(invite["league_id"])
            existing = self._team_for_user(session, user_id, league_id)
            if existing is not None:
                session.commit()
                return LeagueJoin(
                    league_id=league_id,
                    league_name=str(invite["league_name"]),
                    team_id=existing["team_id"],
                    team_name=existing["team_name"],
                    already_member=True,
                )

            available = (
                session.execute(
                    select(
                        managers_table.c.id.label("manager_id"),
                        draft_teams_table.c.id.label("team_id"),
                        draft_teams_table.c.name.label("team_name"),
                    )
                    .join(
                        draft_teams_table,
                        draft_teams_table.c.manager_id == managers_table.c.id,
                    )
                    .where(
                        draft_teams_table.c.league_id == league_id,
                        managers_table.c.user_id.is_(None),
                    )
                    .order_by(draft_teams_table.c.name)
                    .with_for_update()
                )
                .mappings()
                .first()
            )
            if available is None:
                raise RuntimeError("This league has no open manager places.")

            session.execute(
                update(managers_table)
                .where(managers_table.c.id == available["manager_id"])
                .values(user_id=user_id)
            )
            session.commit()
            return LeagueJoin(
                league_id=league_id,
                league_name=str(invite["league_name"]),
                team_id=str(available["team_id"]),
                team_name=str(available["team_name"]),
                already_member=False,
            )

    @staticmethod
    def _team_for_user(session: Session, user_id: str, league_id: str) -> object:
        return (
            session.execute(
                select(
                    draft_teams_table.c.id.label("team_id"),
                    draft_teams_table.c.name.label("team_name"),
                )
                .join(managers_table, managers_table.c.id == draft_teams_table.c.manager_id)
                .where(
                    draft_teams_table.c.league_id == league_id,
                    managers_table.c.user_id == user_id,
                )
            )
            .mappings()
            .first()
        )

    @staticmethod
    def _available_team_count(session: Session, league_id: str) -> int:
        rows = session.execute(
            select(managers_table.c.id)
            .join(draft_teams_table, draft_teams_table.c.manager_id == managers_table.c.id)
            .where(
                draft_teams_table.c.league_id == league_id,
                managers_table.c.user_id.is_(None),
            )
        ).all()
        return len(rows)


class InMemoryLeagueMembershipRepository:
    def __init__(self) -> None:
        self._invites: dict[str, str] = {}
        self._members: dict[str, LeagueJoin] = {}
        self._teams = (
            ("castle", "Castle United"),
            ("drafton", "Drafton Rovers"),
            ("keepers", "Keeper City"),
            ("wildcards", "Wildcard Athletic"),
        )

    def access_for_user(self, user_id: str, league_id: str = LEAGUE_ID) -> LeagueAccess | None:
        member = self._members.get(user_id)
        if member is None:
            return None
        return LeagueAccess(
            league_id,
            member.league_name,
            "manager",
            member.team_id,
            member.team_name,
        )

    def create_invite(self, user_id: str, league_id: str = LEAGUE_ID) -> InviteCreation:
        token = secrets.token_urlsafe(32)
        self._invites.clear()
        self._invites[hash_invite_token(token)] = league_id
        return InviteCreation(token, "CDL", self._available_team_count())

    def league_summary(self, league_id: str = LEAGUE_ID) -> tuple[str, int]:
        return "CDL", self._available_team_count()

    def preview_invite(self, token: str) -> InvitePreview | None:
        league_id = self._invites.get(hash_invite_token(token))
        if league_id is None:
            return None
        return InvitePreview(league_id, "CDL", self._available_team_count())

    def accept_invite(self, token: str, user_id: str) -> LeagueJoin:
        preview = self.preview_invite(token)
        if preview is None:
            raise LookupError("This invite link is invalid or has expired.")
        existing = self._members.get(user_id)
        if existing is not None:
            return LeagueJoin(
                existing.league_id,
                existing.league_name,
                existing.team_id,
                existing.team_name,
                True,
            )
        taken = {member.team_id for member in self._members.values()}
        available = next(
            ((team_id, name) for team_id, name in self._teams if team_id not in taken),
            None,
        )
        if available is None:
            raise RuntimeError("This league has no open manager places.")
        joined = LeagueJoin(
            preview.league_id,
            preview.league_name,
            available[0],
            available[1],
            False,
        )
        self._members[user_id] = joined
        return joined

    def _available_team_count(self) -> int:
        taken = {member.team_id for member in self._members.values()}
        return sum(team_id not in taken for team_id, _ in self._teams)
