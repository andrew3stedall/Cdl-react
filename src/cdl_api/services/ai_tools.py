"""Shared execution seam for remote MCP and browser WebMCP adapters."""

from typing import Protocol

from cdl_api.ai_tools.registry import ToolDefinition
from cdl_api.database import build_session_factory
from cdl_api.repositories.ai_execution import build_ai_execution_repository
from cdl_api.settings import Settings


class ToolExecutor(Protocol):
    """Executes a registry tool for an already authenticated application actor."""

    def execute(
        self,
        tool: ToolDefinition,
        arguments: dict[str, object],
        *,
        user_id: str,
        connection_id: str | None,
    ) -> object: ...


class DeferredToolExecutor:
    """Fail closed until a tool has an authorization gateway handler."""

    def execute(
        self,
        tool: ToolDefinition,
        arguments: dict[str, object],
        *,
        user_id: str,
        connection_id: str | None,
    ) -> object:
        del arguments, user_id, connection_id
        raise NotImplementedError(f"Tool '{tool.name}' is not available through the gateway yet.")


def build_tool_executor(settings: Settings) -> ToolExecutor:
    """Return the shared grant/approval gateway only when its rollout flag is on."""
    if not settings.mcp_execution_enabled:
        return DeferredToolExecutor()
    factory = build_session_factory(settings) if settings.repository_mode == "postgres" else None
    repository = build_ai_execution_repository(settings.repository_mode, factory)
    from cdl_api.services.ai_execution import AIExecutionPolicy
    from cdl_api.services.ai_tool_gateway import AIExecutionGateway

    return AIExecutionGateway(settings, AIExecutionPolicy(repository))
