# Agent Loop 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用原生 Agent Loop 模式（参考 shareAI-lab/learn-claude-code 仓库）替换现有 LangChain ReAct Agent，让 LLM 通过 function calling 自主决定调用哪个工具、传什么参数。

**Architecture:**
- 删除 LangChain 依赖，改用 `openai` SDK 调用千问 OpenAI 兼容接口（支持 function calling）
- `analysis_agent.py` 改写为标准 Agent Loop：`while stop_reason == "tool_use": call LLM → dispatch tools → feed results back`
- `chat.py` router 简化：不再做关键词意图识别，统一交给 Agent Loop 判断

**Tech Stack:** Python openai SDK, 千问 OpenAI 兼容接口 (`dashscope.aliyuncs.com/compatible-mode/v1`), FastAPI async

---

## 文件变更一览

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/agent/analysis_agent.py` | **重写** | 核心 Agent Loop，替换 LangChain |
| `backend/app/routers/chat.py` | **简化** | 去掉关键词意图识别，统一走 Agent |
| `backend/app/tools/differential.py` | **修改** | 去掉 `@tool` 装饰器，改为普通函数 + JSON schema |
| `backend/requirements.txt` | **修改** | 移除 langchain，添加 openai |

---

## Chunk 1: 工具层去 LangChain 化

### Task 1: 将差异分析工具改为普通函数 + JSON schema

**Files:**
- Modify: `backend/app/tools/differential.py`

现有代码用 `@tool` 装饰器（LangChain），需要改为：
1. 普通 Python 函数（供 Agent 直接调用）
2. 配套的 JSON schema（供 LLM 做 function calling）

- [ ] **Step 1: 读取当前文件确认现状**

运行确认：
```bash
head -20 backend/app/tools/differential.py
```
期望看到 `from langchain.tools import tool` 和 `@tool` 装饰器。

- [ ] **Step 2: 重写 differential.py，去掉 LangChain 依赖**

将 `backend/app/tools/differential.py` 完整替换为：

```python
"""Differential expression analysis tool - plain function + JSON schema for Agent Loop."""

import json
from pathlib import Path
from typing import Any, Dict

import numpy as np
import pandas as pd
from scipy import stats


DEFAULT_DATASET_PATH = "backend/data/datasets/GSE242459_Count_matrix.txt"


def differential_expression_analysis(
    dataset_path: str = DEFAULT_DATASET_PATH,
    control_group: str = "WT",
    treatment_group: str = "osbzip23",
    pvalue_threshold: float = 0.05,
    log2fc_threshold: float = 1.0,
) -> str:
    """Perform differential expression analysis on gene expression data.

    Returns JSON string with significant_genes, volcano_data, and summary.
    """
    result: Dict[str, Any] = {"significant_genes": [], "volcano_data": [], "summary": {}}

    try:
        # Resolve path relative to project root
        path = Path(dataset_path)
        if not path.is_absolute():
            project_root = Path(__file__).parent.parent.parent.parent
            path = project_root / dataset_path

        if not path.exists():
            return json.dumps({"error": f"Dataset file not found: {path}"}, ensure_ascii=False)

        df = pd.read_csv(path, sep="\t", index_col=0)
        if df.empty:
            return json.dumps({"error": "Dataset is empty"}, ensure_ascii=False)

        control_samples = [col for col in df.columns if control_group in col]
        treatment_samples = [col for col in df.columns if treatment_group in col]

        if not control_samples:
            return json.dumps(
                {"error": f"No control samples found matching: {control_group}"},
                ensure_ascii=False,
            )
        if not treatment_samples:
            return json.dumps(
                {"error": f"No treatment samples found matching: {treatment_group}"},
                ensure_ascii=False,
            )

        gene_results = []
        significant_genes = []

        for gene_id, row in df.iterrows():
            ctrl_vals = [row[s] for s in control_samples if s in df.columns]
            trt_vals = [row[s] for s in treatment_samples if s in df.columns]

            if len(ctrl_vals) < 2 or len(trt_vals) < 2:
                continue

            ctrl_mean = np.mean(ctrl_vals)
            trt_mean = np.mean(trt_vals)

            if ctrl_mean <= 0 or trt_mean <= 0:
                continue

            log2fc = float(np.log2(trt_mean / ctrl_mean))
            t_stat, pvalue = stats.ttest_ind(ctrl_vals, trt_vals)
            pvalue = float(pvalue)

            is_sig = pvalue < pvalue_threshold and abs(log2fc) >= log2fc_threshold
            if is_sig:
                significant_genes.append({
                    "gene_id": str(gene_id),
                    "expression_change": "up" if log2fc > 0 else "down",
                    "log2fc": round(log2fc, 4),
                    "pvalue": round(pvalue, 6),
                })

            gene_results.append({
                "gene_id": str(gene_id),
                "log2fc": round(log2fc, 4),
                "neg_log10_pvalue": round(float(-np.log10(pvalue)) if pvalue > 0 else 0, 4),
                "pvalue": round(pvalue, 6),
                "significant": bool(is_sig),
            })

        up = [g for g in significant_genes if g["expression_change"] == "up"]
        down = [g for g in significant_genes if g["expression_change"] == "down"]
        up.sort(key=lambda x: x["log2fc"], reverse=True)
        down.sort(key=lambda x: x["log2fc"])

        result["significant_genes"] = up[:10] + down[:10]
        result["all_significant_genes"] = significant_genes
        result["volcano_data"] = sorted(gene_results, key=lambda x: abs(x["log2fc"]), reverse=True)
        result["summary"] = {
            "total_genes_tested": len(gene_results),
            "significant_genes_count": len(significant_genes),
            "upregulated_count": len(up),
            "downregulated_count": len(down),
            "control_group": control_group,
            "treatment_group": treatment_group,
            "control_samples": control_samples,
            "treatment_samples": treatment_samples,
            "pvalue_threshold": pvalue_threshold,
            "log2fc_threshold": log2fc_threshold,
        }

        return json.dumps(result, ensure_ascii=False, indent=2)

    except Exception as e:
        return json.dumps({"error": f"Analysis failed: {str(e)}"}, ensure_ascii=False)


# JSON schema for LLM function calling
DIFFERENTIAL_ANALYSIS_SCHEMA = {
    "type": "function",
    "function": {
        "name": "differential_expression_analysis",
        "description": (
            "对基因表达数据进行差异表达分析，比较处理组和对照组，找出显著差异基因。"
            "适用于 RNA-seq 计数数据。"
            "返回：显著差异基因列表、火山图数据、统计摘要。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "dataset_path": {
                    "type": "string",
                    "description": "数据文件路径，默认使用 GSE242459",
                    "default": DEFAULT_DATASET_PATH,
                },
                "control_group": {
                    "type": "string",
                    "description": "对照组名称，用于匹配样本列名，如 'WT'",
                    "default": "WT",
                },
                "treatment_group": {
                    "type": "string",
                    "description": "处理组名称，用于匹配样本列名，如 'osbzip23'",
                    "default": "osbzip23",
                },
                "pvalue_threshold": {
                    "type": "number",
                    "description": "P值阈值，默认 0.05",
                    "default": 0.05,
                },
                "log2fc_threshold": {
                    "type": "number",
                    "description": "log2 Fold Change 阈值，默认 1.0",
                    "default": 1.0,
                },
            },
            "required": [],
        },
    },
}
```

- [ ] **Step 3: 验证语法正确**

```bash
cd backend && python -c "from app.tools.differential import differential_expression_analysis, DIFFERENTIAL_ANALYSIS_SCHEMA; print('OK')"
```

期望输出：`OK`

- [ ] **Step 4: 更新 tools/__init__.py**

将 `backend/app/tools/__init__.py` 替换为：

```python
from .differential import differential_expression_analysis, DIFFERENTIAL_ANALYSIS_SCHEMA

__all__ = ["differential_expression_analysis", "DIFFERENTIAL_ANALYSIS_SCHEMA"]
```

- [ ] **Step 5: 提交**

```bash
git add backend/app/tools/differential.py backend/app/tools/__init__.py
git commit -m "refactor: remove LangChain @tool decorator, use plain function + JSON schema"
```

---

## Chunk 2: 核心 Agent Loop 重写

### Task 2: 重写 analysis_agent.py 为原生 Agent Loop

**Files:**
- Modify: `backend/app/agent/analysis_agent.py`

这是核心重构。用 `openai` SDK 调用千问 OpenAI 兼容接口，实现真正的 Agent Loop：LLM 自主决定是否调用工具、传什么参数，结果回传循环直到 LLM 停止。

- [ ] **Step 1: 安装 openai SDK**

```bash
cd backend && pip install openai>=1.0.0
```

期望：`Successfully installed openai-...`

- [ ] **Step 2: 更新 requirements.txt**

将 `backend/requirements.txt` 中：
- 删除：`langchain==0.3.28`、`langchain-core==0.3.83`、`langchain-community==0.3.28`
- 添加：`openai>=1.0.0`

```
fastapi==0.109.0
uvicorn==0.27.0
pydantic==2.5.3
pydantic-settings==2.1.0
openai>=1.0.0
httpx==0.26.0
python-multipart==0.0.6
pandas==2.2.0
numpy==1.26.3
scipy==1.12.0
pydeseq2==0.4.0
python-dotenv==1.0.0
scikit-learn==1.4.0
passlib[bcrypt]==1.7.4
python-jose[cryptography]==3.3.0
sqlalchemy==2.0.25
```

- [ ] **Step 3: 重写 analysis_agent.py**

将 `backend/app/agent/analysis_agent.py` 完整替换为：

```python
"""Native Agent Loop for ABC - inspired by shareAI-lab/learn-claude-code.

Replaces LangChain ReAct Agent with a direct Agent Loop:
    while stop_reason == "tool_use":
        response = LLM(messages, tools)
        dispatch tools
        append results
        continue
"""

import json
from typing import Any, AsyncGenerator, Dict, List

from openai import OpenAI

from app.config import settings
from app.tools.differential import (
    DIFFERENTIAL_ANALYSIS_SCHEMA,
    differential_expression_analysis,
)

# ── 工具注册表：名称 → 可调用函数 ──────────────────────────────────────────
TOOL_HANDLERS = {
    "differential_expression_analysis": lambda **kw: differential_expression_analysis(**kw),
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
        - output: str（格式化结果，含嵌入的 JSON 数据）
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
        output = _agent_loop(messages)
        return {"success": True, "output": output, "error": None}
    except Exception as e:
        return {"success": False, "output": None, "error": str(e)}
```

- [ ] **Step 4: 验证 Agent 模块可导入**

```bash
cd backend && python -c "from app.agent.analysis_agent import run_analysis; print('Agent Loop OK')"
```

期望输出：`Agent Loop OK`

- [ ] **Step 5: 提交**

```bash
git add backend/app/agent/analysis_agent.py backend/requirements.txt
git commit -m "refactor: replace LangChain ReAct with native Agent Loop using OpenAI-compatible API"
```

---

## Chunk 3: 简化 chat router

### Task 3: 简化 chat.py 意图识别逻辑

**Files:**
- Modify: `backend/app/routers/chat.py`

现在 Agent 自己能理解意图了，chat router 不需要关键词列表和正则匹配，只需要：当用户消息包含分析意图时交给 Agent，否则走普通 LLM。

- [ ] **Step 1: 读取当前 chat.py 确认逻辑**

```bash
grep -n "is_analysis_command\|detect_analysis_intent\|ANALYSIS_KEYWORDS\|run_analysis" backend/app/routers/chat.py
```

期望看到两个函数（`is_analysis_command`、`detect_analysis_intent`）和关键词列表。

- [ ] **Step 2: 替换 chat.py 顶部导入和意图检测逻辑**

将 `backend/app/routers/chat.py` 中的关键词列表和两个检测函数替换为单一函数：

找到并替换这段代码（从 `# 意图识别关键词` 到 `def extract_analysis_params` 之前）：

**old_string:**
```python
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
```

**new_string:**
```python
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
```

- [ ] **Step 3: 更新 chat endpoint 使用新函数**

在 `@router.post("/")` 中，将两个 if 分支（`is_analysis_command` 和 `detect_analysis_intent`）合并为一个：

找到：
```python
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
        # 使用新的 LangChain Agent 进行分析
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
            print(f"Analysis intent failed: {e}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))
```

替换为：
```python
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
            import traceback
            print(f"Agent loop failed: {e}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 4: 验证 chat router 可导入**

```bash
cd backend && python -c "from app.routers.chat import router; print('Chat router OK')"
```

期望输出：`Chat router OK`

- [ ] **Step 5: 提交**

```bash
git add backend/app/routers/chat.py
git commit -m "refactor: simplify chat router intent detection, delegate to Agent Loop"
```

---

## Chunk 4: 端到端验证

### Task 4: 启动服务并验证 Agent Loop 正常工作

**Files:** 无文件修改，仅验证

- [ ] **Step 1: 启动后端服务**

```bash
cd D:/code/claude/breeding-scientist
PYTHONPATH=backend uvicorn app.main:app --reload --port 8003
```

期望看到：`Application startup complete.`（无报错）

- [ ] **Step 2: 测试分析命令（curl）**

新开终端：
```bash
curl -X POST http://localhost:8003/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "/analyze --control WT --treatment osbzip23"}]}'
```

期望：返回包含 `content` 字段的 JSON，内含分析结果文字描述。

- [ ] **Step 3: 测试自然语言输入**

```bash
curl -X POST http://localhost:8003/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "帮我分析一下 WT 和 osbzip23 组的差异表达基因"}]}'
```

期望：返回 Agent 自主调用工具后的中文分析结果。

- [ ] **Step 4: 验证工具参数由 LLM 决定（非正则解析）**

```bash
curl -X POST http://localhost:8003/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "分析差异基因，p值要严格一点，用0.01"}]}'
```

期望：Agent 自动将 pvalue_threshold 设为 0.01（LLM 自主决定参数）。

- [ ] **Step 5: 如有错误，检查 API key 配置**

若出现认证错误，确认环境变量：
```bash
python -c "from app.config import settings; print('API key set:', bool(settings.qwen_api_key))"
```

若为 False，创建 `backend/.env` 文件：
```
QWEN_API_KEY=your_dashscope_api_key_here
```

---

## 执行顺序

1. **Task 1** — 工具去 LangChain 化（最无风险，不影响其他模块）
2. **Task 2** — Agent Loop 核心重写（最关键）
3. **Task 3** — 简化 chat router（依赖 Task 2 的 `run_analysis` 签名不变）
4. **Task 4** — 端到端验证
