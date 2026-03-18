# 双轨差异分析系统实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现双轨差异分析系统，支持工具轨(scipy)和大模型轨(千问)并行分析，实时推送进度，展示对比结果，支持用户反馈

**Architecture:** 采用渐进式实现，先完成后端数据模型和API，再实现前端展示。SSE用于实时进度推送，JSON文件存储数据集和反馈

**Tech Stack:** 后端: FastAPI + scipy + 千问API; 前端: React + Ant Design + SSE

---

## 文件结构

```
backend/app/
├── models/
│   ├── __init__.py
│   ├── dataset.py          # 新增: 数据集模型
│   ├── analysis.py        # 修改: 扩展分析结果模型
│   └── feedback.py        # 新增: 反馈模型
├── services/
│   ├── dataset_service.py # 新增: 数据集服务
│   ├── feedback_service.py # 新增: 反馈服务
│   ├── analysis_service.py # 修改: 添加差异分析方法
│   └── llm_service.py     # 修改: 添加分析用LLM调用
├── routers/
│   ├── datasets.py        # 新增: 数据集路由
│   ├── feedback.py       # 新增: 反馈路由
│   ├── analysis.py       # 修改: 添加双轨分析接口
│   └── main.py           # 修改: 注册新路由
└── data/
    ├── datasets/          # 新增: 用户上传的数据集
    └── feedback.json     # 新增: 用户反馈存储

frontend/src/
├── api/
│   └── client.ts          # 修改: 添加数据集和分析API
├── components/
│   ├── DatasetSelector.tsx   # 新增
│   ├── FileUploader.tsx     # 新增
│   ├── ComparisonCard.tsx    # 新增
│   ├── ProgressPanel.tsx    # 新增
│   └── FeedbackPanel.tsx     # 新增
└── pages/
    └── AnalysisPage.tsx     # 修改: 重构为双轨分析页面
```

---

## Chunk 1: 数据集管理 - 后端

### 任务 1.1: 创建数据集模型

**Files:**
- Create: `backend/app/models/dataset.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: 创建 dataset.py 模型**

```python
# backend/app/models/dataset.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from typing_extensions import Literal

# 安全配置
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_FILE_TYPES = ['text/csv', 'application/vnd.ms-excel',
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']

class Dataset(BaseModel):
    id: str
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    data_type: str = "expression_matrix"
    file_path: str
    file_size: Optional[int] = Field(None, ge=0, le=MAX_FILE_SIZE)
    gene_count: int = Field(..., gt=0)
    sample_count: int = Field(..., ge=4)  # 至少4个样本
    groups: Dict[str, List[str]]
    owner: Optional[str] = None
    created_at: str
    updated_at: str


class DatasetUploadRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    group_control: str = Field(..., min_length=1)
    group_treatment: str = Field(..., min_length=1)
    control_samples: List[str] = Field(..., min_length=2)
    treatment_samples: List[str] = Field(..., min_length=2)
```

- [ ] **Step 2: 更新 __init__.py**

```python
# backend/app/models/__init__.py
from app.models.dataset import Dataset, DatasetUploadRequest
from app.models.analysis import (
    AnalysisResult, ToolResult, LLMResult, GeneInfo, ConsistencyInfo
)
from app.models.feedback import Feedback, FeedbackCreate
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/dataset.py backend/app/models/__init__.py
git commit -m "feat: add dataset models"
```

---

### 任务 1.2: 创建反馈模型

**Files:**
- Create: `backend/app/models/feedback.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: 创建 feedback.py 模型**

```python
# backend/app/models/feedback.py
from pydantic import BaseModel
from typing import Optional, List
from typing_extensions import Literal

class FeedbackCreate(BaseModel):
    analysis_id: str
    track: Literal["tool", "llm"]
    rating: Literal["positive", "negative"]
    comment: Optional[str] = None
    gene_ids: Optional[List[str]] = None
    created_by: Optional[str] = None


class Feedback(FeedbackCreate):
    id: str
    created_at: str
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/models/feedback.py backend/app/models/__init__.py
git commit -m "feat: add feedback models"
```

---

### 任务 1.3: 扩展分析结果模型

**Files:**
- Modify: `backend/app/models/analysis.py`

- [ ] **Step 1: 更新 analysis.py 添加新模型**

```python
# backend/app/models/analysis.py 新增内容
from typing import Optional, List, Dict, Any
from typing_extensions import Literal

class GeneInfo(BaseModel):
    gene_id: str
    expression_change: Literal["up", "down", "none"]
    log2fc: Optional[float] = None
    pvalue: Optional[float] = None
    reason: Optional[str] = None


class ToolResult(BaseModel):
    method: str = "ttest_scipy"
    significant_genes: List[GeneInfo]
    all_genes: List[GeneInfo]
    execution_time: float


class LLMResult(BaseModel):
    model: str
    significant_genes: List[GeneInfo]
    reasoning: str
    execution_time: float


class ConsistencyInfo(BaseModel):
    overlap: List[str]
    tool_only: List[str]
    llm_only: List[str]
    overlap_rate: float


class AnalysisResult(BaseModel):
    id: str
    dataset_id: str
    dataset_name: str
    tool_result: ToolResult
    llm_result: LLMResult
    consistency: ConsistencyInfo
    created_at: str


class CompareRequest(BaseModel):
    dataset_id: str
    group_control: str
    group_treatment: str
    pvalue_threshold: float = 0.05
    log2fc_threshold: float = 1.0


class CompareResponse(BaseModel):
    job_id: str
    status: str = "started"
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/models/analysis.py
git commit -m "feat: extend analysis models for dual-track"
```

---

### 任务 1.4: 创建数据集服务

**Files:**
- Create: `backend/app/services/dataset_service.py`

- [ ] **Step 1: 创建 dataset_service.py（包含安全检查）**

```python
# backend/app/services/dataset_service.py
import os
import re
import uuid
import json
from pathlib import Path
from typing import List, Optional
from datetime import datetime
import pandas as pd

from app.models.dataset import Dataset, DatasetUploadRequest, MAX_FILE_SIZE

DATA_DIR = Path("backend/data")
DATASETS_DIR = DATA_DIR / "datasets"
DATASETS_FILE = DATA_DIR / "datasets.json"


def validate_filename(filename: str) -> bool:
    """验证文件名安全，防止路径遍历攻击"""
    # 只允许字母、数字、下划线、连字符和点
    if not re.match(r'^[a-zA-Z0-9_\-\.]+$', filename):
        return False
    # 不允许 . 开头
    if filename.startswith('.'):
        return False
    return True


class DatasetService:
    def __init__(self):
        DATASETS_DIR.mkdir(parents=True, exist_ok=True)

    def _load_datasets(self) -> List[dict]:
        if DATASETS_FILE.exists():
            with open(DATASETS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("datasets", [])
        return []

    def _save_datasets(self, datasets: List[dict]):
        DATASETS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(DATASETS_FILE, "w", encoding="utf-8") as f:
            json.dump({"datasets": datasets}, f, ensure_ascii=False, indent=2)

    def get_all(self) -> List[Dataset]:
        data = self._load_datasets()
        return [Dataset(**d) for d in data]

    def get_by_id(self, dataset_id: str) -> Optional[Dataset]:
        datasets = self._load_datasets()
        for d in datasets:
            if d["id"] == dataset_id:
                return Dataset(**d)
        return None

    async def upload(
        self,
        request: DatasetUploadRequest,
        file_content: bytes
    ) -> Dataset:
        # 安全检查：文件大小
        if len(file_content) > MAX_FILE_SIZE:
            raise ValueError(f"File too large. Max size: {MAX_FILE_SIZE / (1024*1024)}MB")

        # 生成 ID
        dataset_id = f"ds_{uuid.uuid4().hex[:8]}"

        # 保存文件 - 使用安全的文件名
        file_ext = "csv"
        file_name = f"{dataset_id}.{file_ext}"

        # 安全检查：文件名
        if not validate_filename(file_name):
            raise ValueError("Invalid file name")

        file_path = DATASETS_DIR / file_name

        # 写入文件
        with open(file_path, "wb") as f:
            f.write(file_content)

        # 解析数据获取基因数和样本数
        df = pd.read_csv(file_path)
        gene_count = len(df)
        sample_count = len(df.columns) - 1  # 减去第一列(基因名)

        # 构建数据集对象
        now = datetime.utcnow().isoformat() + "Z"
        dataset = Dataset(
            id=dataset_id,
            name=request.name,
            description=request.description,
            data_type="expression_matrix",
            file_path=str(file_path),
            file_size=len(file_content),
            gene_count=gene_count,
            sample_count=sample_count,
            groups={
                request.group_control: request.control_samples,
                request.group_treatment: request.treatment_samples
            },
            created_at=now,
            updated_at=now
        )

        # 保存到索引
        datasets = self._load_datasets()
        datasets.append(dataset.model_dump())
        self._save_datasets(datasets)

        return dataset

    def delete(self, dataset_id: str) -> bool:
        datasets = self._load_datasets()
        dataset = None
        for d in datasets:
            if d["id"] == dataset_id:
                dataset = d
                break

        if not dataset:
            return False

        # 删除文件
        file_path = Path(dataset["file_path"])
        if file_path.exists():
            file_path.unlink()

        # 从索引中移除
        datasets = [d for d in datasets if d["id"] != dataset_id]
        self._save_datasets(datasets)

        return True


dataset_service = DatasetService()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/dataset_service.py
git commit -m "feat: add dataset service for upload and management"
```

---

### 任务 1.5: 创建数据集路由

**Files:**
- Create: `backend/app/routers/datasets.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: 创建 datasets.py 路由**

```python
# backend/app/routers/datasets.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import List

from app.models.dataset import Dataset, DatasetUploadRequest
from app.services.dataset_service import dataset_service

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("", response_model=List[Dataset])
async def get_datasets():
    """获取数据集列表"""
    return dataset_service.get_all()


@router.get("/{dataset_id}", response_model=Dataset)
async def get_dataset(dataset_id: str):
    """获取数据集详情"""
    dataset = dataset_service.get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.post("/upload", response_model=Dataset)
async def upload_dataset(
    name: str,
    description: str = None,
    group_control: str = "control",
    group_treatment: str = "treatment",
    control_samples: str = "",  # 逗号分隔
    treatment_samples: str = "",  # 逗号分隔
    file: UploadFile = File(...)
):
    """上传数据集"""
    # 安全检查：文件类型
    ALLOWED_CONTENT_TYPES = ['text/csv', 'application/vnd.ms-excel',
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            'application/octet-stream']  # 兼容某些客户端

    content_type = file.content_type or 'application/octet-stream'
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Unsupported file format")

    # 解析样本列表
    control_list = [s.strip() for s in control_samples.split(",") if s.strip()]
    treatment_list = [s.strip() for s in treatment_samples.split(",") if s.strip()]

    if len(control_list) < 2 or len(treatment_list) < 2:
        raise HTTPException(status_code=400, detail="Each group must have at least 2 samples")

    request = DatasetUploadRequest(
        name=name,
        description=description,
        group_control=group_control,
        group_treatment=group_treatment,
        control_samples=control_list,
        treatment_samples=treatment_list
    )

    # 读取文件内容
    file_content = await file.read()

    dataset = await dataset_service.upload(request, file_content)
    return dataset


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str):
    """删除数据集"""
    success = dataset_service.delete(dataset_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"message": "Dataset deleted"}
```

- [ ] **Step 2: 注册路由到 main.py**

```python
# backend/app/main.py 添加
from app.routers import chat, ontology, analysis, config, datasets  # 添加 datasets

app.include_router(datasets.router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/datasets.py backend/app/main.py
git commit -m "feat: add dataset routes"
```

---

## Chunk 2: 差异分析服务 - 后端

### 任务 2.1: 扩展 AnalysisService

**Files:**
- Modify: `backend/app/services/analysis_service.py`

- [ ] **Step 1: 添加差异分析方法到 analysis_service.py**

```python
# backend/app/services/analysis_service.py 新增内容

import asyncio
import time
import uuid
from typing import Dict, List, Optional
import pandas as pd
import numpy as np
from scipy import stats

async def run_tool_analysis(
    df: pd.DataFrame,
    control_samples: List[str],
    treatment_samples: List[str],
    pvalue_threshold: float = 0.05,
    log2fc_threshold: float = 1.0
) -> ToolResult:
    """工具轨分析 - 使用 t-test 进行差异检验"""
    start_time = time.time()

    results = []
    significant = []

    gene_col = df.columns[0]  # 第一列为基因名

    for _, row in df.iterrows():
        gene_id = str(row[gene_col])

        control_values = [row[s] for s in control_samples if s in df.columns]
        treatment_values = [row[s] for s in treatment_samples if s in df.columns]

        if len(control_values) < 2 or len(treatment_values) < 2:
            continue

        # 计算均值
        control_mean = np.mean(control_values)
        treatment_mean = np.mean(treatment_values)

        # 计算 log2FC
        if control_mean > 0 and treatment_mean > 0:
            log2fc = np.log2(treatment_mean / control_mean)
        else:
            log2fc = 0

        # t-test
        t_stat, pvalue = stats.ttest_ind(control_values, treatment_values)

        # 判断显著性
        if pvalue < pvalue_threshold and abs(log2fc) >= log2fc_threshold:
            expression_change = "up" if log2fc > 0 else "down"
            significant.append(GeneInfo(
                gene_id=gene_id,
                expression_change=expression_change,
                log2fc=float(log2fc),
                pvalue=float(pvalue)
            ))
            is_significant = True
        else:
            expression_change = "none"
            is_significant = False

        results.append(GeneInfo(
            gene_id=gene_id,
            expression_change=expression_change,
            log2fc=float(log2fc),
            pvalue=float(pvalue)
        ))

    execution_time = time.time() - start_time

    return ToolResult(
        method="ttest_scipy",
        significant_genes=significant,
        all_genes=results,
        execution_time=execution_time
    )


async def run_llm_analysis(
    df: pd.DataFrame,
    control_samples: List[str],
    treatment_samples: List[str],
    model: str = "qwen-turbo"
) -> LLMResult:
    """大模型轨分析 - 调用千问 API"""
    start_time = time.time()

    # 生成数据摘要
    gene_col = df.columns[0]
    summary_data = []

    for _, row in df.head(20).iterrows():  # 取前20个基因
        gene_id = str(row[gene_col])
        control_values = [row[s] for s in control_samples if s in df.columns]
        treatment_values = [row[s] for s in treatment_samples if s in df.columns]

        control_mean = np.mean(control_values) if control_values else 0
        treatment_mean = np.mean(treatment_values) if treatment_values else 0

        summary_data.append({
            "gene": gene_id,
            "control_mean": round(control_mean, 2),
            "treatment_mean": round(treatment_mean, 2)
        })

    # 构建提示词
    prompt = f"""你是一个基因表达差异分析专家。请分析以下基因表达数据，找出可能的上调基因和下调基因。

对照组样本: {', '.join(control_samples)}
处理组样本: {', '.join(treatment_samples)}

基因表达数据(前20个):
{chr(10).join([f"- {g['gene']}: 对照组均值={g['control_mean']}, 处理组均值={g['treatment_mean']}" for g in summary_data])}

请分析并返回:
1. 可能上调的基因(处理组明显高于对照组)
2. 可能下调的基因(处理组明显低于对照组)
3. 你的推理过程

请以JSON格式返回:
{{
  "upregulated_genes": ["gene1", "gene2"],
  "downregulated_genes": ["gene3"],
  "reasoning": "你的分析推理过程"
}}
"""

    # 调用 LLM
    from app.services.llm_service import llm_service

    llm_result = await llm_service.chat(
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500
    )

    execution_time = time.time() - start_time

    if "error" in llm_result:
        return LLMResult(
            model=model,
            significant_genes=[],
            reasoning=f"LLM调用失败: {llm_result.get('error')}",
            execution_time=execution_time
        )

    # 解析 LLM 返回结果
    content = llm_result.get("content", "")

    # 简单解析 JSON
    significant_genes = []
    try:
        import re
        # 尝试提取 JSON
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            import json
            result = json.loads(json_match.group())

            up_genes = result.get("upregulated_genes", [])
            down_genes = result.get("downregulated_genes", [])

            for g in up_genes:
                significant_genes.append(GeneInfo(
                    gene_id=g,
                    expression_change="up",
                    reason="LLM判断上调"
                ))
            for g in down_genes:
                significant_genes.append(GeneInfo(
                    gene_id=g,
                    expression_change="down",
                    reason="LLM判断下调"
                ))
    except Exception:
        pass

    return LLMResult(
        model=model,
        significant_genes=significant_genes,
        reasoning=content[:500],  # 截取
        execution_time=execution_time
    )


def calculate_consistency(
    tool_result: ToolResult,
    llm_result: LLMResult
) -> ConsistencyInfo:
    """计算一致性"""
    tool_genes = {g.gene_id for g in tool_result.significant_genes}
    llm_genes = {g.gene_id for g in llm_result.significant_genes}

    overlap = list(tool_genes & llm_genes)
    tool_only = list(tool_genes - llm_genes)
    llm_only = list(llm_genes - tool_genes)

    total = len(tool_genes)
    overlap_rate = len(overlap) / total if total > 0 else 0

    return ConsistencyInfo(
        overlap=overlap,
        tool_only=tool_only,
        llm_only=llm_only,
        overlap_rate=round(overlap_rate, 2)
    )
```

- [ ] **Step 2: 更新文件头部导入**

```python
# backend/app/services/analysis_service.py 头部
from app.models.analysis import (
    AnalysisResult, ToolResult, LLMResult, GeneInfo, ConsistencyInfo
)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/analysis_service.py
git commit -m "feat: add dual-track analysis methods"
```

---

## Chunk 3: SSE 进度推送和反馈服务

### 任务 3.1: 创建反馈服务

**Files:**
- Create: `backend/app/services/feedback_service.py`

- [ ] **Step 1: 创建 feedback_service.py**

```python
# backend/app/services/feedback_service.py
import json
import uuid
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from app.models.feedback import Feedback, FeedbackCreate

FEEDBACK_FILE = Path("backend/data/feedback.json")


class FeedbackService:
    def _load_feedbacks(self) -> List[dict]:
        if FEEDBACK_FILE.exists():
            with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("feedbacks", [])
        return []

    def _save_feedbacks(self, feedbacks: List[dict]):
        FEEDBACK_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
            json.dump({"feedbacks": feedbacks}, f, ensure_ascii=False, indent=2)

    def get_all(self) -> List[Feedback]:
        data = self._load_feedbacks()
        return [Feedback(**d) for d in data]

    def create(self, feedback: FeedbackCreate) -> Feedback:
        now = datetime.utcnow().isoformat() + "Z"

        new_feedback = Feedback(
            id=f"fb_{uuid.uuid4().hex[:8]}",
            analysis_id=feedback.analysis_id,
            track=feedback.track,
            rating=feedback.rating,
            comment=feedback.comment,
            gene_ids=feedback.gene_ids,
            created_by=feedback.created_by,
            created_at=now
        )

        feedbacks = self._load_feedbacks()
        feedbacks.append(new_feedback.model_dump())
        self._save_feedbacks(feedbacks)

        return new_feedback


feedback_service = FeedbackService()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/feedback_service.py
git commit -m "feat: add feedback service"
```

---

### 任务 3.2: 创建反馈路由

**Files:**
- Create: `backend/app/routers/feedback.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: 创建 feedback.py 路由**

```python
# backend/app/routers/feedback.py
from fastapi import APIRouter
from typing import List

from app.models.feedback import Feedback, FeedbackCreate
from app.services.feedback_service import feedback_service

router = APIRouter(prefix="/api/feedbacks", tags=["feedbacks"])


@router.get("", response_model=List[Feedback])
async def get_feedbacks():
    """获取反馈列表"""
    return feedback_service.get_all()


@router.post("", response_model=Feedback)
async def create_feedback(feedback: FeedbackCreate):
    """创建反馈"""
    return feedback_service.create(feedback)
```

- [ ] **Step 2: 注册路由到 main.py**

```python
# backend/app/main.py
from app.routers import chat, ontology, analysis, config, datasets, feedback

app.include_router(feedback.router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/feedback.py backend/app/main.py
git commit -m "feat: add feedback routes"
```

---

### 任务 3.3: 添加双轨分析 API 和 SSE

**Files:**
- Modify: `backend/app/routers/analysis.py`

- [ ] **Step 1: 更新 analysis.py 添加新接口**

```python
# backend/app/routers/analysis.py 新增内容

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import asyncio
import json
import uuid
import pandas as pd
from typing import Dict

from app.models.analysis import (
    CompareRequest, CompareResponse, AnalysisResult
)
from app.services.dataset_service import dataset_service
from app.services.analysis_service import (
    run_tool_analysis, run_llm_analysis, calculate_consistency
)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

# 存储正在进行的任务（带超时清理）
analysis_tasks: Dict[str, CompareRequest] = {}


async def cleanup_task(job_id: str):
    """清理超时任务"""
    if job_id in analysis_tasks:
        del analysis_tasks[job_id]


def schedule_cleanup(job_id: str, delay: int = 3600):
    """安排任务清理（1小时后）"""
    import asyncio
    try:
        loop = asyncio.get_running_loop()
        loop.call_later(delay, lambda: asyncio.create_task(cleanup_task(job_id)))
    except Exception:
        pass


@router.post("/compare", response_model=CompareResponse)
async def start_comparison(request: CompareRequest):
    """发起双轨对比分析"""
    # 验证数据集存在
    dataset = dataset_service.get_by_id(request.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # 验证分组存在
    if request.group_control not in dataset.groups:
        raise HTTPException(status_code=400, detail=f"Group '{request.group_control}' not found")
    if request.group_treatment not in dataset.groups:
        raise HTTPException(status_code=400, detail=f"Group '{request.group_treatment}' not found")

    # 创建任务 ID
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    analysis_tasks[job_id] = request

    # 安排任务清理（1小时后自动删除）
    schedule_cleanup(job_id)

    return CompareResponse(job_id=job_id, status="started")


@router.get("/stream/{job_id}")
async def stream_analysis(job_id: str):
    """SSE 流式接收分析进度和结果"""
    if job_id not in analysis_tasks:
        raise HTTPException(status_code=404, detail="Job not found")

    request = analysis_tasks[job_id]

    async def event_generator():
        # 获取数据集
        dataset = dataset_service.get_by_id(request.dataset_id)
        control_samples = dataset.groups[request.group_control]
        treatment_samples = dataset.groups[request.group_treatment]

        # 读取数据
        df = pd.read_csv(dataset.file_path)

        try:
            # 发送开始消息
            yield "data: {\"job_id\": \"%s\", \"status\": \"started\", \"progress\": 0}\n\n" % job_id

            # 并行执行双轨分析
            tool_task = run_tool_analysis(
                df, control_samples, treatment_samples,
                request.pvalue_threshold, request.log2fc_threshold
            )
            llm_task = run_llm_analysis(
                df, control_samples, treatment_samples
            )

            # 工具轨进度
            yield "data: {\"job_id\": \"%s\", \"track\": \"tool\", \"status\": \"正在进行t检验分析...\", \"progress\": 30}\n\n" % job_id

            # 等待结果
            tool_result, llm_result = await asyncio.gather(tool_task, llm_task)

            yield "data: {\"job_id\": \"%s\", \"track\": \"tool\", \"status\": \"工具轨分析完成\", \"progress\": 60}\n\n" % job_id
            yield "data: {\"job_id\": \"%s\", \"track\": \"llm\", \"status\": \"大模型分析完成\", \"progress\": 90}\n\n" % job_id

            # 计算一致性
            consistency = calculate_consistency(tool_result, llm_result)

            # 构建结果
            result = AnalysisResult(
                id=job_id,
                dataset_id=dataset.id,
                dataset_name=dataset.name,
                tool_result=tool_result,
                llm_result=llm_result,
                consistency=consistency,
                created_at=datetime.utcnow().isoformat() + "Z"
            )

            # 发送结果
            yield "data: {\"job_id\": \"%s\", \"status\": \"completed\", \"progress\": 100}\n\n" % job_id
            yield "data: {\"job_id\": \"%s\", \"result\": %s}\n\n" % (
                job_id,
                json.dumps(result.model_dump(), ensure_ascii=False)
            )

        except Exception as e:
            yield "data: {\"job_id\": \"%s\", \"status\": \"error\", \"message\": \"%s\"}\n\n" % (
                job_id,
                str(e).replace('"', '\\"')
            )
        finally:
            # 清理任务
            if job_id in analysis_tasks:
                del analysis_tasks[job_id]

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

- [ ] **Step 2: 添加 datetime 导入**

```python
from datetime import datetime
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/analysis.py
git commit -m "feat: add dual-track analysis SSE endpoint"
```

---

## Chunk 4: 前端 - API 客户端

### 任务 4.1: 更新前端 API 客户端

**Files:**
- Modify: `src/api/client.ts`

- [ ] **Step 1: 添加新的类型定义和 API 方法**

```typescript
// src/api/client.ts 新增内容

// Dataset types
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  data_type: string;
  file_path: string;
  file_size?: number;
  gene_count: number;
  sample_count: number;
  groups: Record<string, string[]>;
  owner?: string;
  created_at: string;
  updated_at: string;
}

// Analysis types
export interface GeneInfo {
  gene_id: string;
  expression_change: 'up' | 'down' | 'none';
  log2fc?: number;
  pvalue?: number;
  reason?: string;
}

export interface ToolResult {
  method: string;
  significant_genes: GeneInfo[];
  all_genes: GeneInfo[];
  execution_time: number;
}

export interface LLMResult {
  model: string;
  significant_genes: GeneInfo[];
  reasoning: string;
  execution_time: number;
}

export interface ConsistencyInfo {
  overlap: string[];
  tool_only: string[];
  llm_only: string[];
  overlap_rate: number;
}

export interface AnalysisResult {
  id: string;
  dataset_id: string;
  dataset_name: string;
  tool_result: ToolResult;
  llm_result: LLMResult;
  consistency: ConsistencyInfo;
  created_at: string;
}

export interface CompareRequest {
  dataset_id: string;
  group_control: string;
  group_treatment: string;
  pvalue_threshold?: number;
  log2fc_threshold?: number;
}

export interface CompareResponse {
  job_id: string;
  status: string;
}

// Feedback types
export interface Feedback {
  id: string;
  analysis_id: string;
  track: 'tool' | 'llm';
  rating: 'positive' | 'negative';
  comment?: string;
  gene_ids?: string[];
  created_by?: string;
  created_at: string;
}

// Dataset API
export const datasetApi = {
  getAll: () => api.get<ApiResponse<Dataset[]>>('/datasets'),
  getById: (id: string) => api.get<ApiResponse<Dataset>>(`/datasets/${id}`),
  upload: (formData: FormData) => api.post<ApiResponse<Dataset>>('/datasets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/datasets/${id}`),
};

// Analysis API
export const analysisApi = {
  compare: (data: CompareRequest) => api.post<ApiResponse<CompareResponse>>('/analysis/compare', data),
  getResult: (id: string) => api.get<ApiResponse<AnalysisResult>>(`/analysis/results/${id}`),
};

// Feedback API
export const feedbackApi = {
  getAll: () => api.get<ApiResponse<Feedback[]>>('/feedbacks'),
  create: (data: Omit<Feedback, 'id' | 'created_at'>) => api.post<ApiResponse<Feedback>>('/feedbacks', data),
};
```

- [ ] **Step 2: Commit**

```bash
git add src/api/client.ts
git commit -m "feat: add dataset and analysis API client"
```

---

## Chunk 5: 前端 - 分析页面组件

### 任务 5.1: 创建分析页面组件

**Files:**
- Create: `src/components/DatasetSelector.tsx`
- Create: `src/components/FileUploader.tsx`
- Create: `src/components/ProgressPanel.tsx`
- Create: `src/components/ComparisonCard.tsx`
- Create: `src/components/FeedbackPanel.tsx`
- Modify: `src/pages/AnalysisPage.tsx`

- [ ] **Step 1: 创建 DatasetSelector.tsx**

```tsx
// src/components/DatasetSelector.tsx
import { Select, Card, Empty } from 'antd';
import { Dataset } from '../api/client';

interface DatasetSelectorProps {
  datasets: Dataset[];
  selectedId?: string;
  onSelect: (id: string) => void;
  loading?: boolean;
}

export function DatasetSelector({ datasets, selectedId, onSelect, loading }: DatasetSelectorProps) {
  if (!datasets.length) {
    return (
      <Empty
        description="暂无数据集，请先上传"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <Select
      style={{ width: '100%' }}
      placeholder="选择数据集"
      value={selectedId}
      onChange={onSelect}
      loading={loading}
      optionLabelProp="name"
    >
      {datasets.map((ds) => (
        <Select.Option key={ds.id} value={ds.id} name={ds.name}>
          <Card size="small" style={{ margin: 0, background: 'transparent' }}>
            <div style={{ fontWeight: 500 }}>{ds.name}</div>
            <div style={{ fontSize: 12, color: '#888' }}>
              基因: {ds.gene_count} | 样本: {ds.sample_count}
            </div>
          </Card>
        </Select.Option>
      ))}
    </Select>
  );
}
```

- [ ] **Step 2: 创建 FileUploader.tsx**

```tsx
// src/components/FileUploader.tsx
import { Upload, Button, message, Form, Input, Row, Col, Card } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { datasetApi } from '../api/client';

interface FileUploaderProps {
  onUploadSuccess: () => void;
}

export function FileUploader({ onUploadSuccess }: FileUploaderProps) {
  const [form] = Form.useForm();

  const handleUpload = async (values: any) => {
    const { file, name, description, groupControl, groupTreatment, controlSamples, treatmentSamples } = values;

    if (!file || !file.fileList[0]) {
      message.error('请选择文件');
      return;
    }

    const formData = new FormData();
    formData.append('file', file.fileList[0].originFileObj);
    formData.append('name', name);
    formData.append('description', description || '');
    formData.append('group_control', groupControl || 'control');
    formData.append('group_treatment', groupTreatment || 'treatment');
    formData.append('control_samples', controlSamples);
    formData.append('treatment_samples', treatmentSamples);

    try {
      await datasetApi.upload(formData);
      message.success('上传成功');
      form.resetFields();
      onUploadSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '上传失败');
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={handleUpload}>
      <Form.Item name="name" label="数据集名称" rules={[{ required: true }]}>
        <Input placeholder="例如: 3月6日表达数据" />
      </Form.Item>

      <Form.Item name="description" label="描述">
        <Input.TextArea rows={2} placeholder="可选描述" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="groupControl" label="对照组名称" initialValue="control">
            <Input />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="groupTreatment" label="处理组名称" initialValue="treatment">
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="controlSamples"
            label="对照组样本(逗号分隔)"
            rules={[{ required: true }]}
            initialValue="sample1,sample2,sample3"
          >
            <Input placeholder="sample1,sample2,sample3" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="treatmentSamples"
            label="处理组样本(逗号分隔)"
            rules={[{ required: true }]}
            initialValue="sample4,sample5,sample6"
          >
            <Input placeholder="sample4,sample5,sample6" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="file" rules={[{ required: true }]} label="表达矩阵文件">
        <Upload.Dragger maxCount={1} accept=".csv,.xlsx,.xls">
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域</p>
          <p className="ant-upload-hint">支持 CSV、Excel 格式</p>
        </Upload.Dragger>
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit">
          上传数据集
        </Button>
      </Form.Item>
    </Form>
  );
}
```

- [ ] **Step 3: 创建 ProgressPanel.tsx**

```tsx
// src/components/ProgressPanel.tsx
import { Progress, Card, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface ProgressData {
  job_id: string;
  track?: 'tool' | 'llm';
  status: string;
  progress: number;
}

interface ProgressPanelProps {
  progress: ProgressData | null;
  isAnalyzing: boolean;
}

export function ProgressPanel({ progress, isAnalyzing }: ProgressPanelProps) {
  if (!isAnalyzing && !progress) {
    return null;
  }

  const toolProgress = progress?.track === 'tool' ? progress.progress : 0;
  const llmProgress = progress?.track === 'llm' ? progress.progress : (isAnalyzing ? 50 : 100);

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <LoadingOutlined spin style={{ marginRight: 8 }} />
        {progress?.status || '准备分析...'}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>工具轨</div>
          <Progress percent={toolProgress} status={toolProgress >= 100 ? 'success' : 'active'} size="small" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>大模型轨</div>
          <Progress percent={llmProgress} status={llmProgress >= 100 ? 'success' : 'active'} size="small" />
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: 创建 ComparisonCard.tsx**

```tsx
// src/components/ComparisonCard.tsx
import { Card, Row, Col, Tag, Table } from 'antd';
import { AnalysisResult, GeneInfo } from '../api/client';

interface ComparisonCardProps {
  result: AnalysisResult;
}

export function ComparisonCard({ result }: ComparisonCardProps) {
  const toolColumns = [
    { title: '基因', dataIndex: 'gene_id', key: 'gene_id' },
    {
      title: '变化',
      dataIndex: 'expression_change',
      key: 'expression_change',
      render: (val: string) => (
        <Tag color={val === 'up' ? 'red' : val === 'down' ? 'blue' : 'default'}>
          {val === 'up' ? '上调' : val === 'down' ? '下调' : '无变化'}
        </Tag>
      )
    },
    { title: 'log2FC', dataIndex: 'log2fc', key: 'log2fc', render: (v: number) => v?.toFixed(2) },
    { title: 'p值', dataIndex: 'pvalue', key: 'pvalue', render: (v: number) => v?.toFixed(4) },
  ];

  return (
    <Card title={`双轨分析结果 - ${result.dataset_name}`} style={{ marginTop: 16 }}>
      <Row gutter={16}>
        <Col span={12}>
          <Card size="small" title="工具轨 (scipy)" style={{ background: '#f5f5f5' }}>
            <div style={{ marginBottom: 8 }}>
              <Tag color="green">显著基因: {result.tool_result.significant_genes.length}</Tag>
              <span style={{ fontSize: 12, color: '#666' }}>
                耗时: {result.tool_result.execution_time.toFixed(2)}s
              </span>
            </div>
            <Table
              size="small"
              dataSource={result.tool_result.significant_genes}
              columns={toolColumns}
              rowKey="gene_id"
              pagination={false}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="大模型轨 (千问)" style={{ background: '#f0f5ff' }}>
            <div style={{ marginBottom: 8 }}>
              <Tag color="blue">显著基因: {result.llm_result.significant_genes.length}</Tag>
              <span style={{ fontSize: 12, color: '#666' }}>
                耗时: {result.llm_result.execution_time.toFixed(2)}s
              </span>
            </div>
            <div style={{ marginBottom: 8, fontSize: 12 }}>
              {result.llm_result.reasoning.substring(0, 200)}...
            </div>
            {result.llm_result.significant_genes.map((g: GeneInfo) => (
              <Tag key={g.gene_id} color={g.expression_change === 'up' ? 'red' : 'blue'}>
                {g.gene_id} ({g.expression_change === 'up' ? '上调' : '下调'})
              </Tag>
            ))}
          </Card>
        </Col>
      </Row>

      <Card size="small" title="一致性分析" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Tag color="green">共同检出: {result.consistency.overlap.length}</Tag>
            <div>{result.consistency.overlap.join(', ') || '-'}</div>
          </Col>
          <Col span={8}>
            <Tag color="orange">仅工具轨: {result.consistency.tool_only.length}</Tag>
            <div>{result.consistency.tool_only.join(', ') || '-'}</div>
          </Col>
          <Col span={8}>
            <Tag color="blue">仅LLM: {result.consistency.llm_only.length}</Tag>
            <div>{result.consistency.llm_only.join(', ') || '-'}</div>
          </Col>
        </Row>
        <div style={{ marginTop: 8 }}>
          <strong>重合率: {(result.consistency.overlap_rate * 100).toFixed(0)}%</strong>
        </div>
      </Card>
    </Card>
  );
}
```

- [ ] **Step 5: 创建 FeedbackPanel.tsx**

```tsx
// src/components/FeedbackPanel.tsx
import { Card, Button, Input, message } from 'antd';
import { ThumbUpOutlined, ThumbDownOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { feedbackApi } from '../api/client';

interface FeedbackPanelProps {
  analysisId: string;
  track: 'tool' | 'llm';
}

export function FeedbackPanel({ analysisId, track }: FeedbackPanelProps) {
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating) {
      message.warning('请先选择评价');
      return;
    }

    setSubmitting(true);
    try {
      await feedbackApi.create({
        analysis_id: analysisId,
        track,
        rating,
        comment: comment || undefined,
      });
      message.success('反馈已提交');
      setRating(null);
      setComment('');
    } catch (error) {
      message.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card size="small" title="评价此结果" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button
          type={rating === 'positive' ? 'primary' : 'default'}
          icon={<ThumbUpOutlined />}
          onClick={() => setRating('positive')}
          style={{ background: rating === 'positive' ? '#52c41a' : undefined }}
        >
          点赞
        </Button>
        <Button
          type={rating === 'negative' ? 'primary' : 'default'}
          icon={<ThumbDownOutlined />}
          onClick={() => setRating('negative')}
          danger={rating === 'negative'}
        >
          点踩
        </Button>
      </div>
      <Input.TextArea
        rows={2}
        placeholder="添加评论（可选）"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <Button type="primary" onClick={handleSubmit} loading={submitting}>
        提交反馈
      </Button>
    </Card>
  );
}
```

- [ ] **Step 6: 重构 AnalysisPage.tsx**

```tsx
// src/pages/AnalysisPage.tsx 完整重构

import { useState, useEffect, useRef } from 'react';
import { Card, Tabs, Button, Form, Select, message } from 'antd';
import { UploadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { datasetApi, analysisApi, Dataset, AnalysisResult, CompareRequest } from '../api/client';
import { DatasetSelector } from '../components/DatasetSelector';
import { FileUploader } from '../components/FileUploader';
import { ProgressPanel } from '../components/ProgressPanel';
import { ComparisonCard } from '../components/ComparisonCard';
import { FeedbackPanel } from '../components/FeedbackPanel';

export default function AnalysisPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>();
  const [groupControl, setGroupControl] = useState('control');
  const [groupTreatment, setGroupTreatment] = useState('treatment');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 加载数据集
  const loadDatasets = async () => {
    try {
      const res = await datasetApi.getAll();
      setDatasets(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadDatasets();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // 开始分析
  const handleAnalyze = async () => {
    if (!selectedDataset) {
      message.warning('请选择数据集');
      return;
    }

    setIsAnalyzing(true);
    setProgress(null);
    setResult(null);

    try {
      // 发起分析请求
      const compareReq: CompareRequest = {
        dataset_id: selectedDataset,
        group_control: groupControl,
        group_treatment: groupTreatment,
      };

      const res = await analysisApi.compare(compareReq);
      const { job_id } = res.data.data;

      // 建立 SSE 连接
      const eventSource = new EventSource(`/api/analysis/stream/${job_id}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.result) {
          setResult(data.result);
          setIsAnalyzing(false);
          eventSource.close();
        } else if (data.status === 'error') {
          message.error(data.message || '分析失败');
          setIsAnalyzing(false);
          eventSource.close();
        } else {
          setProgress(data);
        }
      };

      eventSource.onerror = () => {
        message.error('连接中断');
        setIsAnalyzing(false);
        eventSource.close();
      };

    } catch (error: any) {
      message.error(error.response?.data?.detail || '发起分析失败');
      setIsAnalyzing(false);
    }
  };

  const tabItems = [
    {
      key: '1',
      label: (
        <span>
          <UploadOutlined /> 数据集管理
        </span>
      ),
      children: (
        <Card>
          <FileUploader onUploadSuccess={loadDatasets} />
          <div style={{ marginTop: 24 }}>
            <h4>已有数据集</h4>
            <DatasetSelector
              datasets={datasets}
              selectedId={selectedDataset}
              onSelect={setSelectedDataset}
              loading={loading}
            />
          </div>
        </Card>
      ),
    },
    {
      key: '2',
      label: (
        <span>
          <PlayCircleOutlined /> 双轨分析
        </span>
      ),
      children: (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <Form layout="inline">
              <Form.Item label="数据集">
                <Select
                  style={{ width: 200 }}
                  value={selectedDataset}
                  onChange={setSelectedDataset}
                  placeholder="选择数据集"
                >
                  {datasets.map(ds => (
                    <Select.Option key={ds.id} value={ds.id}>{ds.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="对照组">
                <Select
                  style={{ width: 120 }}
                  value={groupControl}
                  onChange={setGroupControl}
                >
                  <Select.Option value="control">control</Select.Option>
                  <Select.Option value="treatment">treatment</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="处理组">
                <Select
                  style={{ width: 120 }}
                  value={groupTreatment}
                  onChange={setGroupTreatment}
                >
                  <Select.Option value="control">control</Select.Option>
                  <Select.Option value="treatment">treatment</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleAnalyze}
                  loading={isAnalyzing}
                  style={{ background: 'var(--gradient-accent)' }}
                >
                  开始分析
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <ProgressPanel progress={progress} isAnalyzing={isAnalyzing} />

          {result && (
            <>
              <ComparisonCard result={result} />
              <Card title="反馈" style={{ marginTop: 16 }}>
                <Tabs
                  items={[
                    { key: 'tool', label: '工具轨反馈', children: <FeedbackPanel analysisId={result.id} track="tool" /> },
                    { key: 'llm', label: '大模型轨反馈', children: <FeedbackPanel analysisId={result.id} track="llm" /> },
                  ]}
                />
              </Card>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: '1px solid var(--color-border)',
      }}>
        <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>
          双轨差异分析
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
          对比传统工具与大模型的分析结果
        </p>
      </div>

      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/DatasetSelector.tsx src/components/FileUploader.tsx src/components/ProgressPanel.tsx src/components/ComparisonCard.tsx src/components/FeedbackPanel.tsx src/pages/AnalysisPage.tsx
git commit -m "feat: add dual-track analysis page components"
```

---

## Chunk 6: 测试和验证

### 任务 6.1: 测试后端 API

- [ ] **Step 1: 启动后端服务**

```bash
cd backend && python -m uvicorn app.main:app --reload --port 8003
```

- [ ] **Step 2: 测试数据集上传**

```bash
# 创建测试数据 CSV
echo "gene,sample1,sample2,sample3,sample4,sample5,sample6
Gene1,100,110,105,200,210,195
Gene2,50,55,52,48,45,50
Gene3,80,85,82,150,155,148
Gene4,200,205,198,180,175,182
Gene5,30,32,28,25,28,30" > test_data.csv

# 上传测试
curl -X POST "http://localhost:8003/api/datasets/upload" \
  -F "name=测试数据集" \
  -F "description=测试" \
  -F "group_control=control" \
  -F "group_treatment=treatment" \
  -F "control_samples=sample1,sample2,sample3" \
  -F "treatment_samples=sample4,sample5,sample6" \
  -F "file=@test_data.csv"
```

- [ ] **Step 3: 测试分析接口**

```bash
# 发起分析
curl -X POST "http://localhost:8003/api/analysis/compare" \
  -H "Content-Type: application/json" \
  -d '{"dataset_id": "ds_xxx", "group_control": "control", "group_treatment": "treatment"}'
```

- [ ] **Step 4: 测试 SSE**

```bash
# 使用 job_id 订阅进度
curl -N "http://localhost:8003/api/analysis/stream/job_xxx"
```

---

### 任务 6.2: 测试前端

- [ ] **Step 1: 启动前端服务**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: 访问页面**

打开浏览器访问 http://localhost:3003/analysis

测试流程:
1. 上传测试数据集
2. 选择数据集
3. 点击"开始分析"
4. 观察进度条
5. 查看对比结果
6. 提交反馈

---

## 安全修复说明

本计划已根据代码审查意见添加以下安全修复：

### 已修复的安全问题

1. **文件上传安全**
   - 添加文件大小限制 (MAX_FILE_SIZE = 100MB)
   - 添加文件类型检查
   - 添加文件名安全验证（防止路径遍历攻击）

2. **任务内存管理**
   - 添加任务超时自动清理机制（1小时后删除）

3. **数据验证**
   - Dataset 模型添加 Pydantic Field 验证
   - 基因数必须 > 0
   - 样本数必须 >= 4

---

## 实施完成

**Plan complete and saved to `docs/superpowers/plans/2026-03-18-dual-track-analysis.md`. Ready to execute?**

按照以下顺序执行:
1. Chunk 1: 数据集管理 - 后端
2. Chunk 2: 差异分析服务 - 后端
3. Chunk 3: SSE 进度推送和反馈服务
4. Chunk 4: 前端 - API 客户端
5. Chunk 5: 前端 - 分析页面组件
6. Chunk 6: 测试和验证
