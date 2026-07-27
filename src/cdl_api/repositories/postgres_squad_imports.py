"""Transactional historical squad-membership import projection."""

import hashlib
from datetime import datetime

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from cdl_api.contracts.imports import HistoricalImportAudit, HistoricalImportBatch
from cdl_api.repositories.postgres_imports import (
    PostgreSQLHistoricalImportRepository,
    import_batches_table,
    import_conflicts_table,
    import_review_items_table,
    import_source_payloads_table,
)
from cdl_api.repositories.postgres_league_fpl import (
    draft_teams_table,
    fpl_players_table,
    seasons_table,
)
from cdl_api.repositories.postgres_squad import squad_ownerships_table


class PostgreSQLHistoricalSquadImportRepository(PostgreSQLHistoricalImportRepository):
    """Project ownership rows only when season, team, and player mappings exist."""

    def run(
        self,
        batch: HistoricalImportBatch,
        *,
        dry_run: bool,
    ) -> HistoricalImportAudit:
        if any(record.entity_type != "squad_membership" for record in batch.records):
            raise ValueError("Historical squad projection accepts only squad_membership records.")

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
                if record.mapping_key in conflicts:
                    review_items.append(record.source_record_id)
                    review_reasons[record.source_record_id] = "mapping_conflict"
                    continue
                ownership_id = effective_mappings.get(record.mapping_key)
                team_key = str(record.payload.get("team_source_key", ""))
                player_key = str(record.payload.get("player_source_key", ""))
                if team_key in conflicts or player_key in conflicts:
                    review_items.append(record.source_record_id)
                    review_reasons[record.source_record_id] = "mapping_conflict"
                    continue
                team_id = effective_mappings.get(team_key)
                player_id = effective_mappings.get(player_key)
                if ownership_id is None or team_id is None or player_id is None:
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
                    "target_id": ownership_id,
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

                season_id = str(record.payload.get("season_id", ""))
                missing_reason = self._missing_entity_reason(
                    session,
                    season_id=season_id,
                    team_id=team_id,
                    player_id=player_id,
                )
                if missing_reason is not None:
                    review_items.append(record.source_record_id)
                    review_reasons[record.source_record_id] = missing_reason
                    continue

                started_at = datetime.fromisoformat(str(record.payload["started_at"]))
                current = (
                    session.execute(
                        select(
                            squad_ownerships_table.c.season_id,
                            squad_ownerships_table.c.draft_team_id,
                            squad_ownerships_table.c.player_id,
                            squad_ownerships_table.c.roster_slot_id,
                            squad_ownerships_table.c.started_at,
                            squad_ownerships_table.c.ended_at,
                        ).where(squad_ownerships_table.c.id == ownership_id)
                    )
                    .mappings()
                    .one_or_none()
                )
                expected = {
                    "season_id": season_id,
                    "draft_team_id": team_id,
                    "player_id": player_id,
                    "roster_slot_id": None,
                    "started_at": started_at,
                    "ended_at": None,
                }
                if current is not None and dict(current) == expected:
                    unchanged_domain += 1
                elif current is not None:
                    raise ValueError(
                        f"Squad ownership target {ownership_id!r} already exists "
                        "with different content."
                    )
                else:
                    projected += 1
                    domain_changes.append({"id": ownership_id, **expected})

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
                review_reasons=review_reasons,
            )
            for values in domain_changes:
                session.execute(insert(squad_ownerships_table).values(**values))
            session.commit()
            return audit

    @staticmethod
    def _missing_entity_reason(
        session: Session,
        *,
        season_id: str,
        team_id: str,
        player_id: str,
    ) -> str | None:
        checks = (
            (seasons_table, season_id, "missing_season"),
            (draft_teams_table, team_id, "missing_team"),
            (fpl_players_table, player_id, "missing_player"),
        )
        for table, row_id, reason in checks:
            exists = session.execute(
                select(table.c.id).where(table.c.id == row_id)
            ).scalar_one_or_none()
            if exists is None:
                return reason
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
