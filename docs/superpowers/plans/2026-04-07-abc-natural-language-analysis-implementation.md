# ABC 自然语言数据分析实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 ABC 系统的自然语言数据分析功能，用户可通过自然语言或命令调用 LangChain Agent + Tools 进行差异表达分析

**Architecture:**
- 后端: LangChain ReAct Agent + Tools (差异分析工具)
- 复用现有 chat router，通过 LangChain Agent 处理分析请求
- 前端: 复用 ChatPage，展示交互式分析结果

**Tech Stack:** LangChain, FastAPI, React, SSE

---

## Chunk 1: 工具层 (tools/)

### Task 1: 创建工具目录和基础结构

**Files:**
- Create: `backend/app/tools/__init__.py`
- Create: `backend/app/tools/base.py`
- Create: `backend/app/tools/differential.py`

- [ ] **Step 1: 创建 tools 目录**

```bash
mkdir -p backend/app/tools
touch backend/app/tools/__init__.py
```

- [ ] **Step 2: 创建工具基类 base.py**

```python
# backend/app/tools/base.py
from abc import ABC, abstractmethod
from typing import Any, Dict

class BaseTool(ABC):
    """工具基类，定义标准接口"""
    name: str
    description: str

    @abstractmethod
    def execute(self, **kwargs) -> Dict[str, Any]:
        """执行工具的核心逻辑"""
        pass

    def get_schema(self) -> Dict[str, Any]:
        """返回工具参数 schema"""
        return {}
```

- [ ] **Step 3: 创建差异分析工具 differential.py**

```python
# backend/app/tools/differential.py
from langchain.tools import tool
import pandas as pd
import numpy as np
from scipy import stats
from typing import List, Dict, Any
from pathlib import Path

# 默认数据集路径
DEFAULT_DATASET = Path("backend/data/real_datasets/GSE242459_Count_matrix.txt")

@tool
def differential_expression_analysis(
    dataset_path: str = None,
    control_group: str = "WT",
    treatment_group: str = "osbzip23",
    pvalue_threshold: float = 0.05,
    log2fc_threshold: float = 1.0
) -> str:
    """进行差异表达分析，比较处理组和对照组，找出显著差异基因。

    适用于：RNA-seq 计数数据、基因表达矩阵分析。
    返回：显著差异基因列表、火山图数据、统计结果。

    参数:
        dataset_path: 数据文件路径，默认使用 GSE242459
        control_group: 对照组名称，如 "WT"
        treatment_group: 处理组名称，如 "osbzip23"
        pvalue_threshold: P值阈值，默认 0.05
        log2fc_threshold: log2FC 阈值，默认 1.0
    """
    if dataset_path is None:
        dataset_path = str(DEFAULT_DATASET)

    # 读取数据
    df = pd.read_csv(dataset_path, sep='\t')
    gene_col = df.columns[0]

    # 根据列名识别样本分组
    control_cols = [c for c in df.columns if f"_{control_group}_" in c]
    treatment_cols = [c for c in df.columns if treatment_group in c and control_group not in c]

    if not control_cols or not treatment_cols:
        return f"Error: 未找到对照组({control_group})或处理组({treatment_group})的样本列"

    results = []
    significant = []

    for _, row in df.iterrows():
        gene_id = str(row[gene_col])
        control_values = [row[c] for c in control_cols if c in df.columns]
        treatment_values = [row[c] for c in treatment_cols if c in df.columns]

        if len(control_values) < 2 or len(treatment_values) < 2:
            continue

        control_mean = np.mean(control_values)
        treatment_mean = np.mean(treatment_values)

        if control_mean > 0 and treatment_mean > 0:
            log2fc = np.log2(treatment_mean / control_mean)
        else:
            log2fc = 0

        t_stat, pvalue = stats.ttest_ind(control_values, treatment_values)

        gene_result = {
            "gene_id": gene_id,
            "control_mean": round(float(control_mean), 2),
            "treatment_mean": round(float(treatment_mean), 2),
            "log2fc": round(float(log2fc), 4),
            "pvalue": round(float(pvalue), 6),
            "significant": pvalue < pvalue_threshold and abs(log2fc) >= log2fc_threshold
        }
        results.append(gene_result)

        if gene_result["significant"]:
            significant.append(gene_result)

    # 火山图数据
    volcano_data = [
        {
            "gene_id": r["gene_id"],
            "log2fc": r["log2fc"],
            "neg_log10_pvalue": -np.log10(r["pvalue"]) if r["pvalue"] > 0 else 0,
            "significant": r["significant"]
        }
        for r in results
    ]

    summary = {
        "total_genes": len(results),
        "significant_count": len(significant),
        "upregulated": len([s for s in significant if s["log2fc"] > 0]),
        "downregulated": len([s for s in significant if s["log2fc"] < 0]),
        "control_group": control_group,
        "treatment_group": treatment_group,
        "pvalue_threshold": pvalue_threshold,
        "log2fc_threshold": log2fc_threshold
    }

    import json
    return json.dumps({
        "significant_genes": significant[:50],  # 限制数量
        "volcano_data": volcano_data,
        "summary": summary
    }, ensure_ascii=False)
```

- [ ] **Step 4: 创建工具注册表 __init__.py**

```python
# backend/app/tools/__init__.py
from .differential import differential_expression_analysis

# 导出所有工具
__all__ = ["differential_expression_analysis"]
```

- [ ] **Step 5: 提交**

```bash
git add backend/app/tools/
git commit -m "feat: add tools module with differential expression analysis tool"
```

---

## Chunk 2: Agent 层

### Task 2: 创建 LangChain Agent

**Files:**
- Create: `backend/app/agent/__init__.py`
- Create: `backend/app/agent/analysis_agent.py`

- [ ] **Step 1: 创建 agent 目录和 __init__.py**

```bash
mkdir -p backend/app/agent
touch backend/app/agent/__init__.py
```

- [ ] **Step 2: 创建 analysis_agent.py**

```python
# backend/app/agent/analysis_agent.py
from typing import List, Dict, Any, Optional
from langchain.agents import create_react_agent, AgentExecutor
from langchain.tools import Tool
from langchain import hub

from app.tools.differential import differential_expression_analysis
from app.services.llm_service import llm_service

# 构建 LangChain Tools
tools = [
    Tool(
        name="differential_expression_analysis",
        func=differential_expression_analysis.func,
        description=differential_expression_analysis.description
    )
]

def get_analysis_agent():
    """获取配置好的分析 Agent"""
    # 获取 ReAct prompt
    prompt = hub.pull("hwchase17/react")

    # 创建 Agent
    agent = create_react_agent(
        llm=llm_service.chat,
        tools=tools,
        prompt=prompt
    )

    return AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True,
        handle_parsing_errors=True
    )

async def run_analysis(user_input: str) -> Dict[str, Any]:
    """运行分析，返回结果"""
    agent_executor = get_analysis_agent()

    try:
        # 执行 Agent
        result = await agent_executor.ainvoke({"input": user_input})
        return {
            "success": True,
            "output": result.get("output", ""),
            "intermediate_steps": result.get("intermediate_steps", [])
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
```

- [ ] **Step 2: 更新 agent/__init__.py**

```python
# backend/app/agent/__init__.py
from .analysis_agent import get_analysis_agent, run_analysis

__all__ = ["get_analysis_agent", "run_analysis"]
```

- [ ] **Step 3: 提交**

```bash
git add backend/app/agent/
git commit -m "feat: add LangChain ReAct agent for analysis"
```

---

## Chunk 3: Chat Router 改造

### Task 3: 修改 chat router 支持 Agent

**Files:**
- Modify: `backend/app/routers/chat.py`

- [ ] **Step 1: 添加 Agent 导入和意图检测**

在 chat.py 顶部添加：
```python
from app.agent.analysis_agent import run_analysis
```

添加命令检测函数：
```python
def is_analysis_command(message: str) -> bool:
    """检测是否为分析命令"""
    return message.strip().startswith("/analyze") or \
           message.strip().startswith("/diff") or \
           message.strip().startswith("/analyse")
```

- [ ] **Step 2: 修改 chat endpoint**

在 `@router.post("/")` 中添加命令处理分支：

```python
@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    last_message = request.messages[-1].content if request.messages else ""

    # 检测是否为分析命令
    if is_analysis_command(last_message):
        result = await run_analysis(last_message)
        if result.get("success"):
            return ChatResponse(content=result.get("output", ""))
        else:
            return ChatResponse(content=f"分析失败: {result.get('error')}")

    # 原有分析意图检测逻辑保持不变...
```

- [ ] **Step 3: 提交**

```bash
git add backend/app/routers/chat.py
git commit -m "feat: integrate LangChain agent into chat router"
```

---

## Chunk 4: 前端 ChatPage 改造

### Task 4: 修改前端支持自然语言分析

**Files:**
- Modify: `src/pages/ChatPage.tsx`
- Modify: `src/api/client.ts`

- [ ] **Step 1: 查看现有 ChatPage 结构**

读取 `src/pages/ChatPage.tsx` 了解消息渲染和 API 调用方式

- [ ] **Step 2: 修改 API client 添加 chat endpoint**

在 `src/api/client.ts` 添加：
```typescript
export const chatApi = {
  sendMessage: async (messages: ChatMessage[], stream = true) => {
    const response = await fetch('/api/chat/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, stream })
    });
    return response.json();
  }
};
```

- [ ] **Step 3: 修改 ChatPage 消息处理**

确保消息发送到 `/api/chat/` 而非其他 endpoint

- [ ] **Step 4: 提交**

```bash
git add src/pages/ChatPage.tsx src/api/client.ts
git commit -m "feat: update ChatPage to use natural language chat API"
```

---

## Chunk 5: 交互式结果展示

### Task 5: 添加分析结果交互展示组件

**Files:**
- Create: `src/components/AnalysisResultCard.tsx`

- [ ] **Step 1: 创建分析结果卡片组件**

```tsx
// src/components/AnalysisResultCard.tsx
import React from 'react';
import { Card, Table, Tag, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface Gene {
  gene_id: string;
  log2fc: number;
  pvalue: number;
  expression_change?: string;
}

interface AnalysisResult {
  significant_genes: Gene[];
  volcano_data: any[];
  summary: {
    total_genes: number;
    significant_count: number;
    upregulated: number;
    downregulated: number;
    control_group: string;
    treatment_group: string;
  };
}

export const AnalysisResultCard: React.FC<{ result: AnalysisResult }> = ({ result }) => {
  const columns: ColumnsType<Gene> = [
    { title: 'Gene ID', dataIndex: 'gene_id', key: 'gene_id' },
    { title: 'log2FC', dataIndex: 'log2fc', key: 'log2fc', sorter: (a, b) => a.log2fc - b.log2fc },
    { title: 'P-value', dataIndex: 'pvalue', key: 'pvalue', sorter: (a, b) => a.pvalue - b.pvalue },
    {
      title: 'Change',
      dataIndex: 'log2fc',
      key: 'change',
      render: (val: number) => val > 0 ? <Tag color="red">Up</Tag> : <Tag color="blue">Down</Tag>
    }
  ];

  return (
    <Card title="差异表达分析结果">
      <div style={{ marginBottom: 16 }}>
        <Tag color="blue">对照组: {result.summary.control_group}</Tag>
        <Tag color="green">处理组: {result.summary.treatment_group}</Tag>
        <Tag color="purple">上调: {result.summary.upregulated}</Tag>
        <Tag color="orange">下调: {result.summary.downregulated}</Tag>
      </div>
      <Table columns={columns} dataSource={result.significant_genes} rowKey="gene_id" size="small" />
    </Card>
  );
};
```

- [ ] **Step 2: 在 ChatPage 中集成结果卡片**

在消息渲染中检测分析结果并展示卡片

- [ ] **Step 3: 提交**

```bash
git add src/components/AnalysisResultCard.tsx
git commit -m "feat: add AnalysisResultCard component for interactive result display"
```

---

## Chunk 6: 端到端测试

### Task 6: 测试完整流程

- [ ] **Step 1: 启动后端服务**

```bash
cd backend && uvicorn app.main:app --reload --port 8003
```

- [ ] **Step 2: 启动前端服务**

```bash
npm run dev
```

- [ ] **Step 3: 测试自然语言输入**

在聊天界面输入：
- "帮我分析差异表达"
- "/analyze --control WT --treatment osbzip23"

- [ ] **Step 4: 验证结果展示**

检查分析结果是否正确显示

---

## 执行顺序

1. Chunk 1: 工具层 (tools/) - 创建差异分析工具
2. Chunk 2: Agent 层 - 创建 LangChain Agent
3. Chunk 3: Chat Router 改造 - 集成 Agent
4. Chunk 4: 前端 ChatPage 改造
5. Chunk 5: 交互式结果展示
6. Chunk 6: 端到端测试
