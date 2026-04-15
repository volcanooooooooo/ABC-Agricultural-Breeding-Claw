import asyncio
import json
import traceback
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from openai import OpenAI
from pydantic import BaseModel

from app.agent.analysis_agent import TOOLS, _dispatch_tool
from app.config import settings
from app.services.llm_service import llm_service
from app.services.ontology_service import ontology_service

router = APIRouter()

# ── 系统提示 ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """你是 ABC（农业育种智能助手）的分析 Agent。
你擅长基因表达数据分析，可以调用工具进行差异表达分析和富集分析。

## 差异表达分析

当用户明确请求差异表达分析（如"分析差异基因"、"/analyze"、"比较 WT 和 osbzip23"）时：
1. 理解用户意图，确定对照组和处理组
2. 调用 differential_expression_analysis 工具
3. 用中文解读分析结果：显著差异基因数量、上调/下调情况、关键基因

### 上传文件分析
当用户消息中包含上传文件路径（格式如 `[上传文件: xxx, 路径: /path/to/file]`）时：
- 提取文件路径，作为 `dataset_path` 参数传给 differential_expression_analysis 工具
- 根据用户消息推断对照组和处理组名称（从列名中匹配）
- 如果无法确定分组，提示用户指定对照组和处理组的关键词

### 直接输入数据分析
当用户在消息中直接提供了基因表达数据（如表格格式数据）时：
- 直接使用默认数据集进行分析
- 或根据用户提供的数据格式进行处理

数据集信息：
- 默认数据集：GSE242459（水稻基因表达数据）
- 对照组（WT）：DS_WT_rep1, DS_WT_rep2, N_WT_rep1, N_WT_rep2, RE_WT_rep1, RE_WT_rep2
- 处理组（osbzip23）：DS_osbzip23_rep1, DS_osbzip23_rep2

### 差异表达分析意图识别

当用户表达了差异分析意图（如"帮我做差异分析"、"分析差异基因"、"比较WT和osbzip23"），
但没有提供具体数据集或明确的分析参数时：
1. 先用中文回复，简要说明你可以帮助进行差异分析，并询问用户的数据来源
2. 在回复末尾追加标记（必须单独一行）：<!-- ANALYSIS_READY -->
3. 不要直接调用 differential_expression_analysis 工具

当用户已经提供了明确的数据集路径和分组信息时，直接调用工具，不追加标记。

## 富集分析

当用户明确请求富集分析（如"做富集分析"、"KEGG 分析"、"GO 分析"）时，按以下优先级处理：

1. **对话历史中有差异分析结果**：从 significant_genes 提取所有 gene_id（逗号拼接），直接调用 enrichment_analysis 工具。
2. **用户直接提供了基因 ID 列表**：直接调用 enrichment_analysis 工具。
3. **以上两者都没有**：询问用户提供基因 ID 列表，**不要**自动运行差异表达分析。

富集分析结果处理：
- 用中文解读 top 5 KEGG 通路和 top 5 GO term
- 回复末尾追加（JSON 必须单行）：<!-- ENRICHMENT_DATA: {完整JSON} -->

## 重要原则

- 差异分析和富集分析是两个独立的功能，不要混淆
- 用户只请求其中一个时，只执行那一个，不要自动触发另一个

## BLAST 序列比对

当用户请求序列比对（如"比对"、"BLAST"、"同源"、"序列相似"、"序列比对"、"homolog"）时：
1. 根据序列类型自动选择 program：核酸序列用 blastn，蛋白序列用 blastp
2. 如果用户提供了 FASTA 格式序列，使用 query_type="sequence"
3. 如果用户提供了基因 ID，使用 query_type="gene_id"
4. 如果用户上传了文件（消息中包含文件路径），使用 query_type="file"
5. 默认数据库：核酸用 "MH63"，蛋白用 "MH63_pep"
6. 调用 blast_search 工具

BLAST 结果处理：
- 用中文解读 top 5 命中结果（相似度、E-value、覆盖度）
- 回复末尾追加（JSON 必须单行）：<!-- BLAST_DATA: {完整JSON} -->"""


def _get_client() -> OpenAI:
    return OpenAI(
        api_key=settings.qwen_api_key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )


def _agent_loop(messages: List[Dict[str, Any]], max_rounds: int = 10) -> str:
    """Agent Loop：LLM → tool_use → 结果回传 → 循环，直到普通回答。"""
    client = _get_client()

    # 如果没有 system 消息，prepend SYSTEM_PROMPT
    if not messages or messages[0].get("role") != "system":
        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

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

        # 追加 assistant 回复到历史
        tool_calls_payload = [
            {
                "id": tc.id,
                "type": "function",
                "function": {"name": tc.function.name, "arguments": tc.function.arguments},
            }
            for tc in (assistant_msg.tool_calls or [])
        ]
        msg: Dict[str, Any] = {"role": "assistant", "content": assistant_msg.content or ""}
        if tool_calls_payload:
            msg["tool_calls"] = tool_calls_payload
        messages.append(msg)

        # 没有工具调用 → 返回最终答案
        if choice.finish_reason != "tool_calls" or not assistant_msg.tool_calls:
            return assistant_msg.content or ""

        # 执行所有工具调用
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

    # 超过最大轮数
    for msg in reversed(messages):
        if msg.get("role") == "assistant" and msg.get("content"):
            return msg["content"]
    return "分析超过最大轮数限制，请重试。"


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    system_prompt: Optional[str] = None
    use_ontology: bool = False
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class ChatResponse(BaseModel):
    content: str
    usage: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """通用对话接口 — 所有消息统一走 Agent Loop。"""
    if not settings.qwen_api_key:
        raise HTTPException(status_code=500, detail="QWEN_API_KEY 未配置")

    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    try:
        # 添加 180 秒超时，防止请求无限挂起
        content = await asyncio.wait_for(
            asyncio.to_thread(_agent_loop, messages),
            timeout=180.0
        )
        return ChatResponse(content=content)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="分析请求超时，请尝试简化问题或稍后重试"
        )
    except Exception as e:
        traceback.print_exc()
        # 返回友好的错误信息，不暴露原始异常
        error_msg = "AI 服务暂时不可用，请稍后重试"
        if "API" in str(e) or "api" in str(e):
            error_msg = "AI 服务连接失败，请检查网络或稍后重试"
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/breeding")
async def breeding_chat(request: ChatRequest):
    """育种专业对话接口"""
    breeding_system_prompt = request.system_prompt or """你是一个专业的育种科学家助手。
你擅长回答关于作物育种、遗传学、分子标记辅助选择、杂交育种等方面的问题。
请用专业但易懂的语言回答问题。"""

    # 本体查询已禁用
    # context = None
    # if request.messages:
    #     last_message = request.messages[-1].content
    #     ontology_results = ontology_service.search_nodes(last_message)
    #     if ontology_results:
    #         context = "\n本体知识库中的相关信息：\n"
    #         context += "\n".join([
    #             f"- {n.name} ({n.type.value}): {n.properties.get('description', '')}"
    #             for n in ontology_results[:5]
    #         ])

    context = None

    if context:
        result = await llm_service.chat_with_context(
            user_message=request.messages[-1].content,
            system_prompt=breeding_system_prompt,
            context=context
        )
    else:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        result = await llm_service.chat(messages, temperature=request.temperature)

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return ChatResponse(
        content=result.get("content", ""),
        usage=result.get("usage"),
        request_id=result.get("request_id")
    )


@router.get("/config")
async def get_llm_config():
    """获取 LLM 配置"""
    return llm_service.get_config()
