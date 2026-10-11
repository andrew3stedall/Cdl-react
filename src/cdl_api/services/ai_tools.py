"""Shared execution seam for remote MCP and browser WebMCP adapters."""

from typing import Protocol

from cdl_api.ai_tools.registry import ToolDefinition


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


def get_tool_executor() -> ToolExecutor:
    """Dependency seam replaced by the execution gateway in issue #593."""
    return DeferredToolExecutor()
