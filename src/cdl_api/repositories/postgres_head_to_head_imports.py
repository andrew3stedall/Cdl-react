"""Transactional historical head-to-head import projection."""

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
    head_to_head_records_table,
)

HistoricalImportRepository = PostgreSQLHistoricalImportRepository
PayloadChange = tuple[str, dict[str, object], dict[str, object] | None]


class PostgreSQLHistoricalHeadToHeadImportRepository(HistoricalImportRepository):
    """Project matchup aggregates from mapped persisted fixtures and results."""

    def run(
        self,
        batch: HistoricalImportBatch,
        *,
        dry_run: bool,
    ) -> HistoricalImportAudit:
        invalid_records = any(
            record.entity_type != "head_to_head_record" for record in batch.records
        )
        if invalid_records:
            prefix = "Historical head-to-head projection accepts only "
            raise ValueError(f"{prefix}head_to_head_record records.")

        digest = self.batch_digest(batch)
        with self._session_factory() as session:
            existing_batch = self._payload(
                session,
                import_batches_table,
                batch.batch_id,
            )
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
            conflict_set = set(conflicts)

            created = archived = unchanged = projected = unchanged_domain = 0
            review_items: list[str] = []
            review_reasons: dict[str, str] = {}
            payload_changes: list[PayloadChange] = []
            domain_changes: list[dict[str, object]] = []

            for record in batch.records:
                raw_fixture_keys = record.payload.get("fixture_source_keys", [])
                fixture_keys = [str(value) for value in raw_fixture_keys]
                record_keys = {record.mapping_key, *fixture_keys}
                if record_keys & conflict_set:
                    review_items.append(record.source_record_id)
                    review_reasons[record.source_record_id] = "mapping_conflict"
                    continue

                record_id = effective_mappings.get(record.mapping_key)
                fixture_ids = [effective_mappings.get(key) for key in fixture_keys]
                missing_mapping = record_id is None or any(value is None for value in fixture_ids)
                if missing_mapping:
                    review_items.append(record.source_record_id)
                    review_reasons[record.source_record_id] = "missing_mapping"
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
                    "target_id": record_id,
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

                team = TeamSummary.model_validate(record.payload.get("team"))
                opponent = TeamSummary.model_validate(record.payload.get("opponent"))
                resolved_fixture_ids = [str(value) for value in fixture_ids]
                aggregate = self._aggregate(
                    session,
                    resolved_fixture_ids,
                    team.id,
                    opponent.id,
                )
                if isinstance(aggregate, str):
                    review_items.append(record.source_record_id)
                    review_reasons[record.source_record_id] = aggregate
                    continue

                aggregate_keys = (
                    "played",
                    "wins",
                    "draws",
                    "losses",
                    "points_for",
                    "points_against",
                )
                expected_aggregate = {
                    key: int(record.payload.get(key, 0)) for key in aggregate_keys
                }
                if aggregate != expected_aggregate:
                    message = "Head-to-head aggregate does not match persisted results."
                    raise ValueError(message)

                expected = {
                    "team": team.model_dump(mode="json"),
                    "opponent": opponent.model_dump(mode="json"),
                    **aggregate,
                    "fixture_ids": resolved_fixture_ids,
                    "synthetic": batch.synthetic,
                }
                current = self._payload(
                    session,
                    head_to_head_records_table,
                    str(record_id),
                )
                if current == expected:
                    unchanged_domain += 1
                elif current is not None:
                    prefix = f"Head-to-head target {record_id!r} already exists "
                    raise ValueError(f"{prefix}with different content.")
                else:
                    projected += 1
                    domain_changes.append({"id": str(record_id), "payload_json": expected})

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
                conflicts,
                review_reasons,
            )
            for values in domain_changes:
                session.execute(insert(head_to_head_records_table).values(**values))
            session.commit()
            return audit

    @classmethod
    def _aggregate(
        cls,
        session: Session,
        fixture_ids: list[str],
        team_id: str,
        opponent_id: str,
    ) -> dict[str, int] | str:
        aggregate = {
            "played": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "points_for": 0,
            "points_against": 0,
        }
        fixture_id_column = fixture_results_table.c.payload_json["fixture_id"].as_string()
        for fixture_id in fixture_ids:
            fixture = cls._payload(session, cdl_fixtures_table, fixture_id)
            if fixture is None:
                return "missing_fixture"
            result = session.execute(
                select(fixture_results_table.c.payload_json).where(
                    fixture_id_column == fixture_id
                )
            ).scalar_one_or_none()
            if result is None:
                return "missing_result"

            fixture_payload = dict(fixture)
            result_payload = dict(result)
            home_id = str(fixture_payload.get("home_team", {}).get("id", ""))
            away_id = str(fixture_payload.get("away_team", {}).get("id", ""))
            if {home_id, away_id} != {team_id, opponent_id}:
                raise ValueError("Head-to-head fixture teams do not match the aggregate teams.")
            home_score = int(result_payload.get("home_score", 0))
            away_score = int(result_payload.get("away_score", 0))
            team_home = home_id == team_id
            points_for = home_score if team_home else away_score
            points_against = away_score if team_home else home_score
            aggregate["played"] += 1
            aggregate["points_for"] += points_for
            aggregate["points_against"] += points_against
            if points_for > points_against:
                aggregate["wins"] += 1
            elif points_for == points_against:
                aggregate["draws"] += 1
            else:
                aggregate["losses"] += 1
        return aggregate

    @staticmethod
    def _persist_reviews(
        session: Session,
        batch: HistoricalImportBatch,
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
            review_hash = hashlib.sha256(
                f"{batch.batch_id}:review:{record_id}".encode()
            ).hexdigest()
            session.execute(
                insert(import_review_items_table).values(
                    id=review_hash[:64],
                    payload_json={
                        "batch_id": batch.batch_id,
                        "source_record_id": record_id,
                        "reason": reason,
                        "status": "open",
                        "synthetic": batch.synthetic,
                    },
                )
            )
