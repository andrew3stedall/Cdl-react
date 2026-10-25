"""Phone-operated staging sync command; never prints credentials or record values."""

import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from cdl_api.contracts.castle_sync import CastleSyncConfig
from cdl_api.repositories.castle_sync import CastleSyncRepository

PROJECT = "cdl-react-staging-ast"
INSTANCE = f"{PROJECT}:australia-southeast1:cdl-react-staging-postgres"


def staging_database_url(secret_value: str) -> str:
    """Validate destination secret before substituting the local Auth Proxy host."""
    url = make_url(secret_value)
    if (
        url.drivername != "postgresql+psycopg"
        or url.database != "cdl_react"
        or url.username != "cdl_app"
        or url.query.get("host") != f"/cloudsql/{INSTANCE}"
    ):
        raise ValueError("Database secret is outside the expected staging boundary")
    return (
        url.difference_update_query(["host"])
        .set(host="127.0.0.1", port=5433)
        .render_as_string(hide_password=False)
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--operation", choices=["plan", "apply"], default="plan")
    parser.add_argument("--projection", choices=["archive", "native"], default="archive")
    args = parser.parse_args()
    if (
        os.environ.get("GITHUB_REF") != "refs/heads/main"
        or os.environ.get("PROJECT_ID") != PROJECT
        or os.environ.get("GITHUB_REPOSITORY") != "andrew3stedall/Cdl-react"
    ):
        raise ValueError("Sync command requires trusted staging Actions context")
    temporary = Path(os.environ["RUNNER_TEMP"]).resolve()
    source = temporary / "castle-sync-input.json"
    try:
        if (
            args.operation == "apply"
            and os.environ.get("CASTLE_CONFIRM_APPLY") != "IMPORT CASTLE STAGING"
        ):
            raise ValueError("Apply confirmation is required")
        config = CastleSyncConfig(
            source_league_id=os.environ.get("CASTLE_SOURCE_LEAGUE", ""),
            projection=args.projection,
            adopt_existing=os.environ.get("CASTLE_ADOPT_EXISTING") == "true",
            team_aliases=json.loads(os.environ.get("CASTLE_TEAM_ALIASES", "{}")),
            player_ids=json.loads(os.environ.get("CASTLE_PLAYER_IDS", "{}")),
            trade_gameweeks=json.loads(os.environ.get("CASTLE_TRADE_GAMEWEEKS", "{}")),
        )
        bundle = json.loads(source.read_text())
        gcloud = shutil.which("gcloud")
        if gcloud is None:
            raise ValueError("Cloud SDK is required")
        # Read into process memory; stderr and returned credentials never reach logs.
        result = subprocess.run(  # noqa: S603
            [
                gcloud,
                "secrets",
                "versions",
                "access",
                "latest",
                "--secret=cdl-database-url",
                f"--project={PROJECT}",
                "--quiet",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        engine = create_engine(
            staging_database_url(result.stdout.strip()),
            isolation_level="SERIALIZABLE",
            hide_parameters=True,
        )
        try:
            report = CastleSyncRepository(sessionmaker(engine, expire_on_commit=False)).run(
                bundle,
                config,
                apply=args.operation == "apply",
                expected_plan=os.environ.get("CASTLE_EXPECTED_PLAN", ""),
                allow_projection_gaps=os.environ.get("CASTLE_ALLOW_GAPS") == "true",
            )
        finally:
            engine.dispose()
        encoded = json.dumps(report, indent=2)
        (temporary / "castle-sync-report.json").write_text(encoded)
        print(encoded)
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with Path(summary).open("a") as output:
                output.write(
                    f"\nCastle sync ({args.operation}, {args.projection})\n\n"
                    f"```json\n{encoded}\n```\n"
                )
    finally:
        source.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # SQL errors may contain source payloads or connection parameters.
        print(
            "Castle sync stopped. Check the last successful report, mapping, "
            "expected plan and staging access. No raw error or credentials logged."
        )
        raise SystemExit(1) from None
