"""Service boundary for versioned historical-import validation."""

from typing import Protocol

from cdl_api.contracts.imports import HistoricalImportAudit, HistoricalImportBatch


class HistoricalImportRepository(Protocol):
    def run(
        self,
        batch: HistoricalImportBatch,
        *,
        dry_run: bool,
    ) -> HistoricalImportAudit: ...


class HistoricalImportService:
    """Validate a supported contract before delegating persistence."""

    SUPPORTED_CONTRACT_VERSION = "historical-import/v1"

    def __init__(self, repository: HistoricalImportRepository) -> None:
        self._repository = repository

    def execute(
        self,
        batch: HistoricalImportBatch,
        *,
        dry_run: bool = True,
    ) -> HistoricalImportAudit:
        if batch.contract_version != self.SUPPORTED_CONTRACT_VERSION:
            raise ValueError("Unsupported historical import contract version.")
        if not batch.synthetic:
            raise ValueError(
                "Real historical imports require separately validated export evidence."
            )
        return self._repository.run(batch, dry_run=dry_run)
