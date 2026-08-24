"""Passkey credentials and one-time WebAuthn challenge repositories."""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import uuid4


@dataclass(frozen=True)
class PasskeyRecord:
    credential_id: str
    user_id: str
    public_key: bytes
    sign_count: int
    transports: list[str] = field(default_factory=list)
    nickname: str = "This device"


@dataclass(frozen=True)
class AuthChallengeRecord:
    challenge_id: str
    kind: str
    challenge: bytes
    user_id: str | None
    expires_at: datetime


class InMemoryPasskeyRepository:
    def __init__(self) -> None:
        self._credentials: dict[str, PasskeyRecord] = {}

    def list_for_user(self, user_id: str) -> list[PasskeyRecord]:
        return [record for record in self._credentials.values() if record.user_id == user_id]

    def get(self, credential_id: str) -> PasskeyRecord | None:
        return self._credentials.get(credential_id)

    def create(self, record: PasskeyRecord) -> None:
        if record.credential_id in self._credentials:
            raise ValueError("Passkey is already registered.")
        self._credentials[record.credential_id] = record

    def update_sign_count(self, credential_id: str, sign_count: int) -> None:
        record = self._credentials.get(credential_id)
        if record is None:
            return
        self._credentials[credential_id] = PasskeyRecord(
            credential_id=record.credential_id,
            user_id=record.user_id,
            public_key=record.public_key,
            sign_count=sign_count,
            transports=record.transports,
            nickname=record.nickname,
        )


class InMemoryAuthChallengeRepository:
    def __init__(self) -> None:
        self._challenges: dict[str, AuthChallengeRecord] = {}

    def create(
        self,
        *,
        kind: str,
        challenge: bytes,
        user_id: str | None,
        ttl: timedelta = timedelta(minutes=5),
    ) -> str:
        challenge_id = str(uuid4())
        self._challenges[challenge_id] = AuthChallengeRecord(
            challenge_id=challenge_id,
            kind=kind,
            challenge=challenge,
            user_id=user_id,
            expires_at=datetime.now(UTC) + ttl,
        )
        return challenge_id

    def consume(
        self,
        challenge_id: str | None,
        *,
        kind: str,
        user_id: str | None = None,
    ) -> AuthChallengeRecord | None:
        if challenge_id is None:
            return None
        record = self._challenges.pop(challenge_id, None)
        if record is None or record.kind != kind or record.expires_at <= datetime.now(UTC):
            return None
        if user_id is not None and record.user_id != user_id:
            return None
        return record
