"""Transactional historical league-table snapshot import projection."""

import hashlib

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.imports import HistoricalImportAudit, HistoricalImportBatch
from cdl_api.contracts.league_models import LeagueTableResponse
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
    league_table_snapshots_table,
)


class PostgreSQLHistoricalLeagueTableImportRepository(PostgreSQLHistoricalImportRepository):
    """Project snapshots only when all mapped fixtures and results exist."""

    def run(
        self,
        batch: HistoricalImportBatch,
        *,
        dry_run: bool,
    ) -> HistoricalImportAudit:
        if any(record.entity_type != "league_table_snapshot" for record in batch.records):
            raise ValueError(
                "Historical league-table projection accepts only league_table_snapshot records."
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
            review_reasons: dict[str, str] = {}
            payload_changes: list[tuple[str, dict[str, object], dict[str, object] | None]] = []
            domain_changes: list[dict[str, object]] = []

            for record in batch.records:
                fixture_keys = [str(key) for key in record.payload.get("fixture_source_keys", [])]
                if record.mapping_key in conflicts or any(key in conflicts for key in fixture_keys):
                    review_items.append(record.source_record_id)
                    review_reasons[record.source_record_id] = "mapping_conflict"
                    continue
                snapshot_id = effective_mappings.get(record.mapping_key)
                fixture_ids = [effective_mappings.get(key) for key in fixture_keys]
                if snapshot_id is None or any(fixture_id is None for fixture_id in fixture_ids):
                    review_items.append(record.source_record_id)
                    review_reasons[record.source_record_id] = "missing_mapping"
                    continue

                payload_id = self._payload_id(batch.source_system, record.source_record_id)
                next_payload: dict[str, object] = {
                    "contract_version": batch.contract_version,
                    "batch_id": batch.batch_id,
                    "source_system": batch.source_system,
                    "source_record_id": record.source_record_id,
                    "mapping_key": record.mapping_key,
                    "target_id": snapshot_id,
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

                missing_reason = self._missing_dependency_reason(
                    session,
                    [str(fixture_id) for fixture_id in fixture_ids],
                )
                if missing_reason is not None:
                    review_items.append(record.source_record_id)
                    review_reasons[record.source_record_id] = missing_reason
                    continue

                expected = LeagueTableResponse.model_validate(
                    {
                        "rows": record.payload.get("rows", []),
                        "source": "historical-import-synthetic-snapshot",
                    }
                ).model_dump(mode="json")
                expected.update(
                    {
                        "gameweek_id": str(record.payload.get("gameweek_id", "")),
                        "fixture_ids": [str(fixture_id) for fixture_id in fixture_ids],
                        "synthetic": batch.synthetic,
                    }
                )
                current = self._payload(session, league_table_snapshots_table, snapshot_id)
                if current == expected:
                    unchanged_domain += 1
                elif current is not None:
                    raise ValueError(
                        f"League-table snapshot target {snapshot_id!r} already exists "
                        "with different content."
                    )
                else:
                    projected += 1
                    domain_changes.append({"id": snapshot_id, "payload_json": expected})

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
            self._persist_reviews(
                session,
                batch,
                conflicts=conflicts,
                review_reasons=review_reasons,
            )
            for values in domain_changes:
                session.execute(insert(league_table_snapshots_table).values(**values))
            session.commit()
            return audit

    @staticmethod
    def _missing_dependency_reason(session: Session, fixture_ids: list[str]) -> str | None:
        for fixture_id in fixture_ids:
            fixture = session.execute(
                select(cdl_fixtures_table.c.id).where(cdl_fixtures_table.c.id == fixture_id)
            ).scalar_one_or_none()
            if fixture is None:
                return "missing_fixture"
            result = session.execute(
                select(fixture_results_table.c.id).where(
                    fixture_results_table.c.payload_json["fixture_id"].as_string() == fixture_id
                )
            ).scalar_one_or_none()
            if result is None:
                return "missing_result"
        return None

    @staticmethod
    def _persist_reviews(
        session: Session,
        batch: HistoricalImportBatch,
        *,
        conflicts: list[str],
        review_reasons: dict[str, str],
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
        for record_id, reason in sorted(review_reasons.items()):
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
