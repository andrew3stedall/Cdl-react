from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

_spec = importlib.util.spec_from_file_location(
    "cloud_run_staged_revision", Path("scripts/cloud_run_staged_revision.py")
)
assert _spec and _spec.loader
_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_module)
resolve_serving_revision = _module.resolve_serving_revision
resolve_staged_revision = _module.resolve_staged_revision
resolve_tagged_candidate_url = _module.resolve_tagged_candidate_url
resolve_ready_candidate = _module.resolve_ready_candidate
safe_revision_diagnostics = _module.safe_revision_diagnostics
sanitize_startup_logs = _module.sanitize_startup_logs
reconciliation_finished = _module.reconciliation_finished
has_terminal_revision_failure = _module.has_terminal_revision_failure

IMAGE = "australia-southeast1-docker.pkg.dev/project/repo/api@sha256:" + "a" * 64


@pytest.mark.parametrize(
    "service",
    [
        {
            "traffic": [{"revisionName": "api-old", "percent": 100}],
            "spec": {"template": {"spec": {"containers": [{"image": IMAGE}]}}},
            "status": {
                "latestCreatedRevisionName": "api-new",
                "latestReadyRevisionName": "api-new",
                "traffic": [{"revisionName": "api-old", "percent": 100}],
            },
        },
        {
            "template": {"containers": [{"image": IMAGE}]},
            "latestCreatedRevision": "api-new",
            "latestReadyRevision": "api-new",
            "trafficStatuses": [{"revision": "api-old", "percent": 100}],
        },
    ],
    ids=["cloud-run-v1", "cloud-run-v2"],
)
def test_cloud_run_versions_resolve_prior_and_ready_revisions(service: dict) -> None:
    assert resolve_serving_revision(service) == "api-old"
    revision = (
        {"containers": [{"image": IMAGE}], "imageDigest": IMAGE}
        if "trafficStatuses" in service
        else {"spec": {"containers": [{"image": IMAGE}]}}
    )
    assert resolve_staged_revision(service, revision, "api-old", IMAGE) == "api-new"


def test_staged_revision_requires_latest_created_to_be_ready() -> None:
    service = {
        "status": {
            "latestCreatedRevisionName": "api-newer",
            "latestReadyRevisionName": "api-new",
            "traffic": [{"revisionName": "api-old", "percent": 100}],
        }
    }
    revision = {"spec": {"containers": [{"image": IMAGE}]}}
    with pytest.raises(ValueError, match="Latest created"):
        resolve_staged_revision(service, revision, "api-old", IMAGE)


def test_staged_revision_requires_exact_image_digest_and_unchanged_traffic() -> None:
    service = {
        "status": {
            "latestCreatedRevisionName": "api-new",
            "latestReadyRevisionName": "api-new",
            "traffic": [{"revisionName": "api-new", "percent": 100}],
        }
    }
    revision = {"spec": {"containers": [{"image": IMAGE}]}}
    with pytest.raises(ValueError, match="Serving traffic changed"):
        resolve_staged_revision(service, revision, "api-old", IMAGE)

    service["status"]["traffic"] = [{"revisionName": "api-old", "percent": 100}]
    revision["status"] = {"imageDigest": IMAGE.replace("a" * 64, "b" * 64)}
    with pytest.raises(ValueError, match="resolved image digest"):
        resolve_staged_revision(service, revision, "api-old", IMAGE)


def test_prior_traffic_must_have_one_explicit_revision() -> None:
    with pytest.raises(ValueError, match="exactly one"):
        resolve_serving_revision({"status": {"traffic": []}})
    with pytest.raises(ValueError, match="explicit revision"):
        resolve_serving_revision({"status": {"traffic": [{"percent": 100}]}})


def test_candidate_url_comes_from_tagged_service_traffic_without_changing_live_traffic() -> None:
    service = {
        "status": {
            "traffic": [
                {"revisionName": "api-old", "percent": 100},
                {
                    "revisionName": "api-new",
                    "percent": 0,
                    "tag": "cdl-123-1",
                    "url": "https://cdl-123-1---api-abc.a.run.app",
                },
            ]
        }
    }
    assert (
        resolve_tagged_candidate_url(service, "api-new", "api-old", "cdl-123-1")
        == "https://cdl-123-1---api-abc.a.run.app"
    )
    v2_service = {
        "trafficStatuses": [
            {"revision": "api-old", "percent": 100},
            {
                "revision": "api-new",
                "percent": 0,
                "tag": "cdl-123-1",
                "uri": "https://cdl-123-1---api-abc.a.run.app",
            },
        ]
    }
    assert (
        resolve_tagged_candidate_url(v2_service, "api-new", "api-old", "cdl-123-1")
        == "https://cdl-123-1---api-abc.a.run.app"
    )
    with pytest.raises(ValueError, match="Serving traffic changed"):
        resolve_tagged_candidate_url(
            {"status": {"traffic": [{"revisionName": "api-new", "percent": 100}]}},
            "api-new",
            "api-old",
            "cdl-123-1",
        )
    with pytest.raises(ValueError, match="does not point"):
        resolve_tagged_candidate_url(
            {
                "status": {
                    "traffic": [
                        {"revisionName": "api-old", "percent": 100},
                        {
                            "revisionName": "api-other",
                            "percent": 0,
                            "tag": "cdl-123-1",
                            "url": "https://tag---api-abc.a.run.app",
                        },
                    ]
                }
            },
            "api-new",
            "api-old",
            "cdl-123-1",
        )
    with pytest.raises(ValueError, match="valid HTTPS URL"):
        resolve_tagged_candidate_url(
            {
                "status": {
                    "traffic": [
                        {"revisionName": "api-old", "percent": 100},
                        {
                            "revisionName": "api-new",
                            "percent": 0,
                            "tag": "cdl-123-1",
                            "url": "",
                        },
                    ]
                }
            },
            "api-new",
            "api-old",
            "cdl-123-1",
        )


def test_postgres_release_journey_sets_staging_environment_only_for_itself() -> None:
    workflow = Path(".github/workflows/backend-postgres.yml").read_text(encoding="utf-8")
    journey = Path("tests/test_postgres_release_journeys.py").read_text(encoding="utf-8")
    assert "CDL_DATABASE_URL: postgresql+psycopg://cdl@localhost:5432/cdl" in workflow
    for setting in (
        '"CDL_ENVIRONMENT", settings.environment',
        '"CDL_REPOSITORY_MODE", settings.repository_mode',
        '"CDL_SESSION_COOKIE_SECURE", "true"',
        '"CDL_DEVELOPMENT_LOGIN_SECRET", settings.development_login_secret',
        '"CDL_GOOGLE_CLIENT_ID", "test-only-google-client"',
        '"CDL_GOOGLE_ALLOWED_EMAILS", settings.google_allowed_emails',
        '"CDL_COMMISSIONER_EMAILS", settings.commissioner_emails',
    ):
        assert setting in journey
    assert "CDL_ENVIRONMENT: staging" not in workflow


def test_full_cloud_run_v2_revision_resource_names_are_normalized_without_weakening_guard() -> None:
    previous = "projects/project/locations/region/services/api/revisions/api-old"
    ready = "projects/project/locations/region/services/api/revisions/api-new"
    service = {
        "latestCreatedRevision": ready,
        "latestReadyRevision": ready,
        "trafficStatuses": [{"revision": previous, "percent": 100}],
    }
    assert resolve_serving_revision(service) == "api-old"
    assert resolve_ready_candidate(service, previous) == "api-new"
    revision = {
        "name": ready,
        "containers": [{"image": IMAGE}],
        "imageDigest": IMAGE,
    }
    assert resolve_staged_revision(service, revision, previous, IMAGE) == "api-new"

    service["latestCreatedRevision"] = previous
    assert resolve_ready_candidate(service, previous) is None
    with pytest.raises(ValueError, match="Serving traffic changed"):
        resolve_ready_candidate(
            {
                "latestCreatedRevision": ready,
                "latestReadyRevision": ready,
                "trafficStatuses": [{"revision": ready, "percent": 100}],
            },
            previous,
        )
    with pytest.raises(ValueError, match="Latest created"):
        resolve_staged_revision(service, revision, previous, IMAGE)


def test_revision_diagnostics_expose_safe_metadata_without_env_or_condition_messages() -> None:
    sentinel_value = "do-not-leak-this-secret"
    service = {
        "latestCreatedRevision": "projects/p/locations/r/services/s/revisions/api-new",
        "latestReadyRevision": "projects/p/locations/r/services/s/revisions/api-old",
        "trafficStatuses": [{"revision": "api-old", "percent": 100}],
        "conditions": [
            {
                "type": "Ready",
                "status": "False",
                "reason": "ContainerFailed",
                "message": f"environment contained {sentinel_value}",
            }
        ],
    }
    revision = {
        "metadata": {"name": "api-new"},
        "spec": {"containers": [{"image": IMAGE}]},
        "status": {
            "imageDigest": IMAGE,
            "conditions": [
                {
                    "type": "Ready",
                    "status": "False",
                    "reason": "ContainerFailed",
                    "message": sentinel_value,
                }
            ],
        },
        "env": [{"name": "TOKEN", "value": sentinel_value}],
    }
    diagnostics = safe_revision_diagnostics(service, revision, "api-old", IMAGE)
    serialized = str(diagnostics)
    assert diagnostics["latestCreatedRevision"] == "api-new"
    assert diagnostics["latestReadyRevision"] == "api-old"
    assert diagnostics["previousServingRevision"] == "api-old"
    assert diagnostics["latestCreatedRevisionResource"].endswith("/revisions/api-new")
    assert diagnostics["latestReadyRevisionResource"].endswith("/revisions/api-old")
    assert diagnostics["previousServingRevisionResource"] == "api-old"
    assert diagnostics["expectedImageDigest"] == "sha256:" + "a" * 64
    assert diagnostics["resolvedImageDigest"] == "sha256:" + "a" * 64
    assert diagnostics["conditions"][0]["scope"] == "service"
    assert diagnostics["conditions"][0]["type"] == "Ready"
    assert diagnostics["conditions"][0]["status"] == "False"
    assert diagnostics["conditions"][0]["reason"] == "ContainerFailed"
    assert diagnostics["conditions"][0]["state"] is None
    assert diagnostics["terminalCondition"] is None
    assert sentinel_value not in serialized


def test_startup_log_sanitizer_keeps_only_exception_classes_and_app_frames(tmp_path: Path) -> None:
    sentinel_value = "database-url-password"
    path = tmp_path / "logs.json"
    path.write_text(
        json.dumps(
            [
                {
                    "textPayload": (
                        "Traceback (most recent call last):\n"
                        '  File "/app/src/cdl_api/main.py", line 42, in create_app\n'
                        f"RuntimeError: {sentinel_value}\n"
                        '  File "/home/runner/secret.py", line 3, in leak\n'
                        "ValueError: hidden-message"
                    )
                }
            ]
        ),
        encoding="utf-8",
    )
    sanitized = sanitize_startup_logs(str(path))
    serialized = str(sanitized)
    assert sanitized["exceptionClasses"] == [
        {"name": "RuntimeError", "count": 1},
        {"name": "ValueError", "count": 1},
    ]
    assert sanitized["frames"] == [
        {"file": "/app/src/cdl_api/main.py", "line": 42, "function": "create_app"}
    ]
    assert sentinel_value not in serialized
    assert "home/runner" not in serialized


def test_terminal_revision_failure_is_detected_without_exposing_condition_messages() -> None:
    service = {
        "status": {
            "conditions": [
                {
                    "type": "Ready",
                    "status": "False",
                    "reason": "ContainerFailed",
                    "message": "secret or raw platform detail",
                }
            ]
        }
    }
    assert has_terminal_revision_failure(service)
    assert not has_terminal_revision_failure(
        {"status": {"conditions": [{"type": "Ready", "status": "Unknown", "reason": "Deploying"}]}}
    )


def test_all_rollout_workflows_wait_fail_closed_and_capture_only_safe_diagnostics() -> None:
    paths = (
        ".github/workflows/gcp-auto-rollout-staging.yml",
        ".github/workflows/gcp-direct-staging-rollout.yml",
        ".github/workflows/gcp-terraform-apply-staging.yml",
    )
    for path in paths:
        workflow = Path(path).read_text(encoding="utf-8")
        assert "cloud_run_staged_revision.py ready" in workflow
        assert "cloud_run_staged_revision.py failed" in workflow
        assert "cloud_run_staged_revision.py reconciling" in workflow
        assert "seq 1 60" in workflow
        assert "cloud_run_staged_revision.py diagnostics" in workflow
        assert "cloud_run_staged_revision.py sanitize-logs" in workflow
        assert 'gcloud run revisions describe "${created}"' in workflow
        assert "created-revision.json" in workflow
        assert 'cat "${RUNNER_TEMP}/staged-revision-diagnostics.json" >&2' in workflow
        assert 'cat "${RUNNER_TEMP}/staged-revision-startup-errors.json" >&2' in workflow
        assert workflow.count("- name: Upload safe failed rollout diagnostics") == 1
        assert "staged-revision-startup-errors.json" in workflow
        assert "staged-service.json" not in workflow.split("path: |")[-1]


def test_direct_rollout_captures_prior_revision_before_no_traffic_cloudsql_repair() -> None:
    workflow = Path(".github/workflows/gcp-direct-staging-rollout.yml").read_text(encoding="utf-8")
    checkout = workflow.index("uses: actions/checkout@v4")
    pin = workflow.index("- name: Pin serving revision before fallback repair")
    repair = workflow.index("- name: Repair database attachment")
    unchanged = workflow.index("- name: Verify unchanged serving revision after repair")
    assert checkout < pin < repair < unchanged
    service_repair = workflow[repair : workflow.index("for job in", repair)]
    assert "--no-traffic" in service_repair
    assert "run.googleapis.com/cloudsql-instances" in service_repair
    assert 'test "${revision}" = "${RUNTIME_TRAFFIC_REVISION}"' in workflow


def test_runtime_image_ci_imports_app_and_checks_health_route() -> None:
    workflow = Path(".github/workflows/ci.yml").read_text(encoding="utf-8")
    assert "import cdl_api.app as app;" in workflow
    assert "getattr(route, 'path', None) == '/health'" in workflow


def test_cloud_run_v2_terminal_condition_enum_stops_retrying_and_is_summarized_safely() -> None:
    service = {
        "name": "projects/project/locations/region/services/api",
        "reconciling": False,
        "latestCreatedRevision": "projects/project/locations/region/services/api/revisions/api-new",
        "latestReadyRevision": "projects/project/locations/region/services/api/revisions/api-old",
        "trafficStatuses": [
            {
                "revision": "projects/project/locations/region/services/api/revisions/api-old",
                "percent": 100,
            }
        ],
        "terminalCondition": {
            "type": "Ready",
            "state": "CONDITION_FAILED",
            "revisionReason": "HEALTH_CHECK_CONTAINER_ERROR",
            "message": "must not be emitted",
        },
        "conditions": [
            {
                "type": "Ready",
                "state": "CONDITION_FAILED",
                "revisionReason": "HEALTH_CHECK_CONTAINER_ERROR",
                "executionReason": "RETRYABLE",
            },
            {
                "type": "Ready",
                "state": "CONDITION_FAILED",
                "revisionReason": "HEALTH_CHECK_CONTAINER_ERROR",
                "message": "must not be emitted",
            },
        ],
    }
    assert reconciliation_finished(service) is True
    assert has_terminal_revision_failure(service)
    diagnostics = safe_revision_diagnostics(service, {}, "api-old", IMAGE)
    assert diagnostics["reconciling"] is False
    assert diagnostics["terminalCondition"]["state"] == "CONDITION_FAILED"
    assert diagnostics["terminalCondition"]["revisionReason"] == "HEALTH_CHECK_CONTAINER_ERROR"
    assert diagnostics["conditions"][1]["executionReason"] == "RETRYABLE"
    assert "must not be emitted" not in str(diagnostics)


def test_cloud_run_v2_reconciling_wait_state_keeps_traffic_and_is_not_terminal() -> None:
    service = {
        "reconciling": True,
        "latestCreatedRevision": "projects/project/locations/region/services/api/revisions/api-new",
        "latestReadyRevision": "projects/project/locations/region/services/api/revisions/api-old",
        "trafficStatuses": [
            {
                "revision": "projects/project/locations/region/services/api/revisions/api-old",
                "percent": 100,
            }
        ],
        "terminalCondition": {
            "type": "Ready",
            "state": "CONDITION_RECONCILING",
            "reason": "WAITING_FOR_OPERATION",
        },
    }
    assert reconciliation_finished(service) is False
    assert not has_terminal_revision_failure(service)
    assert resolve_ready_candidate(service, "api-old") is None
