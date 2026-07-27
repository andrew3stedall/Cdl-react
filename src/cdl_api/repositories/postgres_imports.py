"""PostgreSQL metadata and deterministic historical-import persistence."""

import hashlib
import json
from collections.abc import Callable, Mapping

from sqlalchemy import JSON, Column, DateTime, MetaData, String, Table, insert, select, update
from sqlalchemy.orm import Session

from cdl_api.contracts.imports import HistoricalImportAudit, HistoricalImportBatch
from cdl_api.repositories.postgres_league_fixtures import cdl_fixtures_table

metadata = MetaData()


def _import_table(name: str) -> Table:
    """Match the generic payload schema created by migration 0008."""
    return Table(
        name,
        metadata,
        Column("id", String(64), primary_key=True),
        Column("payload_json", JSON(), nullable=False),
        Column("created_at", DateTime(timezone=True), nullable=True),
    )


import_batches_table = _import_table("import_batches")
import_source_mappings_table = _import_table("import_source_mappings")
import_source_payloads_table = _import_table("import_source_payloads")
import_review_items_table = _import_table("import_review_items")
import_conflicts_table = _import_table("import_conflicts")

HISTORICAL_IMPORT_PERSISTENCE_TABLES = (
    import_batches_table,
    import_source_mappings_table,
    import_source_payloads_table,
    import_review_items_table,
    import_conflicts_table,
)


class PostgreSQLHistoricalImportRepository:
    """Persist one versioned import batch and its supported domain projection."""

    def __init__(self, session_factory: Callable[[], Session]) -> None:
        self._session_factory = session_factory

    @staticmethod
    def batch_digest(batch: HistoricalImportBatch) -> str:
        canonical = json.dumps(
            batch.model_dump(mode="json"), sort_keys=True, separators=(",", ":")
        ).encode()
        return hashlib.sha256(canonical).hexdigest()

    def run(self, batch: HistoricalImportBatch, *, dry_run: bool) -> HistoricalImportAudit:
        digest = self.batch_digest(batch)
        with self._session_factory() as session:
            existing_batch = self._payload(session, import_batches_table, batch.batch_id)
            if existing_batch is not None:
                if existing_batch.get("batch_digest") != digest:
                    raise ValueError("Import batch ID already exists with different content.")
                projected = sum(record.entity_type == "cdl_fixture" for record in batch.records)
                return HistoricalImportAudit(
                    batch_id=batch.batch_id,
                    contract_version=batch.contract_version,
                    dry_run=dry_run,
                    batch_digest=digest,
                    unchanged_payloads=len(batch.records),
                    unchanged_domain_records=projected,
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
            payload_changes: list[tuple[str, dict[str, object], dict[str, object] | None]] = []
            domain_changes: list[tuple[str, dict[str, object]]] = []

            for record in batch.records:
                if record.mapping_key in conflicts:
                    review_items.append(record.source_record_id)
                    continue
                target_id = effective_mappings.get(record.mapping_key)
                if target_id is None:
                    review_items.append(record.source_record_id)
                    continue

                payload_id = self._payload_id(batch.source_system, record.source_record_id)
                next_payload: dict[str, object] = {
                    "contract_version": batch.contract_version,
                    "batch_id": batch.batch_id,
                    "source_system": batch.source_system,
                    "source_record_id": record.source_record_id,
                    "mapping_key": record.mapping_key,
                    "target_id": target_id,
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

                if record.entity_type != "cdl_fixture":
                    continue
                domain_payload: dict[str, object] = {
                    **record.payload,
                    "id": target_id,
                    "synthetic": batch.synthetic,
                    "import_batch_id": batch.batch_id,
                    "source_record_id": record.source_record_id,
                }
                current_domain = self._payload(session, cdl_fixtures_table, target_id)
                if current_domain == domain_payload:
                    unchanged_domain += 1
                elif current_domain is not None:
                    raise ValueError(
                        f"CDL fixture target {target_id!r} already exists with different content."
                    )
                else:
                    projected += 1
                    domain_changes.append((target_id, domain_payload))

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
                review_items=sorted(review_items),
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
            self._persist_conflicts(session, batch, conflicts, review_items)
            self._persist_payload_changes(session, batch.batch_id, payload_changes)
            for target_id, payload in domain_changes:
                session.execute(
                    insert(cdl_fixtures_table).values(id=target_id, payload_json=payload)
                )
            session.commit()
            return audit

    @staticmethod
    def _payload_id(source_system: str, source_record_id: str) -> str:
        digest = hashlib.sha256(f"{source_system}:{source_record_id}".encode()).hexdigest()
        return f"source-{digest[:57]}"

    @staticmethod
    def _payload(session: Session, table: Table, row_id: str) -> dict[str, object] | None:
        value = session.execute(
            select(table.c.payload_json).where(table.c.id == row_id)
        ).scalar_one_or_none()
        if value is None:
            return None
        if not isinstance(value, Mapping):
            raise ValueError(f"{table.name} payload must be a JSON object.")
        return dict(value)

    @staticmethod
    def _stored_mappings(session: Session, source_system: str) -> dict[str, str]:
        rows = session.execute(select(import_source_mappings_table.c.payload_json)).scalars()
        mappings: dict[str, str] = {}
        for value in rows:
            if not isinstance(value, Mapping) or value.get("source_system") != source_system:
                continue
            mappings[str(value["source_key"])] = str(value["target_id"])
        return mappings

    @staticmethod
    def _persist_mappings(
        session: Session,
        batch: HistoricalImportBatch,
        stored_mappings: dict[str, str],
        conflicts: list[str],
    ) -> None:
        for mapping in batch.mappings:
            if mapping.source_key in stored_mappings or mapping.source_key in conflicts:
                continue
            mapping_id = hashlib.sha256(
                f"{batch.source_system}:{mapping.source_key}".encode()
            ).hexdigest()[:64]
            session.execute(
                insert(import_source_mappings_table).values(
                    id=mapping_id,
                    payload_json={
                        "contract_version": batch.contract_version,
                        "source_system": batch.source_system,
                        "source_key": mapping.source_key,
                        "target_id": mapping.target_id,
                        "synthetic": batch.synthetic,
                    },
                )
            )

    @staticmethod
    def _persist_conflicts(
        session: Session,
        batch: HistoricalImportBatch,
        conflicts: list[str],
        review_items: list[str],
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
        for record_id in review_items:
            review_id = hashlib.sha256(f"{batch.batch_id}:review:{record_id}".encode()).hexdigest()[
                :64
            ]
            session.execute(
                insert(import_review_items_table).values(
                    id=review_id,
                    payload_json={
                        "batch_id": batch.batch_id,
                        "source_record_id": record_id,
                        "reason": "mapping_conflict",
                        "status": "open",
                        "synthetic": batch.synthetic,
                    },
                )
            )

    @staticmethod
    def _persist_payload_changes(
        session: Session,
        batch_id: str,
        changes: list[tuple[str, dict[str, object], dict[str, object] | None]],
    ) -> None:
        for payload_id, next_payload, current_payload in changes:
            if current_payload is None:
                session.execute(
                    insert(import_source_payloads_table).values(
                        id=payload_id, payload_json=next_payload
                    )
                )
                continue
            archive_digest = hashlib.sha256(
                json.dumps(current_payload, sort_keys=True).encode()
            ).hexdigest()[:12]
            archive_id = f"archive-{archive_digest}-{payload_id[-43:]}"
            session.execute(
                insert(import_source_payloads_table).values(
                    id=archive_id,
                    payload_json={
                        **current_payload,
                        "archived": True,
                        "archived_by_batch_id": batch_id,
                    },
                )
            )
            session.execute(
                update(import_source_payloads_table)
                .where(import_source_payloads_table.c.id == payload_id)
                .values(payload_json=next_payload)
            )
