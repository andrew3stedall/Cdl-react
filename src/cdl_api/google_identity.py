"""Google Identity Services token verification for application sign-in."""

from dataclasses import dataclass

from google.auth import exceptions as google_auth_exceptions
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


@dataclass(frozen=True)
class GoogleIdentity:
    subject: str
    email: str
    display_name: str


class GoogleIdentityVerifier:
    """Verify Google ID tokens and enforce the configured email allowlist."""

    def __init__(self, client_id: str, allowed_emails: set[str]) -> None:
        self._client_id = client_id
        self._allowed_emails = {email.lower() for email in allowed_emails}
        self._request = google_requests.Request()

    @property
    def enabled(self) -> bool:
        return bool(self._client_id and self._allowed_emails)

    def verify(self, credential: str) -> GoogleIdentity | None:
        if not self.enabled:
            return None

        try:
            claims = id_token.verify_oauth2_token(
                credential,
                self._request,
                self._client_id,
            )
        except (ValueError, google_auth_exceptions.GoogleAuthError):
            return None

        email = claims.get("email")
        subject = claims.get("sub")
        if (
            not isinstance(email, str)
            or not isinstance(subject, str)
            or claims.get("email_verified") is not True
            or email.lower() not in self._allowed_emails
        ):
            return None

        display_name = claims.get("name")
        if not isinstance(display_name, str) or not display_name.strip():
            display_name = email.split("@", maxsplit=1)[0]

        return GoogleIdentity(
            subject=subject,
            email=email.lower(),
            display_name=display_name.strip(),
        )
