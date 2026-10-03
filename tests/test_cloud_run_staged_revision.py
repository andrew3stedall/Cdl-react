from __future__ import annotations

import importlib.util
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
            "status": {
                "latestCreatedRevision": "api-new",
                "latestReadyRevision": "api-new",
                "traffic": [{"revision": "api-old", "percent": 100}],
            },
        },
    ],
    ids=["cloud-run-v1", "cloud-run-v2"],
)
def test_cloud_run_versions_resolve_prior_and_ready_revisions(service: dict) -> None:
    assert resolve_serving_revision(service) == "api-old"
    revision = {"spec": {"containers": [{"image": IMAGE}]}}
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


def test_postgres_release_ci_builds_staging_app_before_overrides() -> None:
    workflow = Path(".github/workflows/backend-postgres.yml").read_text(encoding="utf-8")
    for setting in (
        "CDL_ENVIRONMENT: staging",
        "CDL_REPOSITORY_MODE: postgres",
        'CDL_SESSION_COOKIE_SECURE: "true"',
        "CDL_DEVELOPMENT_LOGIN_SECRET:",
        "CDL_GOOGLE_CLIENT_ID:",
        "CDL_GOOGLE_ALLOWED_EMAILS:",
        "CDL_COMMISSIONER_EMAILS:",
    ):
        assert setting in workflow
