import json
from pathlib import Path

import pytest

from cdl_api.terraform_plan_manifest import (
    build_manifest,
    verify_manifest,
    write_manifest,
)

SOURCE_SHA = "a" * 40


def _manifest(tmp_path: Path, **overrides: object) -> dict[str, object]:
    plan_text = tmp_path / "staging-plan.txt"
    backend_config = tmp_path / "backend.tf"
    plan_text.write_text("Terraform plan\n", encoding="utf-8")
    backend_config.write_text(
        'terraform { backend "gcs" { prefix = "environments/staging" } }\n',
        encoding="utf-8",
    )
    arguments: dict[str, object] = {
        "plan_text": plan_text,
        "backend_config": backend_config,
        "source_sha": SOURCE_SHA,
        "run_id": "12345",
        "deployment_stage": "foundation",
        "project_id": "cdl-react-staging-ast",
        "state_bucket": "cdl-react-staging-ast-terraform-state",
        "backend_image": "",
        "enable_database_jobs": False,
        "enable_cloud_run": False,
        "allow_public_invoker": False,
    }
    arguments.update(overrides)
    return build_manifest(**arguments)  # type: ignore[arg-type]


def test_manifest_binds_reviewed_plan_backend_and_exact_terraform_inputs(tmp_path: Path) -> None:
    manifest = _manifest(tmp_path)

    assert manifest["schema_version"] == "staging-terraform-plan/v1"
    assert manifest["source_sha"] == SOURCE_SHA
    assert manifest["plan_workflow_run_id"] == "12345"
    assert manifest["deployment_stage"] == "foundation"
    backend = manifest["backend"]
    assert isinstance(backend, dict)
    assert backend["bucket"] == "cdl-react-staging-ast-terraform-state"
    assert backend["prefix"] == "environments/staging"
    assert len(str(backend["config_sha256"])) == 64
    assert manifest["terraform_inputs"] == {
        "allow_public_invoker": False,
        "backend_image": "",
        "enable_cloud_run": False,
        "enable_database_jobs": False,
        "project_id": "cdl-react-staging-ast",
    }
    assert len(str(manifest["terraform_inputs_sha256"])) == 64
    assert len(str(manifest["reviewed_plan_text_sha256"])) == 64


def test_manifest_is_deterministic_and_verification_fails_on_changed_identity(
    tmp_path: Path,
) -> None:
    manifest = _manifest(tmp_path)
    output = tmp_path / "manifest.json"
    write_manifest(manifest, output)

    assert json.loads(output.read_text(encoding="utf-8")) == manifest
    verify_manifest(manifest, dict(manifest))

    altered = json.loads(output.read_text(encoding="utf-8"))
    altered["deployment_stage"] = "runtime"
    with pytest.raises(ValueError, match="does not match"):
        verify_manifest(manifest, altered)


@pytest.mark.parametrize(
    ("stage", "database_jobs", "cloud_run", "backend_image"),
    [
        ("foundation", True, False, ""),
        ("database-jobs", False, False, "image@sha256:" + ("1" * 64)),
        ("runtime", True, False, "image@sha256:" + ("1" * 64)),
    ],
)
def test_manifest_rejects_stage_flag_mismatch(
    tmp_path: Path,
    stage: str,
    database_jobs: bool,
    cloud_run: bool,
    backend_image: str,
) -> None:
    with pytest.raises(ValueError, match="feature flags"):
        _manifest(
            tmp_path,
            deployment_stage=stage,
            enable_database_jobs=database_jobs,
            enable_cloud_run=cloud_run,
            backend_image=backend_image,
        )


def test_manifest_rejects_floating_image_for_later_stage(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="immutable backend image"):
        _manifest(
            tmp_path,
            deployment_stage="database-jobs",
            enable_database_jobs=True,
            backend_image="image:latest",
        )


def test_manifest_binds_public_invoker_to_runtime_stage(tmp_path: Path) -> None:
    manifest = _manifest(
        tmp_path,
        deployment_stage="runtime",
        enable_database_jobs=True,
        enable_cloud_run=True,
        backend_image="image@sha256:" + ("1" * 64),
        allow_public_invoker=True,
    )

    assert manifest["terraform_inputs"]["allow_public_invoker"] is True

    with pytest.raises(ValueError, match="only for the runtime stage"):
        _manifest(tmp_path, allow_public_invoker=True)
