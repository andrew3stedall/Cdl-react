"""Seed the completed 160-pick CDL draft captured from the draft board."""

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

# The staging league is a controlled review fixture. The two reviewer emails
# are read from the protected Google sign-in allowlist at seed time; they are
# intentionally not committed to this public repository.
STAGING_MANAGER_TEAM_IDS = (
    "team-stan-still-sells-tik",
    "team-wilde-boars",
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
    "COV": "Coventry City",
    "CRY": "Crystal Palace",
    "EVE": "Everton",
    "FUL": "Fulham",
    "HUL": "Hull City",
    "IPS": "Ipswich Town",
    "LEE": "Leeds United",
    "LIV": "Liverpool",
    "MCI": "Manchester City",
    "MUN": "Manchester United",
    "NEW": "Newcastle United",
    "NFO": "Nottingham Forest",
    "SUN": "Sunderland",
    "TOT": "Tottenham Hotspur",
}

# Historical ranked seed retained for reference; captured ownership below is
# the active staging source of truth.
_LEGACY_DRAFT_BOARD_TEXT = """
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

# Historical goalkeeper buffer for the retired generated seed.
_LEGACY_SUPPLEMENTAL_GOALKEEPERS_TEXT = """
161|Henderson|GKP|CRY|198
162|Sels|GKP|NFO|467
163|Martinez|GKP|AVL|28
""".strip()

# The draft board is the source of truth for ownership. Each line is an
# overall pick, followed by the player data needed when the staging database
# has not yet received its first official FPL refresh. The team index for a
# pick is derived from the board's eight-team snake order.
_CAPTURED_DRAFT_TEXT = """
1|Haaland|FWD|MCI|411
2|B.Fernandes|MID|MUN|426
3|Saka|MID|ARS|12
4|Semenyo|MID|MCI|397
5|Watkins|FWD|AVL|55
6|Mbeumo|MID|MUN|427
7|Thiago|FWD|BRE|106
8|João Pedro|FWD|CHE|165
9|Palmer|MID|CHE|154
10|Isak|FWD|LIV|379
11|Rogers|MID|CHE|40
12|Gyökeres|FWD|ARS|25
13|Calvert-Lewin|FWD|LEE|346
14|Šeško|FWD|MUN|439
15|Cunha|MID|MUN|428
16|Gabriel|DEF|ARS|4
17|Rice|MID|ARS|13
18|Richarlison|FWD|TOT|527
19|O'Reilly|DEF|MCI|387
20|Szoboszlai|MID|LIV|368
21|Wirtz|MID|LIV|366
22|Gibbs-White|MID|NFO|480
23|Mateta|FWD|CRY|223
24|Anderson|MID|MCI|481
25|Igor Jesus|FWD|NFO|491
26|Bruno G.|MID|NEW|452
27|Evanilson|FWD|BOU|79
28|Foden|MID|MCI|398
29|Wissa|FWD|NEW|464
30|Woltemade|FWD|NEW|463
31|Cherki|MID|MCI|399
32|Guéhi|DEF|MCI|388
33|Wilson|MID|LEE|260
34|Pedro Porro|DEF|TOT|499
35|Enzo|MID|CHE|155
36|Munoz|MID|LIV|377
37|Gakpo|MID|LIV|367
38|Virgil|DEF|LIV|356
39|Maddison|MID|TOT|515
40|Gvardiol|DEF|MCI|391
41|Groß|MID|BHA|124
42|James|DEF|CHE|142
43|J.Timber|DEF|ARS|5
44|Eze|MID|ARS|14
45|Saliba|DEF|ARS|6
46|Raya|GKP|ARS|1
47|Doku|MID|MCI|400
48|E.Le Fée|MID|SUN|542
49|Lacroix|DEF|CHE|200
50|Tarkowski|DEF|EVE|229
51|Dewsbury-Hall|MID|EVE|236
52|Matheus N.|DEF|MCI|389
53|Ødegaard|MID|ARS|15
54|Fernandes|MID|TOT|525
55|Ndiaye|MID|EVE|237
56|Sarr|MID|CRY|208
57|Colwill|DEF|CHE|149
58|Tavernier|MID|BOU|68
59|Palestra|DEF|CHE|152
60|Marmoush|FWD|MCI|401
61|Garner|MID|EVE|239
62|Senesi|DEF|TOT|498
63|N.Williams|DEF|NFO|469
64|Havertz|FWD|ARS|26
65|Donnarumma|GKP|MCI|384
66|McBurnie|FWD|HUL|295
67|Emersonn|FWD|IPS|316
68|Manzambi|MID|AVL|53
69|Frimpong|DEF|LIV|357
70|Truffert|DEF|BOU|61
71|Mukiele|DEF|SUN|533
72|Garcia|FWD|FUL|569
73|Kerkez|DEF|LIV|358
74|Cash|DEF|AVL|32
75|Savinho|MID|MCI|403
76|Calafiori|DEF|ARS|8
77|Van Hecke|DEF|TOT|112
78|Muñoz|DEF|CRY|201
79|Pickford|GKP|EVE|226
80|Lammens|GKP|MUN|412
81|Brobbey|FWD|SUN|552
82|Hill|DEF|BOU|60
83|Tielemans|MID|MUN|43
84|Tzolis|MID|ARS|557
85|Hall|DEF|NEW|449
86|Solanke|FWD|TOT|526
87|O.Dango|MID|BRE|95
88|Rayan|MID|BOU|67
89|Vuskovic|DEF|BHA|504
90|Amad|MID|MUN|431
91|A.Becker|GKP|LIV|350
92|Aït-Nouri|DEF|MCI|392
93|Rúben|DEF|MCI|390
94|Van de Ven|DEF|TOT|503
95|Minteh|MID|BHA|122
96|Tonali|MID|TOT|455
97|Jacquet|DEF|LIV|362
98|Martinez|GKP|AVL|28
99|Kelleher|GKP|BRE|82
100|Roefs|GKP|SUN|529
101|Horníček|GKP|NEW|567
102|F.Kadıoğlu|DEF|BHA|113
103|Wieffer|DEF|BHA|130
104|Sánchez|GKP|CHE|140
105|Barnes|MID|NEW|453
106|Thiaw|DEF|NEW|445
107|Strand Larsen|FWD|CRY|222
108|Aina|DEF|NFO|473
109|Wright|FWD|COV|193
110|Mainoo|MID|MUN|432
111|Kudus|MID|TOT|512
112|Kroupi.Jr|MID|BOU|78
113|Neto|MID|CHE|156
114|Ballard|DEF|SUN|532
115|Mitchell|DEF|CRY|204
116|Konsa|DEF|AVL|31
117|Kluivert|MID|BOU|70
118|Welbeck|FWD|CHE|136
119|Dalot|DEF|MUN|417
120|Milenković|DEF|NFO|471
121|O'Brien|DEF|EVE|232
122|Gravenberch|MID|LIV|371
123|Stach|MID|LEE|335
124|Henderson|GKP|CRY|198
125|Scott|MID|BOU|69
126|Schade|MID|BRE|94
127|Beto|FWD|EVE|248
128|Buendía|MID|AVL|41
129|Maguire|DEF|MUN|418
130|Richards|DEF|CRY|202
131|Wood|FWD|NFO|490
132|Collins|DEF|BRE|84
133|Muniz|FWD|FUL|271
134|Hincapie|DEF|ARS|9
135|Verbruggen|GKP|BHA|109
136|Estêvão|MID|CHE|157
137|Kinsky|GKP|TOT|496
138|Torp|MID|COV|188
139|Petrović|GKP|BOU|57
140|Damsgaard|MID|BRE|96
141|Shaw|DEF|MUN|423
142|Keane|DEF|EVE|231
143|Leno|GKP|FUL|250
144|George|MID|EVE|242
145|Muharemović|DEF|LEE|334
146|Ekitiké|FWD|LIV|380
147|Aaronson|MID|LEE|337
148|Sels|GKP|NFO|467
149|Dorgu|MID|MUN|415
150|Robertson|DEF|TOT|502
151|Trafford|GKP|LEE|385
152|Mosquera|DEF|ARS|11
153|Xhaka|MID|SUN|544
154|Georginio|FWD|BHA|125
155|Kulusevski|MID|SUN|521
156|Mitoma|MID|BHA|121
157|Tel|MID|TOT|514
158|Chalobah|DEF|CHE|143
159|Botman|DEF|NEW|447
160|Hume|DEF|SUN|534
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
    players = tuple(
        DraftBoardPlayer(int(rank), name, position, team, int(fpl_id))
        for rank, name, position, team, fpl_id in (
            line.split("|") for line in _CAPTURED_DRAFT_TEXT.splitlines()
        )
    )
    if len(players) != TOTAL_DRAFT_PICKS or len({player.fpl_id for player in players}) != len(
        players
    ):
        raise ValueError("The captured staging draft must contain 160 unique players.")
    if [player.rank for player in players] != list(range(1, TOTAL_DRAFT_PICKS + 1)):
        raise ValueError("The captured staging draft picks must be contiguous from 1 to 160.")
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
        max(0, minimum - counts[position]) for position, (minimum, _) in POSITION_LIMITS.items()
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
    """Return the captured draft in the board's actual snake-draft order."""
    captured_players = tuple(players or draft_board())
    allocations = tuple(
        DraftAllocation(player.rank, snake_team_index(player.rank, len(TEAM_IDS)), player)
        for player in captured_players
    )
    validate_draft_allocations(allocations)
    return allocations


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


def resolve_staging_manager_context(
    session_factory: object,
    user_id: str | None,
) -> tuple[str, str, str, str, str] | None:
    """Resolve a signed-in staging user to their manager and rival teams.

    The tuple contains manager ID, manager team ID, manager team name, rival
    team ID, and rival team name. A missing user or unassigned user returns
    ``None`` so development-mode defaults remain unchanged.
    """
    if user_id is None:
        return None

    with session_factory() as session:
        manager_row = (
            session.execute(
                select(
                    managers_table.c.id,
                    draft_teams_table.c.id.label("team_id"),
                    draft_teams_table.c.name.label("team_name"),
                )
                .join(draft_teams_table, draft_teams_table.c.manager_id == managers_table.c.id)
                .where(
                    managers_table.c.user_id == user_id,
                    draft_teams_table.c.league_id == LEAGUE_ID,
                )
            )
            .mappings()
            .first()
        )
        if manager_row is None:
            return None

        rival_row = (
            session.execute(
                select(draft_teams_table.c.id, draft_teams_table.c.name)
                .where(
                    draft_teams_table.c.league_id == LEAGUE_ID,
                    draft_teams_table.c.id != manager_row["team_id"],
                )
                .order_by(draft_teams_table.c.id)
                .limit(1)
            )
            .mappings()
            .first()
        )

    if rival_row is None:
        return None
    return (
        str(manager_row["id"]),
        str(manager_row["team_id"]),
        str(manager_row["team_name"]),
        str(rival_row["id"]),
        str(rival_row["name"]),
    )


def staging_manager_assignments(allowed_emails: str) -> dict[str, str]:
    """Map the two protected staging reviewer entries to their draft teams."""
    emails = tuple(email.strip().lower() for email in allowed_emails.split(",") if email.strip())
    if len(emails) != len(STAGING_MANAGER_TEAM_IDS):
        raise RuntimeError(
            "Staging reviewer allowlist must contain exactly two email addresses "
            "for the controlled two-team reviewer fixture."
        )
    return dict(zip(STAGING_MANAGER_TEAM_IDS, emails, strict=True))


def _upsert(session: Session, table: object, values: dict[str, object]) -> None:
    row_id = values["id"]
    exists = session.execute(select(table.c.id).where(table.c.id == row_id)).scalar_one_or_none()
    if exists is None:
        session.execute(insert(table).values(**values))
    else:
        session.execute(update(table).where(table.c.id == row_id).values(**values))


def seed_staging_snake_draft(
    session_factory: object,
    *,
    google_allowed_emails: str,
) -> DraftSeedResult:
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

        assigned_users = {}
        manager_assignments = staging_manager_assignments(google_allowed_emails)
        for email in manager_assignments.values():
            preferred_name = email.split("@", maxsplit=1)[0].replace(".", " ").title()
            user_row = (
                session.execute(
                    select(users_table.c.id, users_table.c.display_name).where(
                        users_table.c.email == email
                    )
                )
                .mappings()
                .one_or_none()
            )
            if user_row is None:
                user_id = f"staging:{email}"
                session.execute(
                    insert(users_table).values(
                        id=user_id,
                        email=email,
                        display_name=preferred_name,
                        roles=["manager"],
                    )
                )
                assigned_users[email] = {
                    "id": user_id,
                    "display_name": preferred_name,
                }
            else:
                user_id = str(user_row["id"])
                display_name = str(user_row["display_name"] or preferred_name)
                session.execute(
                    update(users_table)
                    .where(users_table.c.id == user_id)
                    .values(display_name=display_name, roles=["manager"])
                )
                assigned_users[email] = {
                    "id": user_id,
                    "display_name": display_name,
                }

        for index, (team_id, team_name) in enumerate(zip(TEAM_IDS, TEAM_NAMES, strict=True), 1):
            manager_id = f"manager-{index}"
            assigned_email = manager_assignments.get(team_id)
            assigned_user = assigned_users.get(assigned_email) if assigned_email else None
            manager_name = assigned_user["display_name"] if assigned_user else f"Manager {index}"
            _upsert(
                session,
                managers_table,
                {
                    "id": manager_id,
                    "user_id": assigned_user["id"] if assigned_user else None,
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
            player_id = f"fpl-{player.fpl_id}"
            if (
                session.execute(
                    select(fpl_players_table.c.id).where(fpl_players_table.c.id == player_id)
                ).scalar_one_or_none()
                is None
            ):
                _upsert(
                    session,
                    fpl_players_table,
                    {
                        "id": player_id,
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
