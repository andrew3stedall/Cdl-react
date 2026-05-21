from cdl_api.contracts import (
    ApiErrorResponse,
    ErrorCode,
    FixtureSummary,
    GameweekSummary,
    SessionState,
    SessionUser,
    TeamSummary,
    ThemePreset,
)


def test_api_error_response_contract() -> None:
    error = ApiErrorResponse(code=ErrorCode.NOT_FOUND, message="Missing")

    assert error.code == ErrorCode.NOT_FOUND
    assert error.message == "Missing"
    assert error.details == {}


def test_session_state_contract() -> None:
    user = SessionUser(id="user-1", email="manager@example.com", display_name="Manager")
    session = SessionState(is_authenticated=True, user=user)

    assert session.is_authenticated is True
    assert session.user == user


def test_theme_preset_contract() -> None:
    preset = ThemePreset(name="classic", label="Classic", is_default=True)

    assert preset.name == "classic"
    assert preset.is_default is True


def test_fixture_summary_contract() -> None:
    gameweek = GameweekSummary(id="gw-1", name="Gameweek 1", number=1)
    home = TeamSummary(id="team-1", name="Home")
    away = TeamSummary(id="team-2", name="Away")
    fixture = FixtureSummary(
        id="fixture-1",
        gameweek=gameweek,
        home_team=home,
        away_team=away,
        status="scheduled",
    )

    assert fixture.gameweek.number == 1
    assert fixture.home_team.name == "Home"
