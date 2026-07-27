"""Transactional historical-result import projection."""

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
    cdl_fixtures_table,
    fixture_results_table,
)


class PostgreSQLHistoricalResultImportRepository(PostgreSQLHistoricalImportRepository):
    """Persist synthetic result imports and project them into fixture results."""

    def run(self, batch: HistoricalImportBatch, *, dry_run: bool) -> HistoricalImportAudit:
        if any(record.entity_type != "cdl_result" for record in batch.records):
            raise ValueError("Historical result projection accepts only cdl_result records.")

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
            missing_fixtures: list[str] = []
            payload_changes: list[tuple[str, dict[str, object], dict[str, object] | None]] = []
            domain_changes: list[tuple[str, dict[str, object]]] = []

            for record in batch.records:
                if record.mapping_key in conflicts:
                    review_items.append(record.source_record_id)
                    continue
                fixture_id = effective_mappings.get(record.mapping_key)
                if fixture_id is None:
                    review_items.append(record.source_record_id)
                    continue

                payload_id = self._payload_id(batch.source_system, record.source_record_id)
                next_payload: dict[str, object] = {
                    "contract_version": batch.contract_version,
                    "batch_id": batch.batch_id,
                    "source_system": batch.source_system,
                    "source_record_id": record.source_record_id,
                    "mapping_key": record.mapping_key,
                    "target_id": fixture_id,
                    "entity_type": record.entity_type,
                    "payload": record.payload,
                    "synthetic": batch.synthetic,
                    "archived": False,
                }
                current_payload = self._payload(session, import_source_payloads_table, payload_id)
                if current_payload == next_payload:
                    unchanged += 1
                else:
                    created += current_payload is None
                    archived += current_payload is not None
                    payload_changes.append((payload_id, next_payload, current_payload))

                fixture = self._payload(session, cdl_fixtures_table, fixture_id)
                if fixture is None:
                    review_items.append(record.source_record_id)
                    missing_fixtures.append(record.source_record_id)
                    continue

                result_id = f"result-{fixture_id}"
                result_payload: dict[str, object] = {
                    **record.payload,
                    "fixture_id": fixture_id,
                    "synthetic": batch.synthetic,
                    "import_batch_id": batch.batch_id,
                    "source_record_id": record.source_record_id,
                }
                current_result = self._payload(session, fixture_results_table, result_id)
                if current_result == result_payload:
                    unchanged_domain += 1
                elif current_result is not None:
                    raise ValueError(
                        f"Fixture result target {result_id!r} already exists "
                        "with different content."
                    )
                else:
                    projected += 1
                    domain_changes.append((result_id, result_payload))

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
            self._persist_payload_changes(session, batch.batch_id, payload_changes)
            self._persist_result_reviews(
                session,
                batch,
                conflicts=conflicts,
                review_items=review_items,
                missing_fixtures=missing_fixtures,
            )
            for result_id, payload in domain_changes:
                session.execute(
                    insert(fixture_results_table).values(
                        id=result_id,
                        payload_json=payload,
                    )
                )
            session.commit()
            return audit

    @staticmethod
    def _persist_result_reviews(
        session: Session,
        batch: HistoricalImportBatch,
        *,
        conflicts: list[str],
        review_items: list[str],
        missing_fixtures: list[str],
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
        missing = set(missing_fixtures)
        for record_id in sorted(set(review_items)):
            review_id = hashlib.sha256(f"{batch.batch_id}:review:{record_id}".encode()).hexdigest()[
                :64
            ]
            session.execute(
                insert(import_review_items_table).values(
                    id=review_id,
                    payload_json={
                        "batch_id": batch.batch_id,
                        "source_record_id": record_id,
                        "reason": (
                            "missing_fixture" if record_id in missing else "mapping_conflict"
                        ),
                        "status": "open",
                        "synthetic": batch.synthetic,
                    },
                )
            )
