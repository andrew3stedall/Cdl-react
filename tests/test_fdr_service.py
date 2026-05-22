from cdl_api.contracts.fdr import FixtureDifficultyFilters, FixtureDifficultyView
from cdl_api.services.fdr_service import FixtureDifficultyService


def test_combined_fdr_returns_attack_defence_and_scales() -> None:
    service = FixtureDifficultyService()
    response = service.get_combined()

    assert response.attack.view == FixtureDifficultyView.ATTACK
    assert response.defence.view == FixtureDifficultyView.DEFENCE
    assert len(response.scales) == 5
    assert response.scales[0].contrast_ratio >= 4.5


def test_fdr_view_filters_by_team_and_gameweek_range() -> None:
    service = FixtureDifficultyService()
    response = service.get_view(
        FixtureDifficultyView.ATTACK,
        FixtureDifficultyFilters(team_id="arsenal", gameweek_start=13, gameweek_end=14),
    )

    assert len(response.rows) == 1
    assert response.rows[0].team.id == "arsenal"
    assert [fixture.gameweek.number for fixture in response.rows[0].fixtures] == [13, 14]
    assert response.rows[0].average_rating == 3.5


def test_fdr_rows_are_sorted_by_average_rating() -> None:
    service = FixtureDifficultyService()
    response = service.get_view(FixtureDifficultyView.DEFENCE)

    averages = [row.average_rating for row in response.rows]
    assert averages == sorted(averages)


def test_fdr_scale_mapping_includes_theme_tokens() -> None:
    service = FixtureDifficultyService()
    scales = service.get_scales()

    assert scales[4].rating == 5
    assert scales[4].background_token == "fdr-5-background"
    assert scales[4].foreground_token == "fdr-5-foreground"
