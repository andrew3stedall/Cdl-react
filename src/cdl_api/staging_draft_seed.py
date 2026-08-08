"""Deterministic staging league and position-constrained snake-draft seed.

The primary ranking is copied from ``andrew3stedall/-static--cdl`` at commit
``711455f4dac079810fd4d4d71f707f1c6c7a92b6``. The original top-160 pool
contains only 13 goalkeepers, which cannot satisfy eight squads requiring at
least two goalkeepers each. Three later reviewed goalkeeper candidates are
therefore appended as a staging-only eligibility buffer; the mock draft still
selects exactly 160 players across eight 20-player squads.
"""

from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import delete, insert, select, update
from sqlalchemy.orm import Session

from cdl_api.repositories.postgres_auth import users_table
from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    epl_teams_table,
    fpl_players_table,
    fpl_positions_table,
    league_memberships_table,
    leagues_table,
    managers_table,
    seasons_table,
)
from cdl_api.repositories.postgres_squad import (
    squad_ownerships_table,
    squad_roster_slots_table,
)

LEAGUE_ID = "league-cdl-2026-27"
SEASON_ID = "season-cdl-2026-27"
PRIMARY_MANAGER_ID = "manager-1"
PRIMARY_TEAM_ID = "team-exeter-gently"
PRIMARY_MANAGER_EMAIL = "andrew3stedall@gmail.com"

TEAM_NAMES = (
    "Exeter Gently",
    "Stan Still Sells Tik",
    "Koden All Stars",
    "Dicks Dribbling XI",
    "Sporting Lesbians",
    "Bayer Neverlusen",
    "Wilde Boars",
    "Class of 84",
)

TEAM_IDS = (
    PRIMARY_TEAM_ID,
    "team-stan-still-sells-tik",
    "team-koden-all-stars",
    "team-dicks-dribbling-xi",
    "team-sporting-lesbians",
    "team-bayer-neverlusen",
    "team-wilde-boars",
    "team-class-of-84",
)

SQUAD_SIZE = 20
POSITION_LIMITS = {
    "GKP": (2, 3),
    "DEF": (4, 10),
    "MID": (5, 10),
    "FWD": (2, 4),
}
TOTAL_DRAFT_PICKS = len(TEAM_IDS) * SQUAD_SIZE

EPL_TEAM_NAMES = {
    "ARS": "Arsenal",
    "AVL": "Aston Villa",
    "BHA": "Brighton & Hove Albion",
    "BOU": "Bournemouth",
    "BRE": "Brentford",
    "CHE": "Chelsea",
    "CRY": "Crystal Palace",
    "EVE": "Everton",
    "FUL": "Fulham",
    "LEE": "Leeds United",
    "LIV": "Liverpool",
    "MCI": "Manchester City",
    "MUN": "Manchester United",
    "NEW": "Newcastle United",
    "NFO": "Nottingham Forest",
    "SUN": "Sunderland",
    "TOT": "Tottenham Hotspur",
}

_DRAFT_BOARD_TEXT = """
1|Haaland|FWD|MCI|411
2|Palmer|MID|CHE|154
3|Saka|MID|ARS|12
4|Isak|FWD|LIV|379
5|B.Fernandes|MID|MUN|426
6|Watkins|FWD|AVL|55
7|Thiago|FWD|BRE|106
8|Gabriel|DEF|ARS|4
9|Gyökeres|FWD|ARS|25
10|Mbeumo|MID|MUN|427
11|João Pedro|FWD|CHE|165
12|Cunha|MID|MUN|428
13|Wirtz|MID|LIV|366
14|Semenyo|MID|MCI|397
15|Foden|MID|MCI|398
16|Gibbs-White|MID|NFO|480
17|Rogers|MID|CHE|40
18|Gakpo|MID|LIV|367
19|Eze|MID|ARS|14
20|Kluivert|MID|BOU|70
21|Mateta|FWD|CRY|223
22|Ødegaard|MID|ARS|15
23|Tavernier|MID|BOU|68
24|Szoboszlai|MID|LIV|368
25|Damsgaard|MID|BRE|96
26|Muñoz|DEF|CRY|201
27|Solanke|FWD|TOT|526
28|Bruno G.|MID|NEW|452
29|Cherki|MID|MCI|399
30|O.Dango|MID|BRE|95
31|Rice|MID|ARS|13
32|Virgil|DEF|LIV|356
33|Dewsbury-Hall|MID|EVE|236
34|Calvert-Lewin|FWD|LEE|346
35|Ndiaye|MID|EVE|237
36|Schade|MID|BRE|94
37|Marmoush|FWD|MCI|401
38|Doku|MID|MCI|400
39|E.Le Fée|MID|SUN|542
40|Enzo|MID|CHE|155
41|Gvardiol|DEF|MCI|391
42|Guéhi|DEF|MCI|388
43|Maddison|MID|TOT|515
44|Sarr|MID|CRY|208
45|Minteh|MID|BHA|122
46|Kudus|MID|TOT|512
47|Pedro Porro|DEF|TOT|499
48|Evanilson|FWD|BOU|79
49|Martinelli|MID|ARS|18
50|Šeško|FWD|MUN|439
51|Wood|FWD|NFO|490
52|Neto|MID|CHE|156
53|Wissa|FWD|NEW|464
54|Barnes|MID|NEW|453
55|Amad|MID|MUN|431
56|Rashford|MID|MUN|429
57|McNeil|MID|EVE|241
58|Woltemade|FWD|NEW|463
59|Mitoma|MID|BHA|121
60|Romero|DEF|TOT|500
61|James|DEF|CHE|142
62|Richarlison|FWD|TOT|527
63|Tel|MID|TOT|514
64|Savinho|MID|MCI|403
65|Estêvão|MID|CHE|157
66|Dorgu|MID|MUN|415
67|Iwobi|MID|FUL|261
68|Frimpong|DEF|LIV|357
69|Wilson|MID|LEE|260
70|Delap|FWD|CHE|167
71|Elanga|MID|NEW|454
72|Havertz|FWD|ARS|26
73|Brobbey|FWD|SUN|552
74|Muniz|FWD|FUL|271
75|J.Murphy|MID|NEW|457
76|Raya|GKP|ARS|1
77|Smith Rowe|MID|FUL|262
78|Kerkez|DEF|LIV|358
79|Gnonto|MID|LEE|341
80|Hudson-Odoi|MID|NFO|482
81|Strand Larsen|FWD|CRY|222
82|Calafiori|DEF|ARS|8
83|Tarkowski|DEF|EVE|229
84|Donnarumma|GKP|MCI|384
85|Saliba|DEF|ARS|6
86|Rayan|MID|BOU|67
87|Beto|FWD|EVE|248
88|Stach|MID|LEE|335
89|Xhaka|MID|SUN|544
90|Nketiah|FWD|CRY|224
91|J.Timber|DEF|ARS|5
92|Okafor|MID|LEE|336
93|Groß|MID|BHA|124
94|Fernandes|MID|TOT|525
95|O'Reilly|DEF|MCI|387
96|Vicario|GKP|TOT|494
97|Aït-Nouri|DEF|MCI|392
98|Reijnders|MID|MCI|404
99|Truffert|DEF|BOU|61
100|Garnacho|MID|AVL|160
101|Mukiele|DEF|SUN|533
102|Van de Ven|DEF|TOT|503
103|Mac Allister|MID|LIV|372
104|Mitchell|DEF|CRY|204
105|Roefs|GKP|SUN|529
106|Anderson|MID|MCI|481
107|Jensen|MID|BRE|97
108|Welbeck|FWD|BHA|136
109|A.Becker|GKP|LIV|350
110|Igor Jesus|FWD|NFO|491
111|McGinn|MID|AVL|45
112|Hall|DEF|NEW|449
113|Robinson|DEF|FUL|254
114|Collins|DEF|BRE|84
115|Pickford|GKP|EVE|226
116|Lammens|GKP|MUN|412
117|Aaronson|MID|LEE|337
118|Gusto|DEF|CHE|144
119|Petrović|GKP|BOU|57
120|Ndoye|MID|NFO|483
121|Lewis-Potter|MID|BRE|86
122|Mykolenko|DEF|EVE|233
123|Ballard|DEF|SUN|532
124|Sessegnon|DEF|FUL|269
125|Tete|DEF|FUL|256
126|Scott|MID|BOU|69
127|Livramento|DEF|NEW|450
128|Adingra|MID|SUN|546
129|Brooks|MID|BOU|74
130|Pope|GKP|NEW|442
131|Sánchez|GKP|CHE|140
132|Dunk|DEF|BHA|116
133|Bogle|DEF|LEE|330
134|Hincapie|DEF|ARS|9
135|Barry|FWD|EVE|249
136|Garner|MID|EVE|239
137|Zubimendi|MID|ARS|19
138|De Cuyper|DEF|BHA|115
139|Aina|DEF|NFO|473
140|Bijol|DEF|LEE|327
141|Maguire|DEF|MUN|418
142|Verbruggen|GKP|BHA|109
143|Senesi|DEF|TOT|498
144|Kelleher|GKP|BRE|82
145|Kayode|DEF|BRE|88
146|Bobb|MID|FUL|264
147|Chalobah|DEF|CHE|143
148|F.Kadıoğlu|DEF|BHA|113
149|Shaw|DEF|MUN|423
150|Cash|DEF|AVL|32
151|Leno|GKP|FUL|250
152|King|MID|FUL|268
153|Dalot|DEF|MUN|417
154|Hutchinson|MID|NFO|484
155|Ekitiké|FWD|LIV|380
156|Gravenberch|MID|LIV|371
157|Hume|DEF|SUN|534
158|Van Hecke|DEF|TOT|112
159|Sadiki|MID|SUN|545
160|Struijk|DEF|BHA|328
""".strip()

# Staging-only eligibility buffer. These are reviewed goalkeeper candidates from
# the current static-CDL goalkeeper ordering; their artificial pool ranks preserve
# the original top-160 order while making a legal eight-team mock draft possible.
_SUPPLEMENTAL_GOALKEEPERS_TEXT = """
161|Henderson|GKP|CRY|198
162|Sels|GKP|NFO|467
163|Martinez|GKP|AVL|28
""".strip()


@dataclass(frozen=True)
class DraftBoardPlayer:
    rank: int
    name: str
    position: str
    epl_team: str
    fpl_id: int


@dataclass(frozen=True)
class DraftAllocation:
    overall_pick: int
    team_index: int
    player: DraftBoardPlayer


@dataclass(frozen=True)
class DraftSeedResult:
    teams: int
    players: int
    ownerships: int
    position_counts: tuple[tuple[int, int, int, int], ...]


def draft_board() -> tuple[DraftBoardPlayer, ...]:
    pool_text = _DRAFT_BOARD_TEXT + "\n" + _SUPPLEMENTAL_GOALKEEPERS_TEXT
    players = tuple(
        DraftBoardPlayer(int(rank), name, position, team, int(fpl_id))
        for rank, name, position, team, fpl_id in (
            line.split("|") for line in pool_text.splitlines()
        )
    )
    if len(players) != 163 or len({player.fpl_id for player in players}) != 163:
        raise ValueError("The staging draft pool must contain 163 unique players.")
    if [player.rank for player in players] != list(range(1, 164)):
        raise ValueError("The staging draft pool ranks must be contiguous from 1 to 163.")
    goalkeeper_count = Counter(player.position for player in players)["GKP"]
    required_goalkeepers = POSITION_LIMITS["GKP"][0] * len(TEAM_IDS)
    if goalkeeper_count < required_goalkeepers:
        raise ValueError("The staging draft pool does not contain enough goalkeepers.")
    return players


def snake_team_index(overall_pick: int, manager_count: int = 8) -> int:
    """Return the zero-based team index for a one-based snake-draft pick."""
    if overall_pick < 1:
        raise ValueError("overall_pick must be positive")
    round_number, offset = divmod(overall_pick - 1, manager_count)
    return offset if round_number % 2 == 0 else manager_count - 1 - offset


def _minimum_deficit(counts: Counter[str]) -> int:
    return sum(
        max(0, minimum - counts[position])
        for position, (minimum, _) in POSITION_LIMITS.items()
    )


def _candidate_keeps_draft_feasible(
    candidate: DraftBoardPlayer,
    team_index: int,
    team_counts: list[Counter[str]],
    team_pick_counts: list[int],
    remaining_players: list[DraftBoardPlayer],
    overall_pick: int,
) -> bool:
    _, candidate_maximum = POSITION_LIMITS[candidate.position]
    if team_counts[team_index][candidate.position] >= candidate_maximum:
        return False

    projected_counts = [counts.copy() for counts in team_counts]
    projected_counts[team_index][candidate.position] += 1
    projected_team_pick_count = team_pick_counts[team_index] + 1
    local_slots_left = SQUAD_SIZE - projected_team_pick_count
    if _minimum_deficit(projected_counts[team_index]) > local_slots_left:
        return False

    positions_left = Counter(player.position for player in remaining_players)
    positions_left[candidate.position] -= 1
    aggregate_minimum_deficit = {
        position: sum(max(0, minimum - counts[position]) for counts in projected_counts)
        for position, (minimum, _) in POSITION_LIMITS.items()
    }
    if any(
        positions_left[position] < aggregate_minimum_deficit[position]
        for position in POSITION_LIMITS
    ):
        return False

    selections_left = TOTAL_DRAFT_PICKS - overall_pick
    undrafted_slots = len(remaining_players) - 1 - selections_left
    for position, (_, maximum) in POSITION_LIMITS.items():
        available_capacity = sum(maximum - counts[position] for counts in projected_counts)
        forced_position_selections = max(0, positions_left[position] - undrafted_slots)
        if forced_position_selections > available_capacity:
            return False

    return True


def constrained_snake_allocation(
    players: tuple[DraftBoardPlayer, ...] | None = None,
) -> tuple[DraftAllocation, ...]:
    """Draft the highest-ranked eligible player at each snake pick.

    Eligibility enforces each team's positional maximum while preserving enough
    remaining slots and players for every team to reach every positional minimum.
    """
    remaining_players = list(players or draft_board())
    team_counts = [Counter() for _ in TEAM_IDS]
    team_pick_counts = [0] * len(TEAM_IDS)
    allocations: list[DraftAllocation] = []

    for overall_pick in range(1, TOTAL_DRAFT_PICKS + 1):
        team_index = snake_team_index(overall_pick, len(TEAM_IDS))
        candidate_index = next(
            (
                index
                for index, candidate in enumerate(remaining_players)
                if _candidate_keeps_draft_feasible(
                    candidate,
                    team_index,
                    team_counts,
                    team_pick_counts,
                    remaining_players,
                    overall_pick,
                )
            ),
            None,
        )
        if candidate_index is None:
            raise ValueError(
                f"No legal player remains for mock-draft pick {overall_pick} "
                f"({TEAM_NAMES[team_index]})."
            )
        player = remaining_players.pop(candidate_index)
        team_counts[team_index][player.position] += 1
        team_pick_counts[team_index] += 1
        allocations.append(DraftAllocation(overall_pick, team_index, player))

    validate_draft_allocations(tuple(allocations))
    return tuple(allocations)


def allocation_position_counts(
    allocations: tuple[DraftAllocation, ...],
) -> tuple[tuple[int, int, int, int], ...]:
    counts = [Counter() for _ in TEAM_IDS]
    for allocation in allocations:
        counts[allocation.team_index][allocation.player.position] += 1
    return tuple(
        (
            team_counts["GKP"],
            team_counts["DEF"],
            team_counts["MID"],
            team_counts["FWD"],
        )
        for team_counts in counts
    )


def validate_draft_allocations(allocations: tuple[DraftAllocation, ...]) -> None:
    if len(allocations) != TOTAL_DRAFT_PICKS:
        raise ValueError(f"Mock draft must contain exactly {TOTAL_DRAFT_PICKS} selections.")
    player_ids = [allocation.player.fpl_id for allocation in allocations]
    if len(set(player_ids)) != len(player_ids):
        raise ValueError("Mock draft cannot assign the same player more than once.")

    position_counts = allocation_position_counts(allocations)
    for team_index, counts_tuple in enumerate(position_counts):
        counts = dict(zip(("GKP", "DEF", "MID", "FWD"), counts_tuple, strict=True))
        if sum(counts.values()) != SQUAD_SIZE:
            raise ValueError(f"{TEAM_NAMES[team_index]} must have exactly {SQUAD_SIZE} players.")
        for position, (minimum, maximum) in POSITION_LIMITS.items():
            if not minimum <= counts[position] <= maximum:
                raise ValueError(
                    f"{TEAM_NAMES[team_index]} has invalid {position} count {counts[position]} "
                    f"(allowed {minimum}-{maximum})."
                )


def _upsert(session: Session, table: object, values: dict[str, object]) -> None:
    row_id = values["id"]
    exists = session.execute(select(table.c.id).where(table.c.id == row_id)).scalar_one_or_none()
    if exists is None:
        session.execute(insert(table).values(**values))
    else:
        session.execute(update(table).where(table.c.id == row_id).values(**values))


def seed_staging_snake_draft(session_factory: object) -> DraftSeedResult:
    """Atomically empty and repopulate the controlled 2026/27 staging squads."""
    players = draft_board()
    allocations = constrained_snake_allocation(players)
    drafted_at = datetime(2026, 8, 8, tzinfo=UTC)

    with session_factory() as session:
        _upsert(session, leagues_table, {"id": LEAGUE_ID, "name": "CDL", "code": "CDL-2627"})
        _upsert(
            session,
            seasons_table,
            {
                "id": SEASON_ID,
                "league_id": LEAGUE_ID,
                "name": "2026/27",
                "start_gameweek": 1,
                "end_gameweek": 38,
            },
        )

        primary_user = (
            session.execute(
                select(users_table.c.id, users_table.c.display_name).where(
                    users_table.c.email == PRIMARY_MANAGER_EMAIL
                )
            )
            .mappings()
            .one_or_none()
        )
        for index, (team_id, team_name) in enumerate(zip(TEAM_IDS, TEAM_NAMES, strict=True), 1):
            manager_id = f"manager-{index}"
            manager_name = (
                primary_user["display_name"]
                if index == 1 and primary_user is not None
                else f"Manager {index}"
            )
            _upsert(
                session,
                managers_table,
                {
                    "id": manager_id,
                    "user_id": primary_user["id"] if index == 1 and primary_user else None,
                    "display_name": manager_name,
                },
            )
            _upsert(
                session,
                draft_teams_table,
                {
                    "id": team_id,
                    "league_id": LEAGUE_ID,
                    "manager_id": manager_id,
                    "name": team_name,
                },
            )
            _upsert(
                session,
                league_memberships_table,
                {
                    "id": f"membership-{index}",
                    "league_id": LEAGUE_ID,
                    "manager_id": manager_id,
                    "role": "manager",
                },
            )

        for position_id, singular, plural in (
            ("GKP", "Goalkeeper", "Goalkeepers"),
            ("DEF", "Defender", "Defenders"),
            ("MID", "Midfielder", "Midfielders"),
            ("FWD", "Forward", "Forwards"),
        ):
            _upsert(
                session,
                fpl_positions_table,
                {"id": position_id, "singular_name": singular, "plural_name": plural},
            )
        for short_name in sorted({player.epl_team for player in players}):
            _upsert(
                session,
                epl_teams_table,
                {
                    "id": f"epl-{short_name.lower()}",
                    "short_name": short_name,
                    "name": EPL_TEAM_NAMES[short_name],
                },
            )
        for player in players:
            _upsert(
                session,
                fpl_players_table,
                {
                    "id": f"fpl-{player.fpl_id}",
                    "first_name": "",
                    "second_name": player.name,
                    "web_name": player.name,
                    "position_id": player.position,
                    "team_id": f"epl-{player.epl_team.lower()}",
                },
            )

        # The reset and replacement happen in one transaction so staging never
        # exposes a partially drafted league if validation or insertion fails.
        session.execute(
            delete(squad_ownerships_table).where(squad_ownerships_table.c.season_id == SEASON_ID)
        )
        session.execute(
            delete(squad_roster_slots_table).where(
                squad_roster_slots_table.c.season_id == SEASON_ID
            )
        )
        for team_id in TEAM_IDS:
            for slot_number in range(1, SQUAD_SIZE + 1):
                session.execute(
                    insert(squad_roster_slots_table).values(
                        id=f"slot-{team_id.removeprefix('team-')}-{slot_number:02d}",
                        season_id=SEASON_ID,
                        draft_team_id=team_id,
                        slot_key=f"squad-{slot_number:02d}",
                        position_id=None,
                        sort_order=slot_number,
                        is_required=True,
                    )
                )

        slots_used = [0] * len(TEAM_IDS)
        for allocation in allocations:
            slots_used[allocation.team_index] += 1
            team_id = TEAM_IDS[allocation.team_index]
            slot_id = (
                f"slot-{team_id.removeprefix('team-')}-{slots_used[allocation.team_index]:02d}"
            )
            session.execute(
                insert(squad_ownerships_table).values(
                    id=f"ownership-pick-{allocation.overall_pick:03d}",
                    season_id=SEASON_ID,
                    draft_team_id=team_id,
                    player_id=f"fpl-{allocation.player.fpl_id}",
                    roster_slot_id=slot_id,
                    started_at=drafted_at,
                    ended_at=None,
                )
            )
        if slots_used != [SQUAD_SIZE] * len(TEAM_IDS):
            raise ValueError("Mock draft must assign exactly 20 players to every team.")
        session.commit()

    return DraftSeedResult(
        teams=len(TEAM_IDS),
        players=len(allocations),
        ownerships=len(allocations),
        position_counts=allocation_position_counts(allocations),
    )
