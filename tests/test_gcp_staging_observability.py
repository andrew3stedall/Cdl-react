from pathlib import Path

MONITORING_TF = Path("infra/terraform/environments/staging/monitoring.tf")
VARIABLES_TF = Path("infra/terraform/environments/staging/variables.tf")
RUNBOOK = Path("docs/runbooks/gcp-staging-observability.md")
DEPLOYMENT_RUNBOOK = Path("docs/runbooks/gcp-github-actions-deployment.md")


def test_cloud_sql_monitoring_has_bounded_cpu_and_error_policies() -> None:
    content = MONITORING_TF.read_text(encoding="utf-8")

    for phrase in [
        'resource "google_monitoring_alert_policy" "cloud_sql_cpu_utilization"',
        "cloudsql.googleapis.com/database/cpu/utilization",
        "threshold_value         = 0.8",
        'duration                = "300s"',
        'resource "google_monitoring_alert_policy" "cloud_sql_error_logs"',
        "cloudsql_database",
        "severity>=ERROR",
        'period = "900s"',
    ]:
        assert phrase in content


def test_cloud_run_error_policy_stays_conditional_and_private() -> None:
    content = MONITORING_TF.read_text(encoding="utf-8")

    assert 'resource "google_monitoring_alert_policy" "cloud_run_error_logs"' in content
    assert "count = var.enable_cloud_run ? 1 : 0" in content
    assert "cloud_run_revision" in content
    assert "${local.api_service_name}" in content
    assert "allUsers" not in content
    assert "google_cloud_run_v2_service_iam_member" not in content


def test_notification_destinations_are_referenced_not_created() -> None:
    monitoring = MONITORING_TF.read_text(encoding="utf-8")
    variables = VARIABLES_TF.read_text(encoding="utf-8")

    assert "notification_channels = var.monitoring_notification_channels" in monitoring
    assert 'variable "monitoring_notification_channels"' in variables
    assert "default     = []" in variables
    assert "google_monitoring_notification_channel" not in monitoring


def test_observability_runbook_preserves_live_action_gates() -> None:
    content = RUNBOOK.read_text(encoding="utf-8")

    for phrase in [
        "does not apply Terraform",
        "does not add a duplicate log sink",
        "monitoring_notification_channels",
        "no external recipient is notified",
        "Cloud Run remains disabled",
        "public invocation remains disabled",
        "issues #70 and #78",
        "terraform validate` proves schema only",
    ]:
        assert phrase in content


def test_primary_deployment_runbook_links_observability_operations() -> None:
    content = DEPLOYMENT_RUNBOOK.read_text(encoding="utf-8")

    for phrase in [
        "docs/runbooks/gcp-staging-observability.md",
        "## Logging and alerting baseline",
        "sustained Cloud SQL CPU above 80% for five minutes",
        "Terraform does not create recipient addresses or duplicate log sinks",
        "each policy still requires a controlled test event",
    ]:
        assert phrase in content
