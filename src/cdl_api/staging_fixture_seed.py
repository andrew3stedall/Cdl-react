"""The reviewed 2026/27 staging league fixture schedule."""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable, Iterable
from dataclasses import dataclass

from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.domain import GameweekSummary, TeamSummary
from cdl_api.contracts.league_models import (
    FixtureOutcome,
    FixtureScore,
    FixtureStatus,
    LeagueFixture,
)
from cdl_api.repositories.postgres_league_fixtures import (
    cdl_fixtures_table,
    fixture_results_table,
    fixture_scoring_snapshots_table,
)
from cdl_api.repositories.postgres_league_fpl import draft_teams_table
from cdl_api.staging_draft_seed import LEAGUE_ID

SCHEDULE_ID_PREFIX = "staging-schedule-"
START_GAMEWEEK = 1
END_GAMEWEEK = 35
ROUNDS_PER_CYCLE = 7

# These are the labels shown in the supplied fixture schedule. The current
# staging draft uses canonical names for three of the labels and retains the
# existing Dicks team slot for the source schedule's Bumbling Gits label.
SOURCE_TEAM_NAMES = (
    "Bumbling Gits",
    "Stan Still Sells Tik",
    "The Class of 84",
    "Koden All Stars",
    "Exeter Gently",
    "Sporting Lesbians",
    "Wilde Boars FC",
    "Bayer Neverlusen",
)

SOURCE_TO_CANONICAL_NAME = {
    "Bumbling Gits": "Dicks Dribbling XI",
    "Stan Still Sells Tik": "Stan Still Sells Tik",
    "The Class of 84": "Class of 84",
    "Koden All Stars": "Koden All Stars",
    "Exeter Gently": "Exeter Gently",
    "Sporting Lesbians": "Sporting Lesbians",
    "Wilde Boars FC": "Wilde Boars",
    "Bayer Neverlusen": "Bayer Neverlusen",
}

# Seven weeks form one complete round-robin cycle. The same seven-week order
# is repeated for gameweeks 8-14, 15-21, 22-28, and 29-35.
BASE_ROUND_ROBIN: tuple[tuple[tuple[str, str], ...], ...] = (
    (
        ("Bumbling Gits", "Stan Still Sells Tik"),
        ("The Class of 84", "Koden All Stars"),
        ("Exeter Gently", "Sporting Lesbians"),
        ("Wilde Boars FC", "Bayer Neverlusen"),
    ),
    (
        ("Koden All Stars", "Bumbling Gits"),
        ("Sporting Lesbians", "Stan Still Sells Tik"),
        ("Bayer Neverlusen", "The Class of 84"),
        ("Wilde Boars FC", "Exeter Gently"),
    ),
    (
        ("Bumbling Gits", "Sporting Lesbians"),
        ("Koden All Stars", "Bayer Neverlusen"),
        ("Stan Still Sells Tik", "Wilde Boars FC"),
        ("The Class of 84", "Exeter Gently"),
    ),
    (
        ("Bayer Neverlusen", "Bumbling Gits"),
        ("Wilde Boars FC", "Sporting Lesbians"),
        ("Exeter Gently", "Koden All Stars"),
        ("The Class of 84", "Stan Still Sells Tik"),
    ),
    (
        ("Bumbling Gits", "Wilde Boars FC"),
        ("Bayer Neverlusen", "Exeter Gently"),
        ("Sporting Lesbians", "The Class of 84"),
        ("Koden All Stars", "Stan Still Sells Tik"),
    ),
    (
        ("Exeter Gently", "Bumbling Gits"),
        ("The Class of 84", "Wilde Boars FC"),
        ("Stan Still Sells Tik", "Bayer Neverlusen"),
        ("Koden All Stars", "Sporting Lesbians"),
    ),
    (
        ("Bumbling Gits", "The Class of 84"),
        ("Exeter Gently", "Stan Still Sells Tik"),
        ("Wilde Boars FC", "Koden All Stars"),
        ("Bayer Neverlusen", "Sporting Lesbians"),
    ),
)


@dataclass(frozen=True)
class StagingFixtureSeedResult:
    """Counts produced by the idempotent fixture import."""

    gameweeks: int
    fixtures: int
    teams: int


@dataclass(frozen=True)
class StagingFixture:
    """A source schedule row before it is resolved to staging team IDs."""

    gameweek: int
    cycle_round: int
    match_number: int
    home_team: str
    away_team: str

    @property
    def id(self) -> str:
        return f"{SCHEDULE_ID_PREFIX}gw-{self.gameweek:02d}-match-{self.match_number}"


def _pair_key(home_team: str, away_team: str) -> frozenset[str]:
    return frozenset((home_team, away_team))


def _schedule_rows() -> tuple[StagingFixture, ...]:
    return tuple(
        StagingFixture(
            gameweek=gameweek,
            cycle_round=((gameweek - 1) % ROUNDS_PER_CYCLE) + 1,
            match_number=match_number,
            home_team=home_team,
            away_team=away_team,
        )
        for gameweek in range(START_GAMEWEEK, END_GAMEWEEK + 1)
        for match_number, (home_team, away_team) in enumerate(
            BASE_ROUND_ROBIN[(gameweek - 1) % ROUNDS_PER_CYCLE],
            start=1,
        )
    )


STAGING_FIXTURE_SCHEDULE = _schedule_rows()


def validate_staging_fixture_schedule(
    schedule: Iterable[StagingFixture] = STAGING_FIXTURE_SCHEDULE,
) -> None:
    """Reject missing teams, duplicate weekly participants, and bad repeats."""

    rows = tuple(schedule)
    expected_fixture_count = (END_GAMEWEEK - START_GAMEWEEK + 1) * 4
    if len(rows) != expected_fixture_count:
        raise ValueError(f"Staging schedule must contain {expected_fixture_count} fixtures.")

    by_gameweek: dict[int, list[StagingFixture]] = {}
    pair_counts: Counter[frozenset[str]] = Counter()
    for row in rows:
        if row.home_team == row.away_team:
            raise ValueError(f"Gameweek {row.gameweek} contains a team playing itself.")
        if row.home_team not in SOURCE_TEAM_NAMES or row.away_team not in SOURCE_TEAM_NAMES:
            raise ValueError(f"Unknown team in gameweek {row.gameweek}.")
        by_gameweek.setdefault(row.gameweek, []).append(row)
        pair_counts[_pair_key(row.home_team, row.away_team)] += 1

    expected_gameweeks = set(range(START_GAMEWEEK, END_GAMEWEEK + 1))
    if set(by_gameweek) != expected_gameweeks:
        raise ValueError("Staging schedule must cover gameweeks 1 through 35 exactly.")

    for gameweek, rows_for_gameweek in by_gameweek.items():
        if len(rows_for_gameweek) != 4:
            raise ValueError(f"Gameweek {gameweek} must contain exactly four fixtures.")
        participants = [
            participant
            for row in rows_for_gameweek
            for participant in (row.home_team, row.away_team)
        ]
        if len(set(participants)) != len(SOURCE_TEAM_NAMES):
            raise ValueError(f"Gameweek {gameweek} must contain each team exactly once.")

    expected_pair_count = (END_GAMEWEEK - START_GAMEWEEK + 1) // ROUNDS_PER_CYCLE
    expected_pairs = len(SOURCE_TEAM_NAMES) * (len(SOURCE_TEAM_NAMES) - 1) // 2
    if len(pair_counts) != expected_pairs or set(pair_counts.values()) != {expected_pair_count}:
        raise ValueError("Each pair of teams must meet once per seven-week cycle.")


def _normalise_name(value: object) -> str:
    return " ".join(str(value).casefold().split())


def _resolve_team_ids(session: Session) -> dict[str, str]:
    active_rows = list(
        session.execute(
            select(draft_teams_table.c.id, draft_teams_table.c.name).where(
                draft_teams_table.c.league_id == LEAGUE_ID
            )
        ).mappings()
    )
    names_to_ids = {
        _normalise_name(row["name"]): str(row["id"])
        for row in active_rows
        if row["name"] is not None
    }
    resolved: dict[str, str] = {}
    for source_name in SOURCE_TEAM_NAMES:
        canonical_name = SOURCE_TO_CANONICAL_NAME[source_name]
        team_id = names_to_ids.get(_normalise_name(source_name)) or names_to_ids.get(
            _normalise_name(canonical_name)
        )
        if team_id is None:
            raise RuntimeError(
                f"Cannot resolve fixture team {source_name!r} in the active staging league."
            )
        resolved[source_name] = team_id

    if len(set(resolved.values())) != len(resolved):
        raise RuntimeError("Fixture source labels resolved to duplicate staging team IDs.")
    return resolved


def seed_staging_fixture_schedule(
    session_factory: Callable[[], Session],
    *,
    schedule: Iterable[StagingFixture] = STAGING_FIXTURE_SCHEDULE,
) -> StagingFixtureSeedResult:
    """Replace only this import's rows with the validated 35-gameweek schedule."""

    validate_staging_fixture_schedule(schedule)
    rows = tuple(schedule)
    with session_factory() as session:
        source_to_team_id = _resolve_team_ids(session)

        session.execute(
            delete(fixture_scoring_snapshots_table).where(
                fixture_scoring_snapshots_table.c.id.like(f"snapshot-{SCHEDULE_ID_PREFIX}%")
            )
        )
        session.execute(
            delete(fixture_results_table).where(
                fixture_results_table.c.id.like(f"result-{SCHEDULE_ID_PREFIX}%")
            )
        )
        session.execute(
            delete(cdl_fixtures_table).where(cdl_fixtures_table.c.id.like(f"{SCHEDULE_ID_PREFIX}%"))
        )

        for row in rows:
            home_team = TeamSummary(
                id=source_to_team_id[row.home_team],
                name=row.home_team,
            )
            away_team = TeamSummary(
                id=source_to_team_id[row.away_team],
                name=row.away_team,
            )
            fixture = LeagueFixture(
                id=row.id,
                gameweek=GameweekSummary(
                    id=f"gw-{row.gameweek}",
                    name=f"Gameweek {row.gameweek}",
                    number=row.gameweek,
                ),
                home_team=home_team,
                away_team=away_team,
                status=FixtureStatus.PENDING,
                kickoff_label=f"Gameweek {row.gameweek}",
                round_label="Regular season",
                is_next=row.gameweek == START_GAMEWEEK,
                score=FixtureScore(outcome=FixtureOutcome.PENDING),
            )
            fixture_payload = fixture.model_dump(mode="json", exclude={"score"})
            fixture_payload.update(
                {
                    "source_schedule_round": row.cycle_round,
                    "source_schedule_team_names": {
                        "home": row.home_team,
                        "away": row.away_team,
                    },
                    "synthetic": True,
                }
            )
            session.execute(
                insert(cdl_fixtures_table).values(
                    id=row.id,
                    payload_json=fixture_payload,
                )
            )
            session.execute(
                insert(fixture_results_table).values(
                    id=f"result-{row.id}",
                    payload_json={
                        "fixture_id": row.id,
                        "home_score": None,
                        "away_score": None,
                        "outcome": FixtureOutcome.PENDING.value,
                        "synthetic": True,
                    },
                )
            )
            session.execute(
                insert(fixture_scoring_snapshots_table).values(
                    id=f"snapshot-{row.id}",
                    payload_json={
                        "fixture_id": row.id,
                        "bonus_points": {},
                        "chips_played": {},
                        "epl_fixture_ids": [],
                        "synthetic": True,
                    },
                )
            )
        session.commit()

    return StagingFixtureSeedResult(
        gameweeks=END_GAMEWEEK - START_GAMEWEEK + 1,
        fixtures=len(rows),
        teams=len(SOURCE_TEAM_NAMES),
    )
