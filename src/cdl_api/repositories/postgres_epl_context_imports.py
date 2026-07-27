"""Transactional historical EPL fixture-context import projection."""

import hashlib

from sqlalchemy import insert
from sqlalchemy.orm import Session

from cdl_api.contracts.imports import HistoricalImportAudit, HistoricalImportBatch
from cdl_api.repositories.postgres_imports import (
    PostgreSQLHistoricalImportRepository,
    import_batches_table,
    import_conflicts_table,
    import_review_items_table,
    import_source_payloads_table,
)
from cdl_api.repositories.postgres_league_fixtures import (
    epl_fixtures_table,
    fixture_scoring_snapshots_table,
)


class PostgreSQLHistoricalEplContextImportRepository(PostgreSQLHistoricalImportRepository):
    """Persist synthetic EPL contexts only when scoring snapshots explicitly link them."""

    def run(
        self,
        batch: HistoricalImportBatch,
        *,
        dry_run: bool,
    ) -> HistoricalImportAudit:
        if any(record.entity_type != "epl_fixture_context" for record in batch.records):
            raise ValueError(
                "Historical EPL context projection accepts only epl_fixture_context records."
            )

        digest = self.batch_digest(batch)
        with self._session_factory() as session:
            existing_batch = self._payload(session, import_batches_table, batch.batch_id)
            if existing_batch is not None:
                if existing_batch.get("batch_digest") != digest:
                    raise ValueError("Import batch ID already exists with different content.")
                return HistoricalImportAudit(
                    batch_id=batch.batch_id,
                    contract_version=batch.contract_version,
                    dry_run=dry_run,
                    batch_digest=digest,
                    unchanged_payloads=len(batch.records),
                    unchanged_domain_records=len(batch.records),
                    repeated_batch=True,
                )

            stored_mappings = self._stored_mappings(session, batch.source_system)
            requested_mappings = {
                mapping.source_key: mapping.target_id for mapping in batch.mappings
            }
            effective_mappings = {**stored_mappings, **requested_mappings}
            conflicts = sorted(
                source_key
                for source_key, target_id in requested_mappings.items()
                if source_key in stored_mappings and stored_mappings[source_key] != target_id
            )

            created = archived = unchanged = projected = unchanged_domain = 0
            review_items: list[str] = []
            missing_snapshots: list[str] = []
            missing_links: list[str] = []
            payload_changes: list[tuple[str, dict[str, object], dict[str, object] | None]] = []
            domain_changes: list[tuple[str, dict[str, object]]] = []

            for record in batch.records:
                if record.mapping_key in conflicts:
                    review_items.append(record.source_record_id)
                    continue
                epl_fixture_id = effective_mappings.get(record.mapping_key)
                if epl_fixture_id is None:
                    review_items.append(record.source_record_id)
                    continue

                payload_id = self._payload_id(
                    batch.source_system,
                    record.source_record_id,
                )
                next_payload: dict[str, object] = {
                    "contract_version": batch.contract_version,
                    "batch_id": batch.batch_id,
                    "source_system": batch.source_system,
                    "source_record_id": record.source_record_id,
                    "mapping_key": record.mapping_key,
                    "target_id": epl_fixture_id,
                    "entity_type": record.entity_type,
                    "payload": record.payload,
                    "synthetic": batch.synthetic,
                    "archived": False,
                }
                current_payload = self._payload(
                    session,
                    import_source_payloads_table,
                    payload_id,
                )
                if current_payload == next_payload:
                    unchanged += 1
                else:
                    created += current_payload is None
                    archived += current_payload is not None
                    payload_changes.append((payload_id, next_payload, current_payload))

                snapshot_id = str(record.payload.get("scoring_snapshot_id", ""))
                snapshot = self._payload(
                    session,
                    fixture_scoring_snapshots_table,
                    snapshot_id,
                )
                if snapshot is None:
                    review_items.append(record.source_record_id)
                    missing_snapshots.append(record.source_record_id)
                    continue
                linked_ids = snapshot.get("epl_fixture_ids", [])
                if not isinstance(linked_ids, list) or epl_fixture_id not in linked_ids:
                    review_items.append(record.source_record_id)
                    missing_links.append(record.source_record_id)
                    continue

                gameweek_number = int(record.payload["gameweek"])
                context_payload: dict[str, object] = {
                    "id": epl_fixture_id,
                    "gameweek": {
                        "id": f"epl-gw-{gameweek_number}",
                        "name": f"Gameweek {gameweek_number}",
                        "number": gameweek_number,
                    },
                    "home_team": record.payload["home_team"],
                    "away_team": record.payload["away_team"],
                    "status": record.payload["status"],
                    "kickoff_label": record.payload["kickoff_label"],
                    "synthetic": batch.synthetic,
                    "import_batch_id": batch.batch_id,
                    "source_record_id": record.source_record_id,
                    "scoring_snapshot_id": snapshot_id,
                }
                current_context = self._payload(
                    session,
                    epl_fixtures_table,
                    epl_fixture_id,
                )
                if current_context == context_payload:
                    unchanged_domain += 1
                elif current_context is not None:
                    raise ValueError(
                        f"EPL fixture context target {epl_fixture_id!r} already exists "
                        "with different content."
                    )
                else:
                    projected += 1
                    domain_changes.append((epl_fixture_id, context_payload))

            audit = HistoricalImportAudit(
                batch_id=batch.batch_id,
                contract_version=batch.contract_version,
                dry_run=dry_run,
                batch_digest=digest,
                created_payloads=created,
                archived_payloads=archived,
                unchanged_payloads=unchanged,
                projected_records=projected,
                unchanged_domain_records=unchanged_domain,
                mapping_conflicts=conflicts,
                review_items=sorted(set(review_items)),
            )
            if dry_run:
                return audit

            session.execute(
                insert(import_batches_table).values(
                    id=batch.batch_id,
                    payload_json={
                        "contract_version": batch.contract_version,
                        "source_system": batch.source_system,
                        "batch_digest": digest,
                        "synthetic": batch.synthetic,
                        "audit": audit.model_dump(mode="json"),
                    },
                )
            )
            self._persist_mappings(session, batch, stored_mappings, conflicts)
            self._persist_payload_changes(
                session,
                batch.batch_id,
                payload_changes,
            )
            self._persist_reviews(
                session,
                batch,
                conflicts=conflicts,
                review_items=review_items,
                missing_snapshots=missing_snapshots,
                missing_links=missing_links,
            )
            for context_id, payload in domain_changes:
                session.execute(
                    insert(epl_fixtures_table).values(
                        id=context_id,
                        payload_json=payload,
                    )
                )
            session.commit()
            return audit

    @staticmethod
    def _persist_reviews(
        session: Session,
        batch: HistoricalImportBatch,
        *,
        conflicts: list[str],
        review_items: list[str],
        missing_snapshots: list[str],
        missing_links: list[str],
    ) -> None:
        for source_key in conflicts:
            conflict_id = hashlib.sha256(
                f"{batch.batch_id}:conflict:{source_key}".encode()
            ).hexdigest()[:64]
            session.execute(
                insert(import_conflicts_table).values(
                    id=conflict_id,
                    payload_json={
                        "batch_id": batch.batch_id,
                        "source_key": source_key,
                        "status": "unresolved",
                        "synthetic": batch.synthetic,
                    },
                )
            )
        missing_snapshot_set = set(missing_snapshots)
        missing_link_set = set(missing_links)
        for record_id in sorted(set(review_items)):
            reason = "mapping_conflict"
            if record_id in missing_snapshot_set:
                reason = "missing_scoring_snapshot"
            elif record_id in missing_link_set:
                reason = "missing_scoring_link"
            review_id = hashlib.sha256(f"{batch.batch_id}:review:{record_id}".encode()).hexdigest()[
                :64
            ]
            session.execute(
                insert(import_review_items_table).values(
                    id=review_id,
                    payload_json={
                        "batch_id": batch.batch_id,
                        "source_record_id": record_id,
                        "reason": reason,
                        "status": "open",
                        "synthetic": batch.synthetic,
                    },
                )
            )
