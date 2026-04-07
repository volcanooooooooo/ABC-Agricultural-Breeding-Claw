import traceback
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services.llm_service import llm_service
from app.services.ontology_service import ontology_service
from app.agent.analysis_agent import run_analysis

# 延迟导入，避免循环依赖
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.routers.analysis import analysis_tasks, schedule_cleanup

router = APIRouter()

# 分析命令前缀 - Agent 自己理解自然语言，这里只做命令前缀快速检测
ANALYSIS_COMMANDS = ["/analyze", "/diff", "/analyse"]

# 分析意图关键词 - 简化版，让 Agent 处理语义理解
ANALYSIS_KEYWORDS = [
    "分析", "差异表达", "差异基因", "比较",
    "/analyze", "/diff", "log2fc", "deseq",
]


def should_use_agent(message: str) -> bool:
    """判断是否应该交给 Agent 处理（命令或分析意图）。"""
    if not message:
        return False
    msg_lower = message.lower().strip()
    for cmd in ANALYSIS_COMMANDS:
        if msg_lower.startswith(cmd):
            return True
    for kw in ANALYSIS_KEYWORDS:
        if kw.lower() in msg_lower:
            return True
    return False


class ChatMessage(BaseModel):
    """聊天消息"""
    role: str
    content: str


class ChatRequest(BaseModel):
    """聊天请求"""
    messages: List[ChatMessage]
    system_prompt: Optional[str] = None
    use_ontology: bool = False
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class ChatResponse(BaseModel):
    """聊天响应"""
    content: str
    usage: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """通用对话接口"""
    # 转换消息格式
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    last_message = messages[-1]["content"] if messages else ""

    # ===== Agent Loop：命令或分析意图统一交给 Agent 处理 =====
    if last_message and should_use_agent(last_message):
        try:
            result = await run_analysis(last_message)
            if result.get("success"):
                return ChatResponse(content=result.get("output", ""))
            else:
                raise HTTPException(status_code=500, detail=result.get("error", "Analysis failed"))
        except HTTPException:
            raise
        except Exception as e:
            print(f"Agent loop failed: {e}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))

    # 如果启用本体搜索，将本体上下文加入
    context = None
    if request.use_ontology and request.messages:
        last_message = request.messages[-1].content
        # 搜索本体中相关内容
        ontology_results = ontology_service.search_nodes(last_message)
        if ontology_results:
            context = "\n".join([
                f"- {n.name}: {n.properties.get('description', '')}"
                for n in ontology_results[:5]
            ])

    # 调用 LLM
    if context:
        result = await llm_service.chat_with_context(
            user_message=messages[-1]["content"],
            system_prompt=request.system_prompt,
            context=context
        )
    else:
        # 直接调用
        result = await llm_service.chat(
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens
        )

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return ChatResponse(
        content=result.get("content", ""),
        usage=result.get("usage"),
        request_id=result.get("request_id")
    )


@router.post("/breeding")
async def breeding_chat(request: ChatRequest):
    """育种专业对话接口"""
    breeding_system_prompt = request.system_prompt or """你是一个专业的育种科学家助手。
你擅长回答关于作物育种、遗传学、分子标记辅助选择、杂交育种等方面的问题。
请用专业但易懂的语言回答问题。"""

    # 搜索本体获取相关上下文
    context = None
    if request.messages:
        last_message = request.messages[-1].content
        ontology_results = ontology_service.search_nodes(last_message)
        if ontology_results:
            context = "\n本体知识库中的相关信息：\n"
            context += "\n".join([
                f"- {n.name} ({n.type.value}): {n.properties.get('description', '')}"
                for n in ontology_results[:5]
            ])

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
