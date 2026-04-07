"""Base class for all tools in the breeding scientist system."""

from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseTool(ABC):
    """Abstract base class for all tools."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Tool name identifier."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable tool description."""
        pass

    @property
    @abstractmethod
    def parameters(self) -> Dict[str, Any]:
        """JSON schema for tool parameters."""
        pass

    def validate_inputs(self, **kwargs) -> None:
        """Validate input parameters before execution.

        Raises:
            ValueError: If inputs are invalid.
        """
        pass

    @abstractmethod
    def execute(self, **kwargs) -> str:
        """Execute the tool and return result as JSON string.

        Returns:
            JSON string containing the tool execution results.
        """
        pass
