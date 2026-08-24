"""Passkey registration and authentication orchestration."""

import hashlib
import json
import secrets
from typing import Protocol

from webauthn import (
    base64url_to_bytes,
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import (
    bytes_to_base64url,
    parse_authentication_credential_json,
    parse_registration_credential_json,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from cdl_api.repositories.auth import UserRecord
from cdl_api.repositories.passkeys import AuthChallengeRecord, PasskeyRecord


class PasskeyError(ValueError):
    """Raised when a passkey ceremony cannot be completed safely."""


class PasskeyRepository(Protocol):
    def list_for_user(self, user_id: str) -> list[PasskeyRecord]: ...

    def get(self, credential_id: str) -> PasskeyRecord | None: ...

    def create(self, record: PasskeyRecord) -> None: ...

    def update_sign_count(self, credential_id: str, sign_count: int) -> None: ...


class AuthChallengeRepository(Protocol):
    def create(
        self,
        *,
        kind: str,
        challenge: bytes,
        user_id: str | None,
    ) -> str: ...

    def consume(
        self,
        challenge_id: str | None,
        *,
        kind: str,
        user_id: str | None = None,
    ) -> AuthChallengeRecord | None: ...


class PasskeyService:
    REGISTRATION_KIND = "passkey_registration"
    AUTHENTICATION_KIND = "passkey_authentication"

    def __init__(
        self,
        passkeys: PasskeyRepository,
        challenges: AuthChallengeRepository,
        users: object,
        *,
        rp_id: str,
        rp_name: str,
        expected_origin: str,
    ) -> None:
        self._passkeys = passkeys
        self._challenges = challenges
        self._users = users
        self._rp_id = rp_id
        self._rp_name = rp_name
        self._expected_origin = expected_origin

    @property
    def enabled(self) -> bool:
        return bool(self._rp_id and self._expected_origin)

    def registration_options(
        self,
        user_id: str,
        email: str,
        display_name: str,
    ) -> tuple[dict[str, object], str]:
        self._require_enabled()
        challenge = secrets.token_bytes(32)
        challenge_id = self._challenges.create(
            kind=self.REGISTRATION_KIND,
            challenge=challenge,
            user_id=user_id,
        )
        exclude_credentials = [
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(record.credential_id))
            for record in self._passkeys.list_for_user(user_id)
        ]
        options = generate_registration_options(
            rp_id=self._rp_id,
            rp_name=self._rp_name,
            user_id=hashlib.sha256(user_id.encode()).digest(),
            user_name=email,
            user_display_name=display_name,
            challenge=challenge,
            authenticator_selection=AuthenticatorSelectionCriteria(
                resident_key=ResidentKeyRequirement.REQUIRED,
                user_verification=UserVerificationRequirement.REQUIRED,
            ),
            exclude_credentials=exclude_credentials,
        )
        return json.loads(options_to_json(options)), challenge_id

    def verify_registration(
        self,
        *,
        challenge_id: str | None,
        user_id: str,
        credential: dict[str, object],
    ) -> PasskeyRecord:
        self._require_enabled()
        challenge_record = self._consume_challenge(
            challenge_id,
            kind=self.REGISTRATION_KIND,
            user_id=user_id,
        )
        try:
            parsed_credential = parse_registration_credential_json(credential)
            verification = verify_registration_response(
                credential=parsed_credential,
                expected_challenge=challenge_record.challenge,
                expected_rp_id=self._rp_id,
                expected_origin=self._expected_origin,
                require_user_verification=True,
            )
        except Exception as exc:
            raise PasskeyError("Passkey registration could not be verified.") from exc

        record = PasskeyRecord(
            credential_id=bytes_to_base64url(verification.credential_id),
            user_id=user_id,
            public_key=verification.credential_public_key,
            sign_count=verification.sign_count,
            transports=_credential_transports(credential),
        )
        try:
            self._passkeys.create(record)
        except Exception as exc:
            raise PasskeyError("This passkey is already registered.") from exc
        return record

    def authentication_options(self) -> tuple[dict[str, object], str]:
        self._require_enabled()
        challenge = secrets.token_bytes(32)
        challenge_id = self._challenges.create(
            kind=self.AUTHENTICATION_KIND,
            challenge=challenge,
            user_id=None,
        )
        options = generate_authentication_options(
            rp_id=self._rp_id,
            challenge=challenge,
            user_verification=UserVerificationRequirement.REQUIRED,
        )
        return json.loads(options_to_json(options)), challenge_id

    def registered_count(self, user_id: str) -> int:
        return len(self._passkeys.list_for_user(user_id))

    def verify_authentication(
        self,
        *,
        challenge_id: str | None,
        credential: dict[str, object],
    ) -> UserRecord:
        self._require_enabled()
        challenge_record = self._consume_challenge(
            challenge_id,
            kind=self.AUTHENTICATION_KIND,
        )
        try:
            parsed_credential = parse_authentication_credential_json(credential)
            credential_id = bytes_to_base64url(parsed_credential.raw_id)
            record = self._passkeys.get(credential_id)
            if record is None:
                raise PasskeyError("Passkey was not recognised.")
            verification = verify_authentication_response(
                credential=parsed_credential,
                expected_challenge=challenge_record.challenge,
                expected_rp_id=self._rp_id,
                expected_origin=self._expected_origin,
                credential_public_key=record.public_key,
                credential_current_sign_count=record.sign_count,
                require_user_verification=True,
            )
            self._passkeys.update_sign_count(credential_id, verification.new_sign_count)
            user = self._users.get_by_id(record.user_id)
        except PasskeyError:
            raise
        except Exception as exc:
            raise PasskeyError("Passkey sign-in could not be verified.") from exc

        if user is None:
            raise PasskeyError("Passkey account is no longer available.")
        return user

    def _consume_challenge(
        self,
        challenge_id: str | None,
        *,
        kind: str,
        user_id: str | None = None,
    ) -> AuthChallengeRecord:
        record = self._challenges.consume(challenge_id, kind=kind, user_id=user_id)
        if record is None:
            raise PasskeyError("Passkey challenge expired. Try again.")
        return record

    def _require_enabled(self) -> None:
        if not self.enabled:
            raise PasskeyError("Passkey sign-in is not configured.")


def _credential_transports(credential: dict[str, object]) -> list[str]:
    response = credential.get("response")
    if not isinstance(response, dict):
        return []
    transports = response.get("transports")
    if not isinstance(transports, list):
        return []
    return [transport for transport in transports if isinstance(transport, str)]
