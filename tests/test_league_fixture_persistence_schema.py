from cdl_api.repositories.postgres_league_fixtures import LEAGUE_FIXTURE_PERSISTENCE_TABLES


def test_league_fixture_persistence_table_inventory() -> None:
    table_names = {table.name for table in LEAGUE_FIXTURE_PERSISTENCE_TABLES}

    assert table_names == {
        "cdl_fixtures",
        "epl_fixtures",
        "fixture_results",
        "fixture_scoring_snapshots",
        "league_table_snapshots",
        "knockout_matches",
        "head_to_head_records",
    }
