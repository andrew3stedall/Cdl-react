"""Free-agency draw lifecycle and preference orchestration."""

from datetime import UTC, datetime

from cdl_api.contracts.free_agency import (
    FreeAgencyDrawCreateRequest,
    FreeAgencyDrawResponse,
    FreeAgencyDrawStatus,
    FreeAgencyPreference,
    FreeAgencyPreferencesRequest,
    FreeAgencyResultsResponse,
)
from cdl_api.repositories.free_agency_draws import PostgreSQLFreeAgencyDrawRepository


class FreeAgencyDrawError(ValueError):
    """A free-agency draw transition or preference was not valid."""


class FreeAgencyDrawService:
    def __init__(self, repository: PostgreSQLFreeAgencyDrawRepository) -> None:
        self._repository = repository

    def list_draws(self) -> list[FreeAgencyDrawResponse]:
        return self._repository.list_draws()

    def create_draw(self, request: FreeAgencyDrawCreateRequest) -> FreeAgencyDrawResponse:
        self._require_commissioner()
        if request.closes_at.tzinfo is None:
            raise FreeAgencyDrawError("Preference close time must include a timezone.")
        if request.opens_at is not None and request.opens_at.tzinfo is None:
            raise FreeAgencyDrawError("Preference open time must include a timezone.")
        try:
            return self._repository.create_draw(request)
        except ValueError as exc:
            raise FreeAgencyDrawError(str(exc)) from exc

    def open_draw(self, draw_id: str) -> FreeAgencyDrawResponse | None:
        self._require_commissioner()
        draw = self._repository.get_draw(draw_id)
        if draw is None:
            return None
        now = datetime.now(UTC)
        if draw.status != FreeAgencyDrawStatus.SCHEDULED:
            raise FreeAgencyDrawError("Only a scheduled draw can be opened.")
        if draw.opens_at is not None and draw.opens_at > now:
            raise FreeAgencyDrawError("The preference window has not opened yet.")
        if draw.closes_at <= now:
            raise FreeAgencyDrawError("The preference deadline has passed.")
        try:
            return self._repository.set_draw_status(
                draw_id,
                FreeAgencyDrawStatus.OPEN_FOR_PREFERENCES,
                "draw_opened",
                FreeAgencyDrawStatus.SCHEDULED,
            )
        except ValueError as exc:
            raise FreeAgencyDrawError(str(exc)) from exc

    def lock_draw(self, draw_id: str) -> FreeAgencyDrawResponse | None:
        self._require_commissioner()
        draw = self._repository.get_draw(draw_id)
        if draw is None:
            return None
        if draw.status != FreeAgencyDrawStatus.OPEN_FOR_PREFERENCES:
            raise FreeAgencyDrawError("Only an open draw can be locked.")
        try:
            return self._repository.set_draw_status(
                draw_id,
                FreeAgencyDrawStatus.LOCKED,
                "draw_locked",
                FreeAgencyDrawStatus.OPEN_FOR_PREFERENCES,
            )
        except ValueError as exc:
            raise FreeAgencyDrawError(str(exc)) from exc

    def submit_preferences(
        self, draw_id: str, request: FreeAgencyPreferencesRequest
    ) -> list[FreeAgencyPreference]:
        if len(request.player_ids) != len(set(request.player_ids)):
            raise FreeAgencyDrawError("Player IDs in ranked preferences must be unique.")
        try:
            return self._repository.submit_preferences(draw_id, request)
        except LookupError:
            raise
        except ValueError as exc:
            raise FreeAgencyDrawError(str(exc)) from exc

    def preferences(self, draw_id: str) -> list[FreeAgencyPreference]:
        return self._repository.preferences(draw_id)

    def process_draw(self, draw_id: str) -> FreeAgencyDrawResponse | None:
        self._require_commissioner()
        try:
            return self._repository.process_draw(draw_id)
        except ValueError as exc:
            raise FreeAgencyDrawError(str(exc)) from exc

    def results(self, draw_id: str) -> FreeAgencyResultsResponse | None:
        return self._repository.results(draw_id)

    def _require_commissioner(self) -> None:
        if not self._repository.is_commissioner():
            raise FreeAgencyDrawError("Commissioner role required.")
