# ABC 自然语言数据分析系统设计

**日期**: 2026-04-07
**版本**: 1.0
**状态**: 已确认

---

## 一、概述

ABC: Agricultural Breeding Claw (农业育种智能助手) 通过自然语言或命令方式调用生物信息分析工具，完成基因表达数据分析。

### 目标

- 用户通过自然语言（如"分析这个数据集的差异基因"）或命令（如`/analyze`）发起分析
- 系统理解意图，调用 LangChain Agent + Tools 执行分析
- 在聊天界面中以交互式面板展示结果

### 当前版本范围

MVP 版本聚焦**差异表达分析**功能，其他功能（富集分析、聚类、基因ID转换）作为后续扩展。

---

## 二、技术架构

### 整体架构

```
用户输入（自然语言/命令）
        ↓
   ChatPage 聊天界面
        ↓
  LLM (意图识别 + Agent)
        ↓
   LangChain Tools (差异分析工具)
        ↓
   返回结果 → 交互式展示
```

### 目录结构

```
backend/
├── app/
│   ├── tools/
│   │   ├── __init__.py      # 工具注册表
│   │   ├── base.py          # 工具基类
│   │   └── differential.py  # 差异表达分析工具
│   ├── agent/
│   │   └── analysis_agent.py  # LangChain ReAct Agent
│   ├── services/
│   │   └── chat_service.py    # 聊天服务
│   └── routers/
│       └── chat.py           # 聊天 API 路由
```

---

## 三、核心组件

### 3.1 工具层 (tools/)

#### 工具基类 (base.py)

```python
from abc import ABC, abstractmethod
from typing import Any, Dict

class BaseTool(ABC):
    """工具基类，定义标准接口"""
    name: str  # 工具名称
    description: str  # 工具描述，供 LLM 理解何时调用

    @abstractmethod
    def execute(self, **kwargs) -> Dict[str, Any]:
        """执行工具的核心逻辑"""
        pass

    def get_schema(self) -> Dict[str, Any]:
        """返回工具参数 schema"""
        return {}
```

#### 差异表达分析工具 (differential.py)

使用 `@tool` 装饰器定义 LangChain 工具：

```python
@tool
def differential_expression_analysis(
    dataset_path: str,
    control_group: str,
    treatment_group: str,
    pvalue_threshold: float = 0.05,
    log2fc_threshold: float = 1.0
) -> dict:
    """进行差异表达分析，比较处理组和对照组，找出显著差异基因。

    适用于：RNA-seq 计数数据、基因表达矩阵分析。
    返回：显著差异基因列表、火山图数据、统计结果。
    """
    # 分析逻辑
    ...
    return {
        "significant_genes": [...],
        "volcano_data": [...],
        "summary": {...}
    }
```

**参数说明**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| dataset_path | string | 是 | 数据文件路径，默认 `backend/data/real_datasets/GSE242459_Count_matrix.txt` |
| control_group | string | 是 | 对照组名称 (如 "WT") |
| treatment_group | string | 是 | 处理组名称 (如 "treatment") |
| pvalue_threshold | float | 否 | P 值阈值，默认 0.05 |
| log2fc_threshold | float | 否 | log2FC 阈值，默认 1.0 |

### 3.2 Agent 层 (agent/)

使用 LangChain ReAct Agent：

```python
from langchain.agents import create_react_agent, AgentExecutor
from langchain import hub

def create_analysis_agent(llm, tools):
    """创建分析 Agent"""
    prompt = hub.pull("hwchase17/react")
    agent = create_react_agent(llm, tools, prompt)
    return AgentExecutor(agent=agent, tools=tools, verbose=True)
```

### 3.3 服务层 (services/)

```python
class ChatService:
    """聊天服务，整合 Agent 和工具"""

    def __init__(self):
        self.llm = llm_service
        self.tools = get_available_tools()
        self.agent = create_analysis_agent(self.llm, self.tools)

    async def process_message(self, user_input: str) -> AsyncGenerator[str, None]:
        """处理用户消息，返回 SSE 流式响应"""
        async for chunk in self.agent.astream({"input": user_input}):
            yield f"data: {json.dumps(chunk)}\n\n"
```

---

## 四、数据格式

### 4.1 数据集格式

当前使用 GSE242459_Count_matrix.txt：
- 第一列：基因 ID
- 其他列：样本表达量
- 列名格式：`{条件}_{品种}_{重复}`，如 `DS_WT_rep1`

**样本分组**（从列名识别）：
| 组别 | 列 |
|------|-----|
| WT对照组 | DS_WT_rep1, DS_WT_rep2, N_WT_rep1, N_WT_rep2, RE_WT_rep1, RE_WT_rep2 |
| 处理组 | DS_osbzip23_rep1, DS_osbzip23_rep2 |

### 4.2 分析结果格式

```json
{
  "significant_genes": [
    {
      "gene_id": "OsMH_01G0000400",
      "expression_change": "up",
      "log2fc": 5.23,
      "pvalue": 0.001
    }
  ],
  "volcano_data": [
    {"gene_id": "...", "log2fc": 1.5, "neg_log10_pvalue": 3.2}
  ],
  "summary": {
    "total_genes": 100,
    "upregulated": 10,
    "downregulated": 5,
    "method": "t-test"
  }
}
```

---

## 五、API 设计

### 5.1 聊天接口

**POST /api/chat**

请求：
```json
{
  "message": "帮我分析 GSE242459 数据集，比较 WT 和 osbzip23 组的差异基因",
  "stream": true
}
```

响应 (SSE)：
```
data: {"type": "thinking", "content": "正在分析..."}
data: {"type": "tool_call", "tool": "differential_expression_analysis", "params": {...}}
data: {"type": "result", "data": {...}}
data: {"type": "done"}
```

### 5.2 命令格式

支持两种输入：

**自然语言**：
- "分析这个数据集"
- "找出处理组和对照组的差异基因"
- "做差异表达分析，p值阈值 0.01"

**命令**：
- `/analyze --dataset GSE242459 --control WT --treatment osbzip23`
- `/diff --dataset GSE242459 --control WT --treatment osbzip23 --pvalue 0.01 --log2fc 2`

---

## 六、前端交互

### 6.1 复用现有 ChatPage

在现有聊天界面中：
1. 用户输入自然语言或命令
2. 系统流式返回分析进度和结果
3. 结果以交互式卡片展示

### 6.2 结果展示

分析结果展示为交互式面板：
- **摘要卡片**: 显示上调/下调基因数量、统计信息
- **火山图**: 可 hover 查看基因详情
- **基因表格**: 可排序、搜索、点击查看基因详情
- **导出按钮**: 导出 CSV/JSON 结果

---

## 七、扩展计划

以下功能在 MVP 后实现：

| 功能 | 工具名称 | 优先级 |
|------|----------|--------|
| 富集分析 (GO/KEGG) | `enrichment_analysis` | P1 |
| 聚类分析 (PCA/热图) | `clustering_analysis` | P1 |
| 基因 ID 转换 | `gene_id_converter` | P2 |
| 批次效应校正 | `batch_correction` | P2 |

---

## 八、依赖

```txt
# backend/requirements.txt
langchain>=0.1.0
langchain-core>=0.1.0
scipy>=1.11.0
pandas>=2.0.0
numpy>=1.24.0
```

---

## 九、风险与注意事项

1. **LLM 意图识别准确性**: 需设计清晰的 prompt，确保 LLM 正确选择工具
2. **流式响应**: 使用 SSE 需处理好连接中断
3. **大文件处理**: 基因计数矩阵可能很大，需考虑分块或采样
