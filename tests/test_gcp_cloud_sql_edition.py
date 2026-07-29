from pathlib import Path

MODULE_MAIN = Path("infra/terraform/modules/cloud-sql-postgres/main.tf")
MODULE_VARIABLES = Path("infra/terraform/modules/cloud-sql-postgres/variables.tf")
STAGING_MAIN = Path("infra/terraform/environments/staging/main.tf")
STAGING_VARIABLES = Path("infra/terraform/environments/staging/variables.tf")


def test_cloud_sql_module_sets_and_validates_explicit_edition() -> None:
    main = MODULE_MAIN.read_text(encoding="utf-8")
    variables = MODULE_VARIABLES.read_text(encoding="utf-8")

    assert "var.edition" in main
    assert 'variable "edition" {' in variables
    assert 'default     = "ENTERPRISE"' in variables
    assert 'contains(["ENTERPRISE", "ENTERPRISE_PLUS"], var.edition)' in variables


def test_shared_core_tiers_require_enterprise_edition() -> None:
    main = MODULE_MAIN.read_text(encoding="utf-8")

    assert 'var.edition == "ENTERPRISE"' in main
    assert '["db-f1-micro", "db-g1-small"]' in main
    assert "Shared-core Cloud SQL tiers require the ENTERPRISE edition." in main


def test_staging_explicitly_uses_enterprise_for_postgres_16_micro() -> None:
    main = STAGING_MAIN.read_text(encoding="utf-8")
    variables = STAGING_VARIABLES.read_text(encoding="utf-8")

    assert "var.database_edition" in main
    assert 'variable "database_edition" {' in variables
    assert 'default     = "POSTGRES_16"' in variables
    assert 'default     = "db-f1-micro"' in variables
    assert 'default     = "ENTERPRISE"' in variables
