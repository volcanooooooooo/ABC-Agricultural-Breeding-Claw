"""LangChain ReAct Agent for differential expression analysis."""

from typing import Any, Dict, List

from langchain import hub
from langchain.agents import AgentExecutor, create_react_agent

from app.services.llm_service import llm_service
from app.tools.differential import differential_expression_analysis


class SimpleChatModel:
    """A simple wrapper around llm_service.chat to make it compatible with LangChain agents."""

    def __init__(self, llm):
        self.llm = llm

    def __call__(self, messages: List[Dict[str, str]]) -> str:
        """Synchronous call wrapper - returns content string."""
        import asyncio
        return asyncio.run(self.llm.chat(messages)).get("content", "")


def get_analysis_agent() -> AgentExecutor:
    """Create and return the ReAct analysis agent.

    Returns:
        AgentExecutor: Configured agent executor ready to run analysis.
    """
    # Get the ReAct prompt from LangChain hub
    prompt = hub.pull("hwchase17/react")

    # Create a simple chat model wrapper
    # Note: We use a sync wrapper since create_react_agent expects sync interface
    # The actual async call happens inside run_analysis
    chat_model = SimpleChatModel(llm_service)

    # Create the ReAct agent with the differential expression tool
    agent = create_react_agent(
        chat_model,
        tools=[differential_expression_analysis],
        prompt=prompt
    )

    # Create and return the agent executor
    agent_executor = AgentExecutor(
        agent=agent,
        tools=[differential_expression_analysis],
        verbose=True,
        handle_parsing_errors=True
    )

    return agent_executor


async def run_analysis(user_input: str) -> Dict[str, Any]:
    """Run differential expression analysis based on user input.

    Args:
        user_input: Natural language request for analysis (e.g.,
            "分析处理组osbzip23与对照组WT的差异表达基因")

    Returns:
        Dict with keys:
        - success: bool indicating if analysis completed
        - output: str result from agent (JSON string with analysis results)
        - error: str error message if failed
    """
    try:
        # Get the agent executor
        agent_executor = get_analysis_agent()

        # Run the agent synchronously (AgentExecutor.run is sync)
        # but we wrap it properly for async context
        result = agent_executor.invoke({"input": user_input})

        return {
            "success": True,
            "output": result.get("output", ""),
            "error": None
        }

    except Exception as e:
        return {
            "success": False,
            "output": None,
            "error": str(e)
        }
