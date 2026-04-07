# 双轨差异分析系统设计文档

## 1. 项目概述

### 1.1 目标

实现一个支持双轨对比的差异表达分析系统，用户可以发起双轨分析请求（传统生信工具 vs 大模型），系统实时展示分析进度并呈现对比结果，用户可对结果进行评价反馈。

### 1.2 场景示例

用户发起请求：
> "希望使用3月6日的数据，做差异表达分析，并分别用传统工具和大模型分析，对比结果。"

系统执行双轨分析并实时推送进度，最终展示对比结果卡片。

## 2. 功能范围（第一期）

| 模块 | 功能描述 |
|------|----------|
| 数据集管理 | 支持从本体库选择数据 + 用户上传表达矩阵 (CSV/Excel) |
| 双轨分析引擎 | 工具轨(scipy.stats) + 大模型轨(千问) 并行对比分析 |
| 进度推送 | SSE 实时推送分析进度 |
| 结果展示 | 双轨对比视图，包含差异基因列表、一致性分析 |
| 用户反馈 | 点赞/点踩 + 评论功能 |

## 3. 系统架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (React)                        │
├─────────────────────────────────────────────────────────────┤
│  /analysis         /chat          /ontology    /settings   │
│  (双轨分析)        (智能对话)      (本体管理)    (系统设置)  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    HTTP / SSE
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                         后端 (FastAPI)                      │
├─────────────────────────────────────────────────────────────┤
│  /api/datasets    /api/analysis    /api/feedback  /api/... │
│  (数据集)          (双轨分析)        (用户反馈)    (其他)     │
├─────────────────────────────────────────────────────────────┤
│  Services:                                            │
│  - AnalysisService  (差异分析 + 双轨对比)                │
│  - LLMService      (千问API调用)                        │
│  - DatasetService  (数据集管理)                          │
│  - FeedbackService  (反馈存储)                            │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 页面结构

| 页面 | 路由 | 描述 |
|------|------|------|
| 分析页面 | `/analysis` | 双轨分析主页面（新建），包含数据集选择、分析执行、结果展示 |
| 聊天页面 | `/chat` | 智能对话（保留现有，增强意图识别：识别分析请求可跳转至/analysis） |
| 本体页面 | `/ontology` | 本体可视化与编辑 |
| 设置页面 | `/settings` | 系统设置 |

> **注意**: 现有 `/analysis` 页面重构为双轨分析专用页面，原有的通用数据分析功能作为子功能或独立Tab。

## 4. 后端设计

### 4.1 API 接口

#### 4.1.1 数据集管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/datasets` | 获取数据集列表 |
| POST | `/api/datasets` | 上传新数据集 |
| GET | `/api/datasets/{id}` | 获取数据集详情 |
| DELETE | `/api/datasets/{id}` | 删除数据集 |

#### 4.1.2 双轨分析

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/analysis/compare` | 发起双轨对比分析 |
| GET | `/api/analysis/stream/{job_id}` | SSE 流式接收分析进度 |
| GET | `/api/analysis/results` | 获取分析历史结果 |
| GET | `/api/analysis/results/{id}` | 获取单次分析结果详情 |

##### 4.1.2.1 分析请求

```python
class CompareRequest(BaseModel):
    dataset_id: str                   # 数据集ID
    group_control: str                # 对照组名称
    group_treatment: str             # 处理组名称
    pvalue_threshold: float = 0.05   # p值阈值
    log2fc_threshold: float = 1.0    # log2FC 阈值

# 响应
class CompareResponse(BaseModel):
    job_id: str                       # 任务ID
    status: str                      # "started"
```

##### 4.1.2.2 错误处理场景

| 场景 | HTTP 状态码 | 错误信息 |
|------|------------|----------|
| 数据集不存在 | 404 | "Dataset not found" |
| 分组不存在 | 400 | "Group '{name}' not found in dataset" |
| 样本数不足 | 400 | "Each group must have at least 2 samples" |
| LLM API 调用失败 | 502 | "LLM service unavailable: {detail}" |
| 数据集格式错误 | 400 | "Invalid dataset format: {detail}" |

#### 4.1.3 数据集上传

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/datasets/upload` | 上传表达矩阵文件 (multipart/form-data) |

#### 4.1.4 用户反馈

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/feedbacks` | 提交反馈（点赞/点踩 + 评论） |
| GET | `/api/feedbacks` | 获取反馈列表 |

### 4.2 数据模型

#### 4.2.1 数据集 (Dataset)

```python
class Dataset(BaseModel):
    id: str
    name: str                          # 数据集名称
    description: Optional[str]         # 描述
    data_type: str                    # 数据类型: "expression_matrix"
    file_path: str                    # 文件路径 (内部存储路径)
    file_size: Optional[int]          # 文件大小 (字节)
    gene_count: int                   # 基因数量
    sample_count: int                 # 样本数量
    groups: Dict[str, List[str]]      # 分组信息: {"control": ["sample1", "sample2"], "treatment": ["sample3", "sample4"]}
    owner: Optional[str]              # 创建者标识
    created_at: str
    updated_at: str
```

#### 4.2.1.1 数据集上传请求

```python
class DatasetUploadRequest(BaseModel):
    name: str                          # 数据集名称
    description: Optional[str]        # 描述
    group_control: str                 # 对照组名称
    group_treatment: str               # 处理组名称
    control_samples: List[str]         # 对照组样本列表
    treatment_samples: List[str]       # 处理组样本列表
    # 文件通过 multipart/form-data 上传
```

#### 4.2.1.2 数据集格式要求

- **支持格式**: CSV, Excel (.xlsx, .xls)
- **表达矩阵格式**:
  - 第一列为基因ID/基因名
  - 第一行为样本名
  - 值为表达量数值
- **验证规则**:
  - 基因数 >= 1
  - 样本数 >= 4 (每组至少2个)
  - 无空值
  - 数值为非负

#### 4.2.2 分析结果 (AnalysisResult)

```python
class AnalysisResult(BaseModel):
    id: str
    dataset_id: str
    dataset_name: str

    # 工具轨结果
    tool_result: ToolResult
    # 大模型轨结果
    llm_result: LLMResult
    # 一致性分析
    consistency: ConsistencyInfo

    created_at: str


class ToolResult(BaseModel):
    method: str                        # "deseq2_scipy"
    significant_genes: List[GeneInfo]  # 显著差异基因
    all_genes: List[GeneInfo]         # 所有基因的分析结果
    execution_time: float             # 执行时间(秒)


class LLMResult(BaseModel):
    model: str                         # "qwen-turbo"
    significant_genes: List[GeneInfo]
    reasoning: str                     # LLM 推理摘要
    execution_time: float


class GeneInfo(BaseModel):
    gene_id: str                       # 基因ID
    expression_change: Literal["up", "down", "none"]  # 表达变化方向
    log2fc: Optional[float]           # log2 fold change
    pvalue: Optional[float]           # p值
    reason: Optional[str]             # (LLM) 判断理由


class ConsistencyInfo(BaseModel):
    overlap: List[str]                 # 共同检出的基因
    tool_only: List[str]              # 仅工具轨检出
    llm_only: List[str]               # 仅LLM检出
    overlap_rate: float               # 重合率
```

#### 4.2.3 用户反馈 (Feedback)

```python
class Feedback(BaseModel):
    id: str
    analysis_id: str
    track: str                         # "tool" / "llm"
    rating: str                       # "positive" / "negative"
    comment: Optional[str]            # 用户评论
    gene_ids: Optional[List[str]]    # 反馈针对的具体基因
    created_by: Optional[str]        # 用户标识
    created_at: str
```

### 4.3 核心服务设计

#### 4.3.1 AnalysisService

```python
class AnalysisService:
    """双轨分析服务"""

    async def run_comparison(
        self,
        dataset: Dataset,
        group_control: str,
        group_treatment: str
    ) -> AnalysisResult:
        """执行双轨对比分析"""

        # 并行执行双轨分析
        tool_task = self._run_tool_analysis(dataset, group_control, group_treatment)
        llm_task = self._run_llm_analysis(dataset, group_control, group_treatment)

        tool_result, llm_result = await asyncio.gather(tool_task, llm_task)

        # 计算一致性
        consistency = self._calculate_consistency(tool_result, llm_result)

        return AnalysisResult(
            dataset_id=dataset.id,
            dataset_name=dataset.name,
            tool_result=tool_result,
            llm_result=llm_result,
            consistency=consistency
        )

    async def _run_tool_analysis(
        self,
        dataset: Dataset,
        group_control: str,
        group_treatment: str
    ) -> ToolResult:
        """工具轨分析 - 使用 scipy.stats 进行差异检验"""
        # 1. 读取表达矩阵
        # 2. 提取对照组/处理组数据
        # 3. 使用 t-test 或 Welch's t-test
        # 4. 返回显著差异基因

    async def _run_llm_analysis(
        self,
        dataset: Dataset,
        group_control: str,
        group_treatment: str
    ) -> LLMResult:
        """大模型轨分析 - 调用千问 API"""
        # 1. 生成数据摘要
        # 2. 构建提示词
        # 3. 调用 LLM
        # 4. 解析结果
```

#### 4.3.2 数据流

```
1. 用户选择数据集 + 指定分组
2. 发起 POST /api/analysis/compare
3. 后端启动双轨分析:
   - 开启 SSE 流
   - 推送: "正在解析数据..."
   - 工具轨: 读取CSV → t检验 → 差异基因列表
   - LLM轨: 生成摘要 → 调用API → 解析结果
   - 对比结果计算
4. 返回分析结果
5. 前端展示对比卡片
6. 用户可提交反馈
```

## 5. 前端设计

### 5.1 分析页面组件

```
AnalysisPage
├── Header (标题 + 说明)
├── DatasetSection
│   ├── DatasetSelector (从本体库选择)
│   └── FileUploader (上传新数据)
├── AnalysisConfig
│   ├── GroupSelector (选择对照组/处理组)
│   └── AnalyzeButton (发起分析)
├── ProgressPanel (SSE进度展示)
│   └── ProgressItem (工具轨/大模型轨进度)
└── ResultSection
    ├── ComparisonCard (双轨对比卡片)
    │   ├── ToolPanel (工具轨结果)
    │   ├── LLMPanel (大模型轨结果)
    │   └── ConsistencySummary (一致性总结)
    └── FeedbackPanel (反馈组件)
        ├── ThumbUp / ThumbDown
        └── CommentInput
```

### 5.2 消息类型扩展 (用于聊天页面)

```typescript
type MessageType = 'text' | 'progress' | 'comparison' | 'error';

interface ProgressMessage {
  type: 'progress';
  track: 'tool' | 'llm';
  status: string;
  progress: number;
}

interface ComparisonMessage {
  type: 'comparison';
  title: string;
  toolResult: ToolResult;
  llmResult: LLMResult;
  consistency: ConsistencyInfo;
}
```

### 5.3 UI 设计要点

- **进度展示**: 使用步骤条或进度条，双轨并行显示
- **对比卡片**: 左右分栏，左侧工具轨，右侧大模型轨
- **交互**: 每个结果区域有独立的点赞/点踩按钮和评论框
- **系统自称**: "ABC" (参考示例)

## 6. 存储设计

### 6.1 文件存储

```
backend/data/
├── config.json           # 系统配置 (已存在)
├── ontology.json         # 本体数据 (已存在)
├── datasets/             # 用户上传的数据集
│   └── {uuid}.csv
├── analysis_results/     # 分析结果历史
│   └── {uuid}.json
└── feedback.json         # 用户反馈 (新增)
```

### 6.2 feedback.json 结构

```json
{
  "feedbacks": [
    {
      "id": "fb_001",
      "analysis_id": "ar_001",
      "track": "llm",
      "rating": "negative",
      "comment": "漏掉了Gene7，这个基因很重要。",
      "created_at": "2026-03-18T10:30:00Z"
    }
  ]
}
```

## 7. SSE 进度推送

### 7.1 事件格式

```
event: progress
data: {"job_id": "uuid", "track": "tool", "status": "数据预处理完成", "progress": 30}

event: progress
data: {"job_id": "uuid", "track": "tool", "status": "DESeq2 分析完成", "progress": 60}

event: progress
data: {"job_id": "uuid", "track": "llm", "status": "正在调用大模型...", "progress": 50}

event: result
data: {"job_id": "uuid", "result": {<完整的AnalysisResult JSON>}}

event: error
data: {"job_id": "uuid", "message": "分析失败原因"}

event: heartbeat
data: {"job_id": "uuid", "status": "alive"}
```

### 7.2 连接管理

- **心跳**: 每 30 秒发送一次 heartbeat 事件，保持连接活跃
- **超时**: SSE 连接最大持续 5 分钟，超时后自动断开
- **重连**: 前端自动重连最多 3 次，间隔 2 秒
- **LLM 超时**: LLM API 调用超时时间 120 秒

## 8. 待定事项

- [ ] LLM 分析提示词优化
- [ ] 本体更新逻辑（用户反馈后更新基因置信度）
- [ ] 分析结果导出功能
- [ ] 数据集版本管理

## 9. 实施计划

1. **Phase 1**: 数据集管理（上传 + 存储）
2. **Phase 2**: 工具轨差异分析（scipy.stats）
3. **Phase 3**: 大模型轨集成（千问 API）
4. **Phase 4**: SSE 进度推送
5. **Phase 5**: 结果对比展示
6. **Phase 6**: 用户反馈功能

---

## 10. 修订记录

| 版本 | 日期 | 修改内容 |
|------|------|----------|
| 1.1 | 2026-03-18 | 1. API路径 `/api/feedback` → `/api/feedbacks`<br>2. 添加数据集上传API<br>3. 添加分析参数 (pvalue_threshold, log2fc_threshold)<br>4. Feedback模型添加 created_by, gene_ids 字段<br>5. GeneInfo.expression_change 改为 Literal 类型<br>6. SSE消息增加 job_id 字段<br>7. 添加数据集 owner, file_size 字段<br>8. 添加SSE心跳机制和错误处理场景<br>9. 明确页面路由设计 |

---

*文档版本: 1.1*
*创建日期: 2026-03-18*
