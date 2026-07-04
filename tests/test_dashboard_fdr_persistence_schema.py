from cdl_api.repositories.postgres_dashboard_fdr import DASHBOARD_FDR_PERSISTENCE_TABLES


def test_dashboard_fdr_persistence_tables_are_defined() -> None:
    assert len(DASHBOARD_FDR_PERSISTENCE_TABLES) == 5
