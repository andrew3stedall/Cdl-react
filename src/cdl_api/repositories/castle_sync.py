"""Transactional, provenance-preserving sync using the existing import tables."""

# ruff: noqa: ANN401
import json
from collections import Counter
from collections.abc import Callable
from typing import Any

from sqlalchemy import MetaData, Table, delete, insert, select, text, update
from sqlalchemy.orm import Session

from cdl_api.contracts.castle_sync import CastleSyncConfig
from cdl_api.services.castle_source_adapter import CastleSourceAdapter, canonical, digest, sync_id

CATALOG_TABLES = (
    "leagues",
    "seasons",
    "managers",
    "draft_teams",
    "fpl_players",
    "external_payload_cache",
    "fpl_gameweeks",
    "squad_ownerships",
    "team_selection_lineup_slots",
    "cdl_fixtures",
    "fixture_results",
    "fixture_scoring_snapshots",
    "trade_proposals",
    "trade_assets",
    "squad_rejection_reasons",
)
IMPORT_TABLES = ("import_batches", "import_source_payloads", "import_source_mappings")
WRITABLE_NATIVE = {
    "team_selection_lineup_slots",
    "cdl_fixtures",
    "fixture_results",
    "trade_proposals",
    "trade_assets",
    "squad_rejection_reasons",
}


class CastleSyncRepository:
    """Archive all non-FPL source data; optionally project compatible native rows.

    Missing source rows never trigger deletion. No account, membership, FPL,
    ownership or movement-execution table is writable through this repository.
    """

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self.factory = session_factory

    def run(
        self,
        bundle: dict[str, Any],
        config: CastleSyncConfig,
        *,
        apply: bool = False,
        expected_plan: str = "",
        allow_projection_gaps: bool = False,
    ) -> dict[str, Any]:
        with self.factory() as session, session.begin():
            if session.bind.dialect.name == "postgresql":
                # Serialize this importer in the selected destination scope.
                session.execute(
                    text("SELECT pg_advisory_xact_lock(:key)"),
                    {
                        "key": int(
                            digest([config.target_league_id, config.target_season_id])[:15], 16
                        )
                    },
                )
            metadata = MetaData()
            tables = {
                name: Table(name, metadata, autoload_with=session.connection())
                for name in (*CATALOG_TABLES, *IMPORT_TABLES)
            }
            catalog = {
                name: [dict(row) for row in session.execute(select(tables[name])).mappings()]
                for name in CATALOG_TABLES
            }
            saved = {
                row["id"]: row["payload_json"]
                for row in session.execute(select(tables["import_source_payloads"])).mappings()
            }
            mappings = {
                row["id"]: row["payload_json"]
                for row in session.execute(select(tables["import_source_mappings"])).mappings()
            }
            if config.replace_current_gameweek_synthetic and (
                config.projection != "native"
                or config.lineup_gameweek is None
                or "team_selection_lineup_slots" not in config.native_entities
            ):
                raise ValueError("Synthetic replacement requires a current-week native lineup-only plan")
            adapter = CastleSourceAdapter(bundle, config, catalog, existing_mappings=mappings)
            adapter.build_projections()
            if config.native_entities:
                selected_entities = set(config.native_entities)
                unsupported_entities = selected_entities - WRITABLE_NATIVE
                if unsupported_entities:
                    raise ValueError("Unsupported native projection entity")
                adapter.projections = [
                    projection
                    for projection in adapter.projections
                    if projection["table"] in selected_entities
                ]
                if config.restore_missing:
                    adapter.projections = [
                        projection
                        for projection in adapter.projections
                        if not any(
                            row["id"] == projection["id"] for row in catalog[projection["table"]]
                        )
                    ]
                adapter.lineup_deletions = [
                    deletion
                    for deletion in adapter.lineup_deletions
                    if deletion["table"] in selected_entities
                ]
            source_digest = digest(adapter.files)
            native_intent = (
                [["upsert", p["table"], p["id"], digest(p["values"])] for p in adapter.projections]
                + [
                    ["delete", deletion["table"], deletion["id"]]
                    for deletion in adapter.lineup_deletions
                ]
                if config.projection == "native"
                else []
            )
            batch_id = sync_id(
                adapter.scope,
                "batch",
                source_digest,
                config.model_dump_json(),
                digest(native_intent),
            )
            payload_changes = []
            archive_state = {}
            source_counts: Counter[str] = Counter()
            for path, data in sorted(adapter.files.items()):
                key = sync_id(adapter.scope, "source-file", path)
                old = saved.get(key)
                archive_state[key] = old.get("source_hash") if old else None
                new_hash = digest(data)
                entity = "castle_" + path.rsplit("/", 1)[-1].removesuffix(".json").replace("-", "_")
                if old and old.get("source_hash") == new_hash:
                    source_counts["unchanged_files"] += 1
                    continue
                source_counts["updated_files" if old else "created_files"] += 1
                payload_changes.append(
                    (
                        key,
                        {
                            "source_system": adapter.scope.split(":", 2)[0]
                            + ":uqaigbmofxhufamxylot",
                            "source_scope": adapter.scope,
                            "source_record_id": path,
                            "entity_type": entity,
                            "batch_id": batch_id,
                            "source_hash": new_hash,
                            "synthetic": False,
                            "archived": False,
                            "target_id": config.target_season_id,
                            "payload": {"file": path, "data": data},
                        },
                        old,
                    )
                )
            identity_changes = []
            mapping_conflicts = []
            for source_key, target in sorted(adapter.mappings.items()):
                mid = sync_id(adapter.scope, "mapping", source_key)
                previous = mappings.get(mid)
                if previous and previous.get("target_id") != target:
                    mapping_conflicts.append(mid)
                if not previous:
                    identity_changes.append(
                        (
                            mid,
                            {
                                "source_scope": adapter.scope,
                                "source_key": source_key,
                                "target_id": target,
                                "synthetic": False,
                            },
                        )
                    )
            native_changes, native_deletions, native_states = [], [], []
            native_conflicts = []
            synthetic_current_gameweek_overwrites = 0
            seen = set()
            for projection in adapter.projections:
                name, row_id, values = projection["table"], projection["id"], projection["values"]
                if name not in WRITABLE_NATIVE or (name, row_id) in seen:
                    raise ValueError("Unsupported or duplicate native projection")
                seen.add((name, row_id))
                current = next((r for r in catalog[name] if r["id"] == row_id), None)
                before = {key: current[key] for key in values} if current else None
                state_key = sync_id(adapter.scope, "projection", name, row_id)
                prior = mappings.get(state_key)
                before_hash = digest(before)
                native_states.append([state_key, before_hash])
                replace_synthetic_current = (
                    config.replace_current_gameweek_synthetic
                    and name == "team_selection_lineup_slots"
                    and config.lineup_gameweek is not None
                    and current is not None
                    and int(current["gameweek"]) == config.lineup_gameweek
                    and str(current["id"]).startswith("lineup-")
                    and current["locked_at"] is None
                )
                protected = (
                    prior
                    and prior.get("last_digest") != before_hash
                    and not (
                        (config.restore_missing and current is None)
                        or replace_synthetic_current
                    )
                )
                if prior and prior.get("last_digest") != before_hash and replace_synthetic_current:
                    synthetic_current_gameweek_overwrites += 1
                unadopted = (
                    current
                    and not prior
                    and digest(before) != digest(values)
                    and not config.adopt_existing
                )
                if protected or unadopted:
                    native_conflicts.append(state_key)
                    continue
                native_changes.append((projection, before, state_key, prior))
            seen_deletions = set()
            for deletion in adapter.lineup_deletions:
                name, row_id = deletion["table"], deletion["id"]
                if name != "team_selection_lineup_slots" or row_id in seen_deletions:
                    raise ValueError("Unsupported or duplicate native deletion")
                seen_deletions.add(row_id)
                current = next((r for r in catalog[name] if r["id"] == row_id), None)
                if current is None:
                    continue
                before = dict(current)
                state_key = sync_id(adapter.scope, "projection-delete", name, row_id)
                prior = mappings.get(state_key)
                before_hash = digest(before)
                native_states.append([state_key, before_hash])
                replace_synthetic_current = (
                    config.replace_current_gameweek_synthetic
                    and config.lineup_gameweek is not None
                    and int(current["gameweek"]) == config.lineup_gameweek
                    and str(current["id"]).startswith("lineup-")
                    and current["locked_at"] is None
                )
                protected = prior and prior.get("last_digest") != before_hash and not replace_synthetic_current
                if prior and prior.get("last_digest") != before_hash and replace_synthetic_current:
                    synthetic_current_gameweek_overwrites += 1
                unadopted = current and not prior and not config.adopt_existing
                if protected or unadopted:
                    native_conflicts.append(state_key)
                    continue
                native_deletions.append((deletion, before, state_key, prior))
            plan = digest(
                {
                    "source": source_digest,
                    "scope": adapter.scope,
                    "config": config.model_dump(),
                    "archive_state": archive_state,
                    "identity": sorted(adapter.mappings.items()),
                    "native_state": native_states if config.projection == "native" else [],
                    "native_intent": native_intent,
                    "mapping_conflicts": mapping_conflicts,
                    "gaps": dict(adapter.gaps),
                }
            )
            changes_by_table: Counter[str] = Counter()
            deletions_by_table: Counter[str] = Counter()
            for projection, before, _, _ in native_changes:
                if digest(before) != digest(projection["values"]):
                    changes_by_table[projection["table"]] += 1
            for deletion, _, _, _ in native_deletions:
                deletions_by_table[deletion["table"]] += 1
            report = {
                "contract": "castle-sync/v1",
                "plan_digest": plan,
                "batch_id": batch_id,
                "operation": "apply" if apply else "plan",
                "projection": config.projection,
                "source_files": len(adapter.files),
                "source_changes": dict(source_counts),
                "identity_mappings": len(adapter.mappings),
                "mapping_conflicts": len(mapping_conflicts),
                "native_changes": dict(changes_by_table),
                "native_deletions": dict(deletions_by_table),
                "native_conflicts": len(native_conflicts),
                "synthetic_current_gameweek_overwrites": synthetic_current_gameweek_overwrites,
                "gaps": dict(adapter.gaps),
                "archive_only": dict(adapter.archive_only),
                "already_represented": dict(adapter.already_represented),
                "team_match_review": adapter.team_match_review,
                "team_fuzzy_matches": adapter.team_fuzzy_matches,
                "fixture_team_review": adapter.fixture_team_review,
                "fixture_evidence_review": adapter.fixture_evidence_review,
                "lineup_review": adapter.lineup_review,
                "applied": False,
            }
            if not apply:
                return report
            if expected_plan != plan:
                raise ValueError("Source or destination changed; rerun plan before applying")
            if mapping_conflicts:
                raise ValueError("Source identity mapping conflicts require review")
            if config.projection == "native" and (
                native_conflicts or (adapter.gaps and not allow_projection_gaps)
            ):
                raise ValueError("Native conflicts or archival-only gaps require review")
            for key, payload, previous in payload_changes:
                if previous:
                    history_id = sync_id(key, previous["source_hash"])
                    if history_id not in saved:
                        session.execute(
                            insert(tables["import_source_payloads"]).values(
                                id=history_id,
                                payload_json={
                                    **previous,
                                    "archived": True,
                                    "archived_by_batch_id": batch_id,
                                },
                            )
                        )
                self._put(
                    session, tables["import_source_payloads"], key, payload, previous is not None
                )
            for mid, payload in identity_changes:
                self._put(session, tables["import_source_mappings"], mid, payload, False)
            if config.projection == "native":
                for deletion, before, state_key, prior in native_deletions:
                    table, row_id = tables[deletion["table"]], deletion["id"]
                    backup_key = sync_id(
                        adapter.scope,
                        "target-before",
                        table.name,
                        row_id,
                        digest(before),
                    )
                    if backup_key not in saved:
                        session.execute(
                            insert(tables["import_source_payloads"]).values(
                                id=backup_key,
                                payload_json={
                                    "source_scope": adapter.scope,
                                    "entity_type": "castle_target_backup",
                                    "batch_id": batch_id,
                                    "table": table.name,
                                    "target_id": row_id,
                                    "payload": json.loads(canonical(before)),
                                    "archived": True,
                                },
                            )
                        )
                    session.execute(delete(table).where(table.c.id == row_id))
                    self._put(
                        session,
                        tables["import_source_mappings"],
                        state_key,
                        {
                            "source_scope": adapter.scope,
                            "source_key": f"projection-delete:{table.name}:{row_id}",
                            "target_id": row_id,
                            "last_digest": digest({"deleted": True}),
                            "synthetic": False,
                            "deleted": True,
                        },
                        prior is not None,
                    )
                for projection, before, state_key, prior in native_changes:
                    table, row_id, values = (
                        tables[projection["table"]],
                        projection["id"],
                        projection["values"],
                    )
                    if digest(before) != digest(values):
                        if before is not None:
                            backup_key = sync_id(
                                adapter.scope, "target-before", table.name, row_id, digest(before)
                            )
                            if backup_key not in saved:
                                session.execute(
                                    insert(tables["import_source_payloads"]).values(
                                        id=backup_key,
                                        payload_json={
                                            "source_scope": adapter.scope,
                                            "entity_type": "castle_target_backup",
                                            "batch_id": batch_id,
                                            "table": table.name,
                                            "target_id": row_id,
                                            "payload": json.loads(canonical(before)),
                                            "archived": True,
                                        },
                                    )
                                )
                            session.execute(
                                update(table).where(table.c.id == row_id).values(**values)
                            )
                        else:
                            session.execute(insert(table).values(id=row_id, **values))
                    self._put(
                        session,
                        tables["import_source_mappings"],
                        state_key,
                        {
                            "source_scope": adapter.scope,
                            "source_key": f"projection:{table.name}:{row_id}",
                            "target_id": row_id,
                            "last_digest": digest(values),
                            "synthetic": False,
                        },
                        prior is not None,
                    )
            report["applied"] = True
            if (
                session.execute(
                    select(tables["import_batches"].c.id).where(
                        tables["import_batches"].c.id == batch_id
                    )
                ).scalar_one_or_none()
                is None
            ):
                session.execute(
                    insert(tables["import_batches"]).values(
                        id=batch_id,
                        payload_json={
                            "source_system": "castle:uqaigbmofxhufamxylot",
                            "source_scope": adapter.scope,
                            "source_digest": source_digest,
                            "config": config.model_dump(),
                            "audit": report,
                            "synthetic": False,
                        },
                    )
                )
            return report

    @staticmethod
    def _put(session: Session, table: Table, key: str, payload: dict, exists: bool) -> None:
        if exists:
            session.execute(update(table).where(table.c.id == key).values(payload_json=payload))
        else:
            session.execute(insert(table).values(id=key, payload_json=payload))
