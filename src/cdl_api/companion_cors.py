"""CORS handling scoped to the intentionally public companion read API."""

from collections.abc import Awaitable, Callable
from typing import Any

ASGIApp = Callable[
    [dict[str, Any], Callable[[], Awaitable[dict[str, Any]]], Callable], Awaitable[None]
]


class CompanionCorsMiddleware:
    """Allow cross-origin GETs only for the public companion API namespace."""

    def __init__(self, app: ASGIApp, api_prefix: str = "/api") -> None:
        self.app = app
        self.path = f"{api_prefix}/companion"

    async def __call__(self, scope: dict[str, Any], receive: Callable, send: Callable) -> None:
        path = scope.get("path", "")
        is_companion = path == self.path or path.startswith(f"{self.path}/")
        if scope.get("type") != "http" or not is_companion:
            await self.app(scope, receive, send)
            return

        has_origin = any(name.lower() == b"origin" for name, _ in scope.get("headers", []))
        if not has_origin:
            await self.app(scope, receive, send)
            return

        cors_headers = [
            (b"access-control-allow-origin", b"*"),
            (b"access-control-allow-methods", b"GET, OPTIONS"),
            (b"access-control-allow-headers", b"Content-Type"),
            (b"access-control-max-age", b"600"),
        ]
        if scope.get("method") == "OPTIONS":
            await send(
                {
                    "type": "http.response.start",
                    "status": 204,
                    "headers": cors_headers,
                }
            )
            await send({"type": "http.response.body", "body": b""})
            return

        async def send_with_cors(message: dict[str, Any]) -> None:
            if message.get("type") == "http.response.start":
                message = {**message, "headers": [*message.get("headers", []), *cors_headers]}
            await send(message)

        await self.app(scope, receive, send_with_cors)
