from cdl_api.terraform_plan_summary import summarize_plan


def _change(
    address: str,
    resource_type: str,
    before: object,
    after: object,
) -> dict[str, object]:
    return {
        "address": address,
        "type": resource_type,
        "change": {"actions": ["update"], "before": before, "after": after},
    }


def test_disjoint_provider_refresh_drift_does_not_block_image_update() -> None:
    address = "module.cloud_run_api[0].google_cloud_run_v2_service.this"
    plan = {
        "format_version": "1.2",
        "terraform_version": "1.15.8",
        "resource_changes": [
            _change(
                address,
                "google_cloud_run_v2_service",
                {
                    "template": {
                        "containers": [{"image": "old", "build_info": "new"}]
                    },
                    "update_time": "new",
                },
                {
                    "template": {
                        "containers": [{"image": "new", "build_info": "new"}]
                    },
                    "update_time": "new",
                },
            )
        ],
        "resource_drift": [
            _change(
                address,
                "google_cloud_run_v2_service",
                {
                    "template": {
                        "containers": [{"image": "old", "build_info": "old"}]
                    },
                    "update_time": "old",
                },
                {
                    "template": {
                        "containers": [{"image": "old", "build_info": "new"}]
                    },
                    "update_time": "new",
                },
            ),
            _change(
                "module.cloud_sql.google_sql_database_instance.this",
                "google_sql_database_instance",
                {"server_ca_cert": "old"},
                {"server_ca_cert": "new"},
            ),
        ],
    }

    summary, exit_code = summarize_plan(
        plan,
        plan_sha256="abc",
        plan_exit_code=2,
        source_sha="deadbeef",
        run_url="",
    )

    assert exit_code == 0
    assert "Safety gate: **PASS**" in summary
    assert "## Detected remote-state drift\n\n- None detected" in summary
    assert "## Non-overlapping refresh differences" in summary
    assert "update_time" not in summary
    assert "build_info" not in summary
    assert "server_ca_cert" not in summary


def test_overlapping_drift_remains_blocked() -> None:
    address = "module.cloud_sql.google_sql_database_instance.this"
    plan = {
        "format_version": "1.2",
        "terraform_version": "1.15.8",
        "resource_changes": [
            _change(
                address,
                "google_sql_database_instance",
                {"deletion_protection": False},
                {"deletion_protection": True},
            )
        ],
        "resource_drift": [
            _change(
                address,
                "google_sql_database_instance",
                {"deletion_protection": True},
                {"deletion_protection": False},
            )
        ],
    }

    summary, exit_code = summarize_plan(
        plan,
        plan_sha256="abc",
        plan_exit_code=2,
        source_sha="deadbeef",
        run_url="",
    )

    assert exit_code == 5
    assert "BLOCKED: actionable out-of-band resource drift detected" in summary
    assert "Actionable managed reconciliation" in summary
    assert "deletion_protection" not in summary


def test_unknown_change_shape_fails_closed_when_same_resource_is_managed() -> None:
    address = "google_cloud_run_v2_job.synthetic_seed[0]"
    plan = {
        "format_version": "1.2",
        "terraform_version": "1.15.8",
        "resource_changes": [
            {
                "address": address,
                "type": "google_cloud_run_v2_job",
                "change": {"actions": ["update"], "before": None, "after": None},
            }
        ],
        "resource_drift": [
            _change(
                address,
                "google_cloud_run_v2_job",
                {"etag": "a"},
                {"etag": "b"},
            )
        ],
    }

    _, exit_code = summarize_plan(
        plan,
        plan_sha256="abc",
        plan_exit_code=2,
        source_sha="deadbeef",
        run_url="",
    )

    assert exit_code == 5
