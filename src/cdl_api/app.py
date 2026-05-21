"""FastAPI application foundation."""

from fastapi import FastAPI

from cdl_api.settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name)

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
