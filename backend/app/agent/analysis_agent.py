"""Native Agent Loop for ABC - inspired by shareAI-lab/learn-claude-code.

Replaces LangChain ReAct Agent with a direct Agent Loop:
    while stop_reason == "tool_use":
        response = LLM(messages, tools)
        dispatch tools
        append results
        continue
"""

import asyncio
import json
from typing import Any, Dict, List

from openai import OpenAI

from app.config import settings
from app.tools.differential import (
    DIFFERENTIAL_ANALYSIS_SCHEMA,
    differential_expression_analysis,
)

# ── 工具注册表：名称 → 可调用函数 ──────────────────────────────────────────
TOOL_HANDLERS = {
    "differential_expression_analysis": differential_expression_analysis,
}

# ── LLM function calling 工具描述列表 ─────────────────────────────────────
TOOLS = [DIFFERENTIAL_ANALYSIS_SCHEMA]

# ── 系统提示 ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """你是 ABC（农业育种智能助手）的分析 Agent。
你擅长基因表达数据分析，可以调用工具进行差异表达分析。

当用户请求分析时：
1. 理解用户意图，确定对照组和处理组
2. 调用 differential_expression_analysis 工具
3. 用中文解读分析结果，包括：显著差异基因数量、上调/下调情况、关键基因

数据集信息：
- 默认数据集：GSE242459（水稻基因表达数据）
- 对照组（WT）：DS_WT_rep1, DS_WT_rep2, N_WT_rep1, N_WT_rep2, RE_WT_rep1, RE_WT_rep2
- 处理组（osbzip23）：DS_osbzip23_rep1, DS_osbzip23_rep2

命令格式示例：
- /analyze --control WT --treatment osbzip23
- 分析 WT 和 osbzip23 的差异表达基因"""


def _get_client() -> OpenAI:
    """获取千问 OpenAI 兼容客户端。"""
    return OpenAI(
        api_key=settings.qwen_api_key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )


def _dispatch_tool(name: str, arguments: Dict[str, Any]) -> str:
    """分发工具调用，返回结果字符串。"""
    handler = TOOL_HANDLERS.get(name)
    if not handler:
        return json.dumps({"error": f"Unknown tool: {name}"})
    try:
        return handler(**arguments)
    except Exception as e:
        return json.dumps({"error": f"Tool execution failed: {str(e)}"})


def _agent_loop(messages: List[Dict[str, Any]], max_rounds: int = 10) -> str:
    """同步 Agent Loop：LLM → 工具调用 → 结果回传 → 循环。

    Args:
        messages: 对话历史（含 system prompt）
        max_rounds: 最大循环轮数，防止死循环

    Returns:
        LLM 最终的文本回复
    """
    client = _get_client()

    for _ in range(max_rounds):
        response = client.chat.completions.create(
            model=settings.qwen_model,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            max_tokens=settings.llm_max_tokens,
            temperature=settings.llm_temperature,
        )

        choice = response.choices[0]
        assistant_msg = choice.message

        # 将 assistant 回复追加到历史
        messages.append({
            "role": "assistant",
            "content": assistant_msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in (assistant_msg.tool_calls or [])
            ] or None,
        })

        # 如果没有工具调用，返回最终答案
        if choice.finish_reason != "tool_calls" or not assistant_msg.tool_calls:
            return assistant_msg.content or ""

        # 执行所有工具调用，收集结果
        for tool_call in assistant_msg.tool_calls:
            name = tool_call.function.name
            try:
                arguments = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError:
                arguments = {}

            result = _dispatch_tool(name, arguments)

            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })

    # 超过最大轮数，返回最后一条 assistant 消息
    for msg in reversed(messages):
        if msg.get("role") == "assistant" and msg.get("content"):
            return msg["content"]
    return "分析超过最大轮数限制，请重试。"


async def run_analysis(user_input: str) -> Dict[str, Any]:
    """运行分析 Agent，处理用户输入。

    Args:
        user_input: 用户的自然语言或命令输入

    Returns:
        dict with keys:
        - success: bool
        - output: str（格式化结果）
        - error: str or None
    """
    if not settings.qwen_api_key:
        return {
            "success": False,
            "output": None,
            "error": "QWEN_API_KEY 未配置，请在环境变量中设置",
        }

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_input},
    ]

    try:
        output = await asyncio.to_thread(_agent_loop, messages)
        return {"success": True, "output": output, "error": None}
    except Exception as e:
        return {"success": False, "output": None, "error": str(e)}
