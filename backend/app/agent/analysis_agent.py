"""Tool registry and dispatcher for ABC Agent Loop.

This module only owns:
- TOOL_HANDLERS  — name → callable mapping
- TOOLS          — OpenAI function-calling schema list
- _dispatch_tool — safe tool executor
"""

import json
from typing import Any, Dict

from app.tools.differential import (
    DIFFERENTIAL_ANALYSIS_SCHEMA,
    differential_expression_analysis,
)
from app.tools.enrichment import (
    ENRICHMENT_ANALYSIS_SCHEMA,
    enrichment_analysis,
)
from app.tools.blast import (
    BLAST_SEARCH_SCHEMA,
    blast_search,
)

# ── 工具注册表：名称 → 可调用函数 ──────────────────────────────────────────
TOOL_HANDLERS = {
    "differential_expression_analysis": differential_expression_analysis,
    "enrichment_analysis": enrichment_analysis,
    "blast_search": blast_search,
}

# ── LLM function calling 工具描述列表 ─────────────────────────────────────
TOOLS = [DIFFERENTIAL_ANALYSIS_SCHEMA, ENRICHMENT_ANALYSIS_SCHEMA, BLAST_SEARCH_SCHEMA]


def _dispatch_tool(name: str, arguments: Dict[str, Any]) -> str:
    """分发工具调用，返回结果字符串。"""
    handler = TOOL_HANDLERS.get(name)
    if not handler:
        return json.dumps({"error": f"Unknown tool: {name}"})
    try:
        result = handler(**arguments)
        # 限制结果长度，避免超过 LLM API 限制（千问 1M 字符）
        MAX_RESULT_LENGTH = 50000  # 50K 字符，为 LLM 回复留足空间
        if len(result) > MAX_RESULT_LENGTH:
            # 尝试解析 JSON 并精简
            try:
                data = json.loads(result)
                # 如果有 volcano_data，只保留前 100 个
                if "volcano_data" in data and len(data["volcano_data"]) > 100:
                    data["volcano_data"] = data["volcano_data"][:100]
                    data["volcano_data_truncated"] = True
                if "hits" in data and len(data["hits"]) > 30:
                    data["hits"] = data["hits"][:30]
                    data["hits_truncated"] = True
                result = json.dumps(data, ensure_ascii=False)
            except Exception:
                pass
            # 如果还是太长，直接截断
            if len(result) > MAX_RESULT_LENGTH:
                result = result[:MAX_RESULT_LENGTH] + "\n... (truncated)"
        return result
    except Exception as e:
        return json.dumps({"error": f"Tool execution failed: {str(e)}"})
