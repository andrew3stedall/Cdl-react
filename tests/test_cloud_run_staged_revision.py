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
resolve_tagged_candidate_url = _module.resolve_tagged_candidate_url

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
