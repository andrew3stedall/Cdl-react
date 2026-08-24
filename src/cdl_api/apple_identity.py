"""Sign in with Apple authorization-code and ID-token verification."""

import json
import time
from dataclasses import dataclass
from urllib.parse import urlencode

import jwt
import requests


@dataclass(frozen=True)
class AppleIdentity:
    subject: str
    email: str
    display_name: str


class AppleIdentityVerifier:
    """Exchange and verify Apple web-login responses for an allowlisted manager."""

    _issuer = "https://appleid.apple.com"
    _token_endpoint = "https://appleid.apple.com/auth/token"  # noqa: S105
    _jwks_endpoint = "https://appleid.apple.com/auth/keys"

    def __init__(
        self,
        *,
        client_id: str,
        team_id: str,
        key_id: str,
        private_key: str,
        redirect_uri: str,
        allowed_emails: set[str],
    ) -> None:
        self._client_id = client_id
        self._team_id = team_id
        self._key_id = key_id
        self._private_key = private_key.replace("\\n", "\n")
        self._redirect_uri = redirect_uri
        self._allowed_emails = {email.lower() for email in allowed_emails}
        self._jwks_cache: tuple[float, list[dict[str, object]]] | None = None

    @property
    def enabled(self) -> bool:
        return bool(
            self._client_id
            and self._team_id
            and self._key_id
            and self._private_key
            and self._redirect_uri
            and self._allowed_emails
        )

    def authorization_url(self, state: str, nonce: str) -> str:
        if not self.enabled:
            raise ValueError("Apple sign-in is not configured.")
        return "https://appleid.apple.com/auth/authorize?" + urlencode(
            {
                "client_id": self._client_id,
                "redirect_uri": self._redirect_uri,
                "response_type": "code",
                "response_mode": "query",
                "scope": "name email",
                "state": state,
                "nonce": nonce,
            }
        )

    def verify_code(
        self,
        *,
        code: str,
        nonce: str,
        display_name: str | None = None,
    ) -> AppleIdentity | None:
        if not self.enabled:
            return None

        try:
            response = requests.post(
                self._token_endpoint,
                data={
                    "client_id": self._client_id,
                    "client_secret": self._build_client_secret(),
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self._redirect_uri,
                },
                timeout=10,
            )
            response.raise_for_status()
            payload = response.json()
            id_token = payload.get("id_token")
            if not isinstance(id_token, str):
                return None

            header = jwt.get_unverified_header(id_token)
            key = self._get_jwk(header.get("kid"))
            if key is None:
                return None
            claims = jwt.decode(
                id_token,
                key=jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key)),
                algorithms=["RS256"],
                audience=self._client_id,
                issuer=self._issuer,
            )
        except (ValueError, KeyError, TypeError, jwt.PyJWTError, requests.RequestException):
            return None

        email = claims.get("email")
        subject = claims.get("sub")
        token_nonce = claims.get("nonce")
        email_verified = claims.get("email_verified")
        if (
            not isinstance(email, str)
            or not isinstance(subject, str)
            or token_nonce != nonce
            or email.lower() not in self._allowed_emails
            or email_verified not in (True, "true")
        ):
            return None

        safe_display_name = display_name.strip() if isinstance(display_name, str) else ""
        if not safe_display_name:
            safe_display_name = email.split("@", maxsplit=1)[0]
        return AppleIdentity(
            subject=subject,
            email=email.lower(),
            display_name=safe_display_name,
        )

    def _build_client_secret(self) -> str:
        now = int(time.time())
        return jwt.encode(
            {
                "iss": self._team_id,
                "iat": now,
                "exp": now + 300,
                "aud": self._issuer,
                "sub": self._client_id,
            },
            self._private_key,
            algorithm="ES256",
            headers={"kid": self._key_id},
        )

    def _get_jwk(self, key_id: object) -> dict[str, object] | None:
        if not isinstance(key_id, str):
            return None
        now = time.time()
        if self._jwks_cache is None or self._jwks_cache[0] <= now:
            response = requests.get(self._jwks_endpoint, timeout=10)
            response.raise_for_status()
            keys = response.json().get("keys", [])
            if not isinstance(keys, list):
                return None
            self._jwks_cache = (now + 3600, [key for key in keys if isinstance(key, dict)])
        return next((key for key in self._jwks_cache[1] if key.get("kid") == key_id), None)
