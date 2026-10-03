"""Private user notes and public-to-league ownership periods."""

from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    MetaData,
    String,
    Table,
    Text,
    delete,
    insert,
    select,
    update,
)
from sqlalchemy.orm import Session

from cdl_api.contracts.scouting import (
    OwnershipHistory,
    OwnershipPeriod,
    ScoutingNote,
    ScoutingNoteUpdate,
)
from cdl_api.repositories.postgres_auth import users_table
from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    fpl_players_table,
    seasons_table,
)
from cdl_api.repositories.postgres_squad import squad_ownerships_table

metadata = MetaData()
private_scouting_table = Table(
    "private_player_scouting",
    metadata,
    Column("user_id", String(64), primary_key=True),
    Column("player_id", String(64), primary_key=True),
    Column("watchlisted", Boolean(), nullable=False),
    Column("note", Text(), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)


class PrivateScoutingRepository:
    def __init__(
        self, session_factory: Callable[[], Session], user_id: str, league_id: str
    ) -> None:
        self._session_factory = session_factory
        self._user_id = user_id
        self._league_id = league_id

    def get_note(self, player_id: str) -> ScoutingNote:
        with self._session_factory() as session:
            self._require_player(session, player_id)
            row = (
                session.execute(
                    select(private_scouting_table).where(
                        private_scouting_table.c.user_id == self._user_id,
                        private_scouting_table.c.player_id == player_id,
                    )
                )
                .mappings()
                .first()
            )
        return ScoutingNote.model_validate(dict(row)) if row else ScoutingNote(player_id=player_id)

    def list_watchlist(self) -> list[ScoutingNote]:
        with self._session_factory() as session:
            rows = (
                session.execute(
                    select(private_scouting_table)
                    .where(
                        private_scouting_table.c.user_id == self._user_id,
                        private_scouting_table.c.watchlisted.is_(True),
                    )
                    .order_by(
                        private_scouting_table.c.updated_at.desc(),
                        private_scouting_table.c.player_id,
                    )
                )
                .mappings()
                .all()
            )
        return [ScoutingNote.model_validate(dict(row)) for row in rows]

    def save_note(self, player_id: str, payload: ScoutingNoteUpdate) -> ScoutingNote:
        now = datetime.now(UTC)
        with self._session_factory() as session, session.begin():
            # Serialize one user's upserts without allowing a client-supplied owner.
            session.execute(
                select(users_table.c.id).where(users_table.c.id == self._user_id).with_for_update()
            ).scalar_one()
            self._require_player(session, player_id)
            predicate = (private_scouting_table.c.user_id == self._user_id) & (
                private_scouting_table.c.player_id == player_id
            )
            values = dict(
                watchlisted=payload.watchlisted, note=payload.note.strip(), updated_at=now
            )
            if not payload.watchlisted and not payload.note.strip():
                session.execute(delete(private_scouting_table).where(predicate))
            else:
                changed = session.execute(
                    update(private_scouting_table).where(predicate).values(**values)
                )
                if changed.rowcount == 0:
                    session.execute(
                        insert(private_scouting_table).values(
                            user_id=self._user_id, player_id=player_id, **values
                        )
                    )
        return ScoutingNote(
            player_id=player_id,
            watchlisted=payload.watchlisted,
            note=payload.note.strip(),
            updated_at=now,
        )

    def ownership_history(self, player_id: str) -> OwnershipHistory:
        with self._session_factory() as session:
            self._require_player(session, player_id)
            rows = (
                session.execute(
                    select(
                        squad_ownerships_table.c.id,
                        squad_ownerships_table.c.season_id,
                        seasons_table.c.name.label("season_name"),
                        squad_ownerships_table.c.draft_team_id.label("team_id"),
                        draft_teams_table.c.name.label("team_name"),
                        squad_ownerships_table.c.started_at,
                        squad_ownerships_table.c.ended_at,
                    )
                    .join(
                        draft_teams_table,
                        draft_teams_table.c.id == squad_ownerships_table.c.draft_team_id,
                    )
                    .join(seasons_table, seasons_table.c.id == squad_ownerships_table.c.season_id)
                    .where(
                        squad_ownerships_table.c.player_id == player_id,
                        draft_teams_table.c.league_id == self._league_id,
                        seasons_table.c.league_id == self._league_id,
                    )
                    .order_by(
                        squad_ownerships_table.c.started_at.desc(), squad_ownerships_table.c.id
                    )
                )
                .mappings()
                .all()
            )
        return OwnershipHistory(
            player_id=player_id, periods=[OwnershipPeriod.model_validate(dict(row)) for row in rows]
        )

    @staticmethod
    def _require_player(session: Session, player_id: str) -> None:
        if (
            session.execute(
                select(fpl_players_table.c.id).where(fpl_players_table.c.id == player_id)
            ).first()
            is None
        ):
            raise LookupError("Player not found.")
