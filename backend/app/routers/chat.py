from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import re
from app.services.llm_service import llm_service
from app.services.ontology_service import ontology_service
from app.services.dataset_service import dataset_service
from app.models.analysis import CompareRequest
from app.agent.analysis_agent import run_analysis

# 延迟导入，避免循环依赖
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.routers.analysis import analysis_tasks, schedule_cleanup

router = APIRouter()

# 意图识别关键词
ANALYSIS_KEYWORDS = [
    "分析", "差异表达", "比较", "对照组", "treatment", "control",
    "基因", "表达", "显著", "deseq", "ttest", "t检验",
    "上调", "下调", "heatmap", "聚类", "p值", "log2fc"
]

# 数据集名称匹配模式
DATASET_PATTERN = r'(?:数据集|dataset|data)[_\s]*(\w+)|([a-zA-Z0-9_-]+(?=_control|_treatment))'

# 分组匹配模式
GROUP_PATTERN = r'(?:control|对照|对照组)[_\s]*(\w+)|treatment[_\s]*(\w+)|(?:vs| versus |对比)[\s]*(control|对照|treatment)[\s]*(?:vs|versus|对比)[\s]*(control|对照|treatment)'

# 分析命令模式
ANALYSIS_COMMANDS = ["/analyze", "/diff", "/analyse"]


def is_analysis_command(message: str) -> bool:
    """检测消息是否为分析命令"""
    if not message:
        return False
    message_lower = message.lower().strip()
    for cmd in ANALYSIS_COMMANDS:
        if message_lower.startswith(cmd):
            return True
    return False


def detect_analysis_intent(message: str) -> bool:
    """检测用户消息是否包含分析意图"""
    message_lower = message.lower()
    # 检查是否包含分析相关关键词
    for keyword in ANALYSIS_KEYWORDS:
        if keyword.lower() in message_lower:
            return True
    return False


def extract_analysis_params(message: str) -> Optional[Dict[str, str]]:
    """从消息中提取分析参数（数据集ID和分组）"""
    # 获取所有数据集
    try:
        datasets = dataset_service.get_all()
    except Exception as e:
        print(f"[extract_analysis_params] Error getting datasets: {e}")
        return None

    if not datasets:
        print("[extract_analysis_params] No datasets found")
        return None

    print(f"[extract_analysis_params] Found {len(datasets)} datasets")

    dataset_id = None

    # 首先尝试匹配 "ds_xxx" 格式
    dataset_match = re.search(r'ds[_-]?(\w+)', message, re.IGNORECASE)
    if dataset_match:
        potential_id = f"ds_{dataset_match.group(1)}"
        # 验证数据集是否存在
        for ds in datasets:
            if ds.id == potential_id:
                dataset_id = potential_id
                print(f"[extract_analysis_params] Found dataset by ID: {dataset_id}")
                break

    # 如果没找到，使用第一个数据集（默认）
    if not dataset_id:
        dataset_id = datasets[0].id
        print(f"[extract_analysis_params] Using default dataset: {dataset_id}")

    # 获取数据集的分组信息
    dataset = dataset_service.get_by_id(dataset_id)
    if not dataset or not dataset.groups:
        print(f"[extract_analysis_params] Dataset {dataset_id} has no groups")
        return None

    print(f"[extract_analysis_params] Dataset groups: {list(dataset.groups.keys())}")

    # 提取分组信息 - 默认使用数据集中定义的组
    group_keys = list(dataset.groups.keys())
    control_group = group_keys[0] if group_keys else "control"
    treatment_group = group_keys[-1] if len(group_keys) > 1 else (group_keys[0] if group_keys else "treatment")

    return {
        "dataset_id": dataset_id,
        "group_control": control_group,
        "group_treatment": treatment_group
    }


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

    # ===== 分析命令检测：使用 LangChain Agent =====
    if last_message and is_analysis_command(last_message):
        try:
            result = await run_analysis(last_message)
            if result.get("success"):
                return ChatResponse(content=result.get("output", ""))
            else:
                raise HTTPException(status_code=500, detail=result.get("error", "Analysis failed"))
        except HTTPException:
            raise
        except Exception as e:
            import traceback
            print(f"Analysis command failed: {e}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))

    # ===== 意图识别：检测是否需要分析 =====
    if last_message and detect_analysis_intent(last_message):
        # 尝试提取分析参数
        analysis_params = extract_analysis_params(last_message)
        if analysis_params:
            try:
                # 创建分析请求
                compare_request = CompareRequest(
                    dataset_id=analysis_params["dataset_id"],
                    group_control=analysis_params["group_control"],
                    group_treatment=analysis_params["group_treatment"]
                )

                # 调用分析服务（直接调用，模拟异步任务）
                from app.routers.analysis import analysis_tasks, schedule_cleanup
                import uuid

                job_id = f"job_{uuid.uuid4().hex[:8]}"
                analysis_tasks[job_id] = compare_request
                schedule_cleanup(job_id)

                # 返回分析任务信息给前端，让前端可以建立SSE连接
                return ChatResponse(
                    content=f"我已收到您的分析请求，正在为您进行差异分析...\n\n**任务ID**: `{job_id}`\n\n请稍候，我正在并行执行工具轨（统计检验）和大模型轨（AI推理）分析。",
                    request_id=job_id
                )
            except Exception as e:
                # 分析失败，继续普通对话
                import traceback
                print(f"Analysis intent detected but failed: {e}")
                traceback.print_exc()

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
