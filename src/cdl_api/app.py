"""FastAPI application foundation."""

from fastapi import FastAPI

from cdl_api.routers.auth import router as auth_router
from cdl_api.routers.dashboard import router as dashboard_router
from cdl_api.routers.fdr import router as fdr_router
from cdl_api.routers.league import router as league_router
from cdl_api.routers.modernisation import router as modernisation_router
from cdl_api.routers.modernisation_weekly import router as modernisation_weekly_router
from cdl_api.routers.preferences import router as preferences_router
from cdl_api.routers.rules import router as rules_router
from cdl_api.routers.squad import router as squad_router
from cdl_api.routers.team_selection import router as team_selection_router
from cdl_api.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)
    app.include_router(auth_router, prefix=settings.api_prefix)
    app.include_router(dashboard_router, prefix=settings.api_prefix)
    app.include_router(fdr_router, prefix=settings.api_prefix)
    app.include_router(preferences_router, prefix=settings.api_prefix)
    app.include_router(rules_router, prefix=settings.api_prefix)
    app.include_router(league_router, prefix=settings.api_prefix)
    app.include_router(modernisation_router, prefix=settings.api_prefix)
    app.include_router(modernisation_weekly_router, prefix=settings.api_prefix)
    app.include_router(squad_router, prefix=settings.api_prefix)
    app.include_router(team_selection_router, prefix=settings.api_prefix)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get(f"{settings.api_prefix}/contracts/theme-presets")
    def theme_presets() -> list[dict[str, object]]:
        return [
            {"name": "classic", "label": "Classic", "is_default": True},
            {"name": "dark", "label": "Dark", "is_default": False},
            {"name": "compact", "label": "Compact", "is_default": False},
        ]

    return app


app = create_app()
