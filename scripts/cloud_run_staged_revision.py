"""Fail-closed Cloud Run v1/v2 service and revision metadata checks."""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def _read(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _traffic(service: dict[str, Any]) -> list[dict[str, Any]]:
    status = service.get("status") or {}
    entries = (
        status.get("traffic")
        or status.get("trafficStatuses")
        or service.get("traffic")
        or service.get("trafficStatuses")
        or []
    )
    return [entry for entry in entries if entry.get("percent", 0) > 0]


def _short_revision(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    value = value.strip().rstrip("/")
    if "/" in value:
        parts = value.split("/")
        if (
            len(parts) != 8
            or parts[0] != "projects"
            or parts[2] != "locations"
            or parts[4] != "services"
            or parts[6] != "revisions"
        ):
            return None
        value = parts[7]
    return value if re.fullmatch(r"[a-z0-9](?:[-a-z0-9]*[a-z0-9])?", value) else None


def _revision_name(entry: dict[str, Any]) -> str | None:
    return _short_revision(entry.get("revisionName") or entry.get("revision"))


def _latest_revision_raw(service: dict[str, Any], kind: str) -> str | None:
    status = service.get("status") or {}
    for key in (f"latest{kind}RevisionName", f"latest{kind}Revision"):
        value = status.get(key) or service.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _latest_revision(service: dict[str, Any], kind: str) -> str | None:
    return _short_revision(_latest_revision_raw(service, kind))


def _containers(resource: dict[str, Any]) -> list[dict[str, Any]]:
    direct = resource.get("containers")
    if isinstance(direct, list):
        return direct
    spec = resource.get("spec") or {}
    template = resource.get("template") or spec.get("template") or {}
    template_spec = template.get("spec") or {}
    for candidate in (template, template_spec, spec):
        if isinstance(candidate, dict) and isinstance(candidate.get("containers"), list):
            return candidate["containers"]
    return []


def _digest(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    suffix = value.rsplit("@", maxsplit=1)[-1]
    return suffix if suffix.startswith("sha256:") else None


def _enum(value: Any) -> str | None:
    if isinstance(value, (int, float)):
        value = str(value)
    if not isinstance(value, str):
        return None
    return re.sub(r"[^A-Za-z0-9_.-]", "", value)[:80] or None


def _condition_summary(resource: dict[str, Any], scope: str) -> list[dict[str, str | None]]:
    status = resource.get("status") or {}
    conditions = status.get("conditions") or resource.get("conditions") or []
    result = []
    for condition in conditions:
        if not isinstance(condition, dict):
            continue
        result.append(
            {
                "scope": scope,
                "type": _enum(condition.get("type")),
                "status": _enum(condition.get("status")),
                "reason": _enum(condition.get("reason")),
            }
        )
    return result


def safe_revision_diagnostics(
    service: dict[str, Any],
    revision: dict[str, Any] | None,
    previous: str,
    expected_image: str,
) -> dict[str, Any]:
    revision = revision or {}
    metadata = revision.get("metadata") or {}
    configured_digests = sorted(
        {
            digest
            for container in _containers(revision)
            if (digest := _digest(container.get("image")))
        }
    )
    resolved_digest = (
        revision.get("status", {}).get("imageDigest")
        or revision.get("imageDigest")
    )
    service_template_digests = sorted(
        {
            digest
            for container in _containers(service)
            if (digest := _digest(container.get("image")))
        }
    )
    conditions = _condition_summary(service, "service")
    conditions.extend(_condition_summary(revision, "revision"))
    return {
        "latestCreatedRevision": _latest_revision(service, "Created"),
        "latestReadyRevision": _latest_revision(service, "Ready"),
        "latestCreatedRevisionResource": _latest_revision_raw(service, "Created"),
        "latestReadyRevisionResource": _latest_revision_raw(service, "Ready"),
        "previousServingRevision": _short_revision(previous),
        "previousServingRevisionResource": previous,
        "serviceGeneration": _enum(
            service.get("generation")
            or metadata.get("generation")
            or (service.get("metadata") or {}).get("generation")
        ),
        "serviceObservedGeneration": _enum(
            service.get("observedGeneration")
            or service.get("status", {}).get("observedGeneration")
        ),
        "revisionName": _short_revision(metadata.get("name") or revision.get("name")),
        "revisionResource": metadata.get("name") or revision.get("name"),
        "expectedImageDigest": _digest(expected_image),
        "configuredImageDigests": configured_digests,
        "serviceTemplateImageDigests": service_template_digests,
        "resolvedImageDigest": _digest(resolved_digest),
        "trafficTargets": [
            {
                "revision": _revision_name(entry),
                "revisionResource": entry.get("revisionName") or entry.get("revision"),
                "percent": _enum(entry.get("percent")),
                "tag": _enum(entry.get("tag")),
            }
            for entry in (
                (service.get("status") or {}).get("traffic")
                or (service.get("status") or {}).get("trafficStatuses")
                or service.get("traffic")
                or service.get("trafficStatuses")
                or []
            )
        ],
        "conditions": conditions,
    }


def _diagnostic_suffix(
    service: dict[str, Any],
    revision: dict[str, Any] | None,
    previous: str,
    expected_image: str,
) -> str:
    return json.dumps(
        safe_revision_diagnostics(service, revision, previous, expected_image),
        sort_keys=True,
        separators=(",", ":"),
    )


def resolve_serving_revision(service: dict[str, Any]) -> str:
    traffic = _traffic(service)
    if len(traffic) != 1 or traffic[0].get("percent") != 100:
        raise ValueError("Staging must have exactly one 100% serving revision.")
    revision = _revision_name(traffic[0])
    if not revision:
        raise ValueError("Staging serving traffic must name an explicit revision.")
    return revision


def resolve_ready_candidate(service: dict[str, Any], previous: str) -> str | None:
    serving = resolve_serving_revision(service)
    if serving != _short_revision(previous):
        raise ValueError("Serving traffic changed while waiting for the staged revision.")
    ready = _latest_revision(service, "Ready")
    created = _latest_revision(service, "Created")
    if not ready or ready == _short_revision(previous) or created != ready:
        return None
    return ready


def has_terminal_revision_failure(service: dict[str, Any]) -> bool:
    terminal_reasons = {
        "ContainerFailed",
        "ContainerMissing",
        "ContainerStartFailed",
        "HealthCheckContainerError",
        "RevisionFailed",
    }
    conditions = _condition_summary(service, "service")
    return any(
        item["status"] == "False" and item["reason"] in terminal_reasons
        for item in conditions
    )


def resolve_staged_revision(
    service: dict[str, Any],
    revision: dict[str, Any],
    previous: str,
    expected_image: str,
) -> str:
    ready = _latest_revision(service, "Ready")
    created = _latest_revision(service, "Created")
    diagnostic = _diagnostic_suffix(service, revision, previous, expected_image)
    if not ready or ready == _short_revision(previous) or created != ready:
        raise ValueError(
            "Latest created Cloud Run revision is not the new ready revision; "
            f"safe_revision_diagnostics={diagnostic}"
        )
    named_revision = _short_revision(
        (revision.get("metadata") or {}).get("name") or revision.get("name")
    )
    if named_revision and named_revision != ready:
        raise ValueError(
            "Described Cloud Run revision does not match the latest ready revision; "
            f"safe_revision_diagnostics={diagnostic}"
        )
    traffic = _traffic(service)
    if (
        len(traffic) != 1
        or _revision_name(traffic[0]) != _short_revision(previous)
        or traffic[0].get("percent") != 100
    ):
        raise ValueError(
            "Serving traffic changed before migration and smoke checks passed; "
            f"safe_revision_diagnostics={diagnostic}"
        )

    configured_images = [container.get("image") for container in _containers(revision)]
    if expected_image not in configured_images:
        raise ValueError(
            "Ready revision does not use the immutable image under review; "
            f"safe_revision_diagnostics={diagnostic}"
        )
    resolved_digest = revision.get("status", {}).get("imageDigest") or revision.get("imageDigest")
    expected_digest = _digest(expected_image)
    if resolved_digest and _digest(resolved_digest) != expected_digest:
        raise ValueError(
            "Ready revision resolved image digest does not match the reviewed digest; "
            f"safe_revision_diagnostics={diagnostic}"
        )
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
        or _revision_name(serving[0]) != _short_revision(previous)
        or serving[0].get("percent") != 100
    ):
        raise ValueError("Serving traffic changed before staged revision smoke checks.")

    tagged = [entry for entry in traffic if entry.get("tag") == tag]
    if len(tagged) != 1 or _revision_name(tagged[0]) != _short_revision(revision):
        raise ValueError("Candidate traffic tag does not point to the staged revision.")
    url = tagged[0].get("url") or tagged[0].get("uri")
    parsed = urlparse(url or "")
    if parsed.scheme != "https" or not parsed.netloc or parsed.path not in ("", "/"):
        raise ValueError("Candidate traffic tag has no valid HTTPS URL.")
    return url.rstrip("/")


def sanitize_startup_logs(path: str) -> dict[str, Any]:
    payload = _read(path)
    entries = payload if isinstance(payload, list) else [payload]
    exception_classes: Counter[str] = Counter()
    frames: list[dict[str, Any]] = []
    frame_pattern = re.compile(r'File "(/app/[^"]+)", line (\d+), in ([^\s]+)')
    exception_pattern = re.compile(r"^([A-Za-z_][A-Za-z0-9_.]*(?:Error|Exception))(?::|$)")
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        pieces = []
        if isinstance(entry.get("textPayload"), str):
            pieces.append(entry["textPayload"])
        json_payload = entry.get("jsonPayload")
        if isinstance(json_payload, dict):
            for key in ("message", "exception", "stack_trace", "stackTrace"):
                value = json_payload.get(key)
                if isinstance(value, str):
                    pieces.append(value)
        combined = "\n".join(pieces)
        for line in combined.splitlines():
            if match := exception_pattern.match(line.strip()):
                exception_classes[match.group(1)] += 1
        for match in frame_pattern.finditer(combined):
            frame = {
                "file": match.group(1),
                "line": int(match.group(2)),
                "function": match.group(3),
            }
            if frame not in frames:
                frames.append(frame)
    return {
        "exceptionClasses": [
            {"name": name, "count": count}
            for name, count in exception_classes.most_common()
        ],
        "frames": frames[-40:],
    }


def main() -> None:
    mode, service_path, *args = sys.argv[1:]
    service = _read(service_path)
    if mode == "pin":
        print(resolve_serving_revision(service))
    elif mode == "ready" and len(args) == 1:
        print(resolve_ready_candidate(service, args[0]) or "")
    elif mode == "failed" and len(args) == 0:
        print("true" if has_terminal_revision_failure(service) else "false")
    elif mode == "verify" and len(args) == 3:
        revision_path, previous, expected_image = args
        print(resolve_staged_revision(service, _read(revision_path), previous, expected_image))
    elif mode == "diagnostics" and len(args) == 3:
        revision_path, previous, expected_image = args
        revision = _read(revision_path) if revision_path != "-" and Path(revision_path).exists() else {}
        print(json.dumps(safe_revision_diagnostics(service, revision, previous, expected_image), sort_keys=True))
    elif mode == "sanitize-logs" and len(args) == 0:
        print(json.dumps(sanitize_startup_logs(service_path), sort_keys=True))
    elif mode == "candidate-url" and len(args) == 3:
        revision, previous, tag = args
        print(resolve_tagged_candidate_url(service, revision, previous, tag))
    else:
        raise SystemExit(
            "usage: cloud_run_staged_revision.py pin SERVICE.json | "
            "ready SERVICE.json PREVIOUS | failed SERVICE.json | verify SERVICE.json REVISION.json PREVIOUS IMAGE | "
            "diagnostics SERVICE.json REVISION.json|- PREVIOUS IMAGE | "
            "sanitize-logs LOGS.json | candidate-url SERVICE.json REVISION PREVIOUS TAG"
        )


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        raise SystemExit(str(error)) from error
