"""Transactional historical knockout import projection."""

import hashlib

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.domain import TeamSummary
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
    knockout_matches_table,
)


class PostgreSQLHistoricalKnockoutImportRepository(PostgreSQLHistoricalImportRepository):
    """Project knockout matches only when their mapped fixture and result exist."""

    def run(
        self,
        batch: HistoricalImportBatch,
        *,
        dry_run: bool,
    ) -> HistoricalImportAudit:
        if any(record.entity_type != "knockout_match" for record in batch.records):
            raise ValueError("Historical knockout projection accepts only knockout_match records.")

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
                fixture_key = str(record.payload.get("fixture_source_key", ""))
                if record.mapping_key in conflicts or fixture_key in conflicts:
                    review_items.append(record.source_record_id)
                    review_reasons[record.source_record_id] = "mapping_conflict"
                    continue
                match_id = effective_mappings.get(record.mapping_key)
                fixture_id = effective_mappings.get(fixture_key)
                if match_id is None or fixture_id is None:
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
                    "target_id": match_id,
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

                missing_reason = self._missing_dependency_reason(session, str(fixture_id))
                if missing_reason is not None:
                    review_items.append(record.source_record_id)
                    review_reasons[record.source_record_id] = missing_reason
                    continue

                rounds = [str(value) for value in record.payload.get("rounds", [])]
                round_label = str(record.payload.get("round_label", ""))
                if round_label not in rounds:
                    raise ValueError("Knockout round label must be present in rounds.")
                winner_payload = record.payload.get("winner")
                winner = (
                    TeamSummary.model_validate(winner_payload).model_dump(mode="json")
                    if winner_payload is not None
                    else None
                )
                expected = {
                    "fixture_id": str(fixture_id),
                    "round_label": round_label,
                    "rounds": rounds,
                    "winner": winner,
                    "synthetic": batch.synthetic,
                }
                current = self._payload(session, knockout_matches_table, str(match_id))
                if current == expected:
                    unchanged_domain += 1
                elif current is not None:
                    raise ValueError(
                        f"Knockout match target {match_id!r} already exists with different content."
                    )
                else:
                    projected += 1
                    domain_changes.append({"id": str(match_id), "payload_json": expected})

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
                session.execute(insert(knockout_matches_table).values(**values))
            session.commit()
            return audit

    @staticmethod
    def _missing_dependency_reason(session: Session, fixture_id: str) -> str | None:
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
