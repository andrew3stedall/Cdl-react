"""Fail-closed Cloud Run v1/v2 service and revision metadata checks."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def _read(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _traffic(service: dict[str, Any]) -> list[dict[str, Any]]:
    status = service.get("status", {})
    entries = (
        status.get("traffic")
        or status.get("trafficStatuses")
        or service.get("traffic")
        or service.get("trafficStatuses")
        or []
    )
    return [entry for entry in entries if entry.get("percent", 0) > 0]


def _revision_name(entry: dict[str, Any]) -> str | None:
    return entry.get("revisionName") or entry.get("revision")


def _containers(resource: dict[str, Any]) -> list[dict[str, Any]]:
    direct = resource.get("containers")
    if isinstance(direct, list):
        return direct
    candidates = (
        resource.get("template"),
        resource.get("spec", {}).get("template"),
        resource.get("spec", {}).get("template", {}).get("spec"),
        resource.get("spec"),
    )
    for candidate in candidates:
        if isinstance(candidate, dict) and isinstance(candidate.get("containers"), list):
            return candidate["containers"]
    return []


def resolve_serving_revision(service: dict[str, Any]) -> str:
    traffic = _traffic(service)
    if len(traffic) != 1 or traffic[0].get("percent") != 100:
        raise ValueError("Staging must have exactly one 100% serving revision.")
    revision = _revision_name(traffic[0])
    if not revision:
        raise ValueError("Staging serving traffic must name an explicit revision.")
    return revision


def resolve_staged_revision(
    service: dict[str, Any],
    revision: dict[str, Any],
    previous: str,
    expected_image: str,
) -> str:
    status = service.get("status", {})
    ready = (
        status.get("latestReadyRevisionName")
        or status.get("latestReadyRevision")
        or service.get("latestReadyRevision")
    )
    created = (
        status.get("latestCreatedRevisionName")
        or status.get("latestCreatedRevision")
        or service.get("latestCreatedRevision")
    )
    if not ready or ready == previous or created != ready:
        raise ValueError("Latest created Cloud Run revision is not the new ready revision.")
    traffic = _traffic(service)
    if (
        len(traffic) != 1
        or _revision_name(traffic[0]) != previous
        or traffic[0].get("percent") != 100
    ):
        raise ValueError("Serving traffic changed before migration and smoke checks passed.")

    configured_images = [container.get("image") for container in _containers(revision)]
    if expected_image not in configured_images:
        raise ValueError("Ready revision does not use the immutable image under review.")
    resolved_digest = revision.get("status", {}).get("imageDigest") or revision.get("imageDigest")
    expected_digest = expected_image.rsplit("@", maxsplit=1)[-1]
    if resolved_digest and resolved_digest.rsplit("@", maxsplit=1)[-1] != expected_digest:
        raise ValueError("Ready revision resolved image digest does not match the reviewed digest.")
    return ready


def resolve_tagged_candidate_url(
    service: dict[str, Any], revision: str, previous: str, tag: str
) -> str:
    """Return a tagged revision URL after proving the tag and live traffic target."""
    status = service.get("status", {})
    traffic = (
        status.get("traffic")
        or status.get("trafficStatuses")
        or service.get("traffic")
        or service.get("trafficStatuses")
        or []
    )
    serving = [entry for entry in traffic if entry.get("percent", 0) > 0]
    if (
        len(serving) != 1
        or _revision_name(serving[0]) != previous
        or serving[0].get("percent") != 100
    ):
        raise ValueError("Serving traffic changed before staged revision smoke checks.")

    tagged = [entry for entry in traffic if entry.get("tag") == tag]
    if len(tagged) != 1 or _revision_name(tagged[0]) != revision:
        raise ValueError("Candidate traffic tag does not point to the staged revision.")
    url = tagged[0].get("url") or tagged[0].get("uri")
    parsed = urlparse(url or "")
    if parsed.scheme != "https" or not parsed.netloc or parsed.path not in ("", "/"):
        raise ValueError("Candidate traffic tag has no valid HTTPS URL.")
    return url.rstrip("/")


def main() -> None:
    mode, service_path, *args = sys.argv[1:]
    service = _read(service_path)
    if mode == "pin":
        print(resolve_serving_revision(service))
    elif mode == "verify" and len(args) == 3:
        revision_path, previous, expected_image = args
        print(resolve_staged_revision(service, _read(revision_path), previous, expected_image))
    elif mode == "candidate-url" and len(args) == 3:
        revision, previous, tag = args
        print(resolve_tagged_candidate_url(service, revision, previous, tag))
    else:
        raise SystemExit(
            "usage: cloud_run_staged_revision.py pin SERVICE.json | verify SERVICE.json "
            "REVISION.json PREVIOUS IMAGE | candidate-url SERVICE.json REVISION PREVIOUS TAG"
        )


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        raise SystemExit(str(error)) from error
