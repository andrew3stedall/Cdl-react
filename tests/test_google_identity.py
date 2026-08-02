import pytest

from cdl_api.google_identity import GoogleIdentityVerifier


def test_verifier_accepts_verified_allowlisted_google_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "cdl_api.google_identity.id_token.verify_oauth2_token",
        lambda credential, request, audience: {
            "sub": "google-subject-1",
            "email": "Andrew3Stedall@gmail.com",
            "email_verified": True,
            "name": "Andrew Stedall",
            "aud": audience,
        },
    )
    verifier = GoogleIdentityVerifier(
        "staging-client.apps.googleusercontent.com",
        {"andrew3stedall@gmail.com"},
    )

    identity = verifier.verify("signed-google-id-token")

    assert identity is not None
    assert identity.subject == "google-subject-1"
    assert identity.email == "andrew3stedall@gmail.com"
    assert identity.display_name == "Andrew Stedall"


def test_verifier_rejects_unverified_or_unlisted_email(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    claims = {
        "sub": "google-subject-2",
        "email": "someone-else@example.com",
        "email_verified": True,
    }
    monkeypatch.setattr(
        "cdl_api.google_identity.id_token.verify_oauth2_token",
        lambda credential, request, audience: claims,
    )
    verifier = GoogleIdentityVerifier(
        "staging-client.apps.googleusercontent.com",
        {"andrew3stedall@gmail.com"},
    )

    assert verifier.verify("signed-google-id-token") is None

    claims["email"] = "andrew3stedall@gmail.com"
    claims["email_verified"] = False
    assert verifier.verify("signed-google-id-token") is None
