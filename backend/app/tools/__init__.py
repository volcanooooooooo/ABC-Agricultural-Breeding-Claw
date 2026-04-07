"""Tool registry for the breeding scientist system.

This module exports all available tools that can be used by the LangChain agent.
"""

from app.tools.base import BaseTool
from app.tools.differential import differential_expression_analysis


# Tool registry - map of tool name to tool instance
TOOL_REGISTRY = {
    differential_expression_analysis.name: differential_expression_analysis
}


def get_tool(tool_name: str):
    """Get a tool by name from the registry.

    Args:
        tool_name: Name of the tool to retrieve.

    Returns:
        The tool instance if found, None otherwise.
    """
    return TOOL_REGISTRY.get(tool_name)


def list_tools():
    """List all available tools.

    Returns:
        Dictionary mapping tool names to their descriptions.
    """
    return {
        name: tool.description
        for name, tool in TOOL_REGISTRY.items()
    }


__all__ = [
    "BaseTool",
    "differential_expression_analysis",
    "TOOL_REGISTRY",
    "get_tool",
    "list_tools"
]
