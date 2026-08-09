"""FastAPI application foundation."""

from fastapi import FastAPI

from cdl_api.repositories.factory import build_repositories
from cdl_api.routers.auth import router as auth_router
from cdl_api.routers.dashboard import router as dashboard_router
from cdl_api.routers.fdr import router as fdr_router
from cdl_api.routers.fpl_data import router as fpl_data_router
from cdl_api.routers.league import router as league_router
from cdl_api.routers.modernisation import router as modernisation_router
from cdl_api.routers.modernisation_competition_experience import router as competition_router
from cdl_api.routers.modernisation_history import router as history_router
from cdl_api.routers.modernisation_squad_movement import router as movement_router
from cdl_api.routers.modernisation_weekly import router as modernisation_weekly_router
from cdl_api.routers.preferences import router as preferences_router
from cdl_api.routers.rules import router as rules_router
from cdl_api.routers.squad import router as squad_router
from cdl_api.routers.team_selection import router as team_selection_router
from cdl_api.services.auth import AuthenticationService
from cdl_api.settings import DEFAULT_DEVELOPMENT_LOGIN_SECRET, get_settings
from cdl_api.staging_access import build_staging_access_middleware
from cdl_api.static_frontend import mount_static_frontend


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    if settings.environment == "staging":
        if settings.development_login_secret == DEFAULT_DEVELOPMENT_LOGIN_SECRET:
            raise RuntimeError("Staging requires a non-default login secret.")
        if bool(settings.google_client_id) != bool(settings.google_allowed_email_set):
            raise RuntimeError(
                "Staging Google sign-in requires both a client ID and an email allowlist."
            )
        repositories = build_repositories(settings)
        auth_service = AuthenticationService(
            repositories.users,
            repositories.sessions,
            settings.development_login_secret,
        )
        app.middleware("http")(build_staging_access_middleware(settings, auth_service))
    app.include_router(auth_router, prefix=settings.api_prefix)
    app.include_router(dashboard_router, prefix=settings.api_prefix)
    app.include_router(fdr_router, prefix=settings.api_prefix)
    app.include_router(fpl_data_router, prefix=settings.api_prefix)
    app.include_router(preferences_router, prefix=settings.api_prefix)
    app.include_router(rules_router, prefix=settings.api_prefix)
    app.include_router(league_router, prefix=settings.api_prefix)
    app.include_router(modernisation_router, prefix=settings.api_prefix)
    app.include_router(modernisation_weekly_router, prefix=settings.api_prefix)
    app.include_router(movement_router, prefix=settings.api_prefix)
    app.include_router(competition_router, prefix=settings.api_prefix)
    app.include_router(history_router, prefix=settings.api_prefix)
    app.include_router(squad_router, prefix=settings.api_prefix)
    app.include_router(team_selection_router, prefix=settings.api_prefix)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get(f"{settings.api_prefix}/contracts/theme-presets")
    def theme_presets() -> list[dict[str, object]]:
        return [
            {
                "name": "teal-light",
                "label": "Teal · Light",
                "description": "A bright, restrained workspace with teal actions.",
                "is_default": True,
            },
            {
                "name": "teal-dark",
                "label": "Teal · Dark",
                "description": "A deep, low-contrast workspace for evening sessions.",
                "is_default": False,
            },
            {
                "name": "teal-light-compact",
                "label": "Teal · Light Compact",
                "description": "The light theme with tighter tables and controls.",
                "is_default": False,
            },
            {
                "name": "teal-dark-compact",
                "label": "Teal · Dark Compact",
                "description": "The dark theme with tighter tables and controls.",
                "is_default": False,
            },
        ]

    mount_static_frontend(
        app,
        dist_dir=settings.frontend_dist_dir,
        api_prefix=settings.api_prefix,
    )
    return app


app = create_app()
