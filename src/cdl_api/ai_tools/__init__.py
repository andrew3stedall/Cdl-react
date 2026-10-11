"""AI tool contracts shared by remote MCP and browser WebMCP adapters."""

from cdl_api.ai_tools.registry import TOOL_REGISTRY, ToolDefinition, get_tool

__all__ = ["TOOL_REGISTRY", "ToolDefinition", "get_tool"]
