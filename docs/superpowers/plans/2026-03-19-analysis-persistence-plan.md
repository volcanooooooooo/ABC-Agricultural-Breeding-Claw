# 分析结果与注释持久化实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 分析结果完整持久化，支持按基因ID查询历史分析记录及其注释

**Architecture:**
- 分析结果存储为 JSON 文件（`backend/data/analysis_results/{job_id}.json`）
- 反馈/注释复用现有 `feedback.json` 存储
- 新增 API 端点支持查询：`GET /api/analysis/results?gene_id=xxx`
- 前端 GeneDetailModal 新增"历史分析"Tab 展示历史记录

**Tech Stack:** Python (FastAPI), TypeScript (React), JSON file storage

---

## Chunk 1: 后端 - AnalysisService 修改（分析结果持久化）

**Files:**
- Modify: `backend/app/services/analysis_service.py`

- [ ] **Step 1: 添加 AnalysisService JSON 文件操作方法**

在 `analysis_service.py` 末尾添加：

```python
import os
from pathlib import Path

ANALYSIS_RESULTS_DIR = Path("backend/data/analysis_results")

class AnalysisService:
    # ... existing code ...

    def _ensure_results_dir(self):
        """确保结果目录存在"""
        ANALYSIS_RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    def save_result(self, job_id: str, result: AnalysisResult) -> None:
        """保存分析结果到 JSON 文件"""
        self._ensure_results_dir()
        file_path = ANALYSIS_RESULTS_DIR / f"{job_id}.json"

        # 原子写入：先写临时文件，再 rename
        temp_path = file_path.with_suffix('.tmp')
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(result.model_dump(), f, ensure_ascii=False, indent=2)
        temp_path.replace(file_path)

    def get_results(self, gene_id: Optional[str] = None) -> List[dict]:
        """获取分析结果列表，支持按基因筛选"""
        self._ensure_results_dir()

        if not gene_id:
            # 返回所有结果（按时间倒序）
            results = []
            for file_path in ANALYSIS_RESULTS_DIR.glob("job_*.json"):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        result = json.load(f)
                        results.append(result)
                except (json.JSONDecodeError, IOError):
                    continue
            return sorted(results, key=lambda x: x.get('created_at', ''), reverse=True)
        else:
            # 按基因筛选：需要关联 feedback 表
            from app.services.feedback_service import feedback_service
            feedbacks = feedback_service.get_by_gene(gene_id)
            analysis_ids = list(set(fb.analysis_id for fb in feedbacks))

            results = []
            for job_id in analysis_ids:
                file_path = ANALYSIS_RESULTS_DIR / f"{job_id}.json"
                if file_path.exists():
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            results.append(json.load(f))
                    except (json.JSONDecodeError, IOError):
                        continue
            return sorted(results, key=lambda x: x.get('created_at', ''), reverse=True)

    def get_result(self, job_id: str) -> Optional[dict]:
        """获取单个分析结果"""
        file_path = ANALYSIS_RESULTS_DIR / f"{job_id}.json"
        if not file_path.exists():
            return None
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None
```

- [ ] **Step 2: 验证代码语法**

Run: `cd /d/code/claude/breeding-scientist/backend && python -c "from app.services.analysis_service import analysis_service; print('OK')"`
Expected: `OK` (no errors)

- [ ] **Step 3: Commit**

```bash
cd /d/code/claude/breeding-scientist
git add backend/app/services/analysis_service.py
git commit -m "feat: add analysis result persistence to JSON files"
```

---

## Chunk 2: 后端 - FeedbackService 修改（按基因查询）

**Files:**
- Modify: `backend/app/services/feedback_service.py`

- [ ] **Step 1: 添加 get_by_gene 方法**

在 `FeedbackService` 类中添加：

```python
def get_by_gene(self, gene_id: str) -> List[Feedback]:
    """按基因 ID 获取反馈"""
    data = self._load_feedbacks()
    return [
        Feedback(**d) for d in data
        if d.get('gene_ids') and gene_id in d['gene_ids']
    ]
```

- [ ] **Step 2: 验证代码语法**

Run: `cd /d/code/claude/breeding-scientist/backend && python -c "from app.services.feedback_service import feedback_service; print('OK')"`
Expected: `OK` (no errors)

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/feedback_service.py
git commit -m "feat: add get_by_gene method to FeedbackService"
```

---

## Chunk 3: 后端 - AnalysisRouter 修改（新增端点 + SSE 保存）

**Files:**
- Modify: `backend/app/routers/analysis.py`

- [ ] **Step 1: 在 analysis_tasks 字典后添加新端点**

在 `stream_analysis` 函数之前（约第 256 行）添加：

```python
@router.get("/results")
async def get_analysis_results(gene_id: Optional[str] = None):
    """获取分析结果列表，支持按基因筛选"""
    results = analysis_service.get_results(gene_id)

    # 计算每个结果的反馈统计
    from app.services.feedback_service import feedback_service
    all_feedbacks = feedback_service.get_all()

    summary_results = []
    for result in results:
        job_id = result.get('id')
        job_feedbacks = [fb for fb in all_feedbacks if fb.analysis_id == job_id]

        positive_count = sum(1 for fb in job_feedbacks if fb.rating == 'positive')
        total_count = len(job_feedbacks)
        avg_rating = positive_count / total_count if total_count > 0 else 0.0

        summary_results.append({
            "id": result.get('id'),
            "dataset_id": result.get('dataset_id'),
            "dataset_name": result.get('dataset_name'),
            "created_at": result.get('created_at'),
            "feedback_count": total_count,
            "avg_rating": round(avg_rating, 2)
        })

    return summary_results


@router.get("/results/{job_id}")
async def get_analysis_result(job_id: str):
    """获取单个分析结果详情"""
    result = analysis_service.get_result(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis result not found")
    return result
```

- [ ] **Step 2: 修改 SSE stream_analysis 函数，在分析完成后保存结果**

找到约第 348 行，在构建 result 对象后、发送结果前添加保存逻辑：

```python
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

# === 新增：保存结果到 JSON 文件 ===
analysis_service.save_result(job_id, result)
# ===

# 步骤4: 完成 (90% -> 100%)
yield "data: {\"job_id\": \"%s\", \"status\": \"completed\", \"progress\": 95, \"currentStep\": \"完成\"}\n\n" % job_id
```

- [ ] **Step 3: 添加 Optional 导入（如果没有）**

确保文件顶部有 `from typing import Dict, List, Any, Optional` 或在 router 装饰器中使用

- [ ] **Step 4: 验证代码语法**

Run: `cd /d/code/claude/breeding-scientist/backend && python -c "from app.routers.analysis import router; print('OK')"`
Expected: `OK` (no errors)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/analysis.py
git commit -m "feat: add analysis results API endpoints and save on SSE completion"
```

---

## Chunk 4: 后端 - FeedbackRouter 修改（支持 gene_id 筛选）

**Files:**
- Modify: `backend/app/routers/feedback.py`

- [ ] **Step 1: 修改 get_feedbacks 端点支持 gene_id 筛选**

将 `get_feedbacks` 函数修改为：

```python
@router.get("", response_model=List[Feedback])
async def get_feedbacks(gene_id: Optional[str] = None):
    """获取反馈列表，支持按基因筛选"""
    if gene_id:
        return feedback_service.get_by_gene(gene_id)
    return feedback_service.get_all()
```

- [ ] **Step 2: 验证代码语法**

Run: `cd /d/code/claude/breeding-scientist/backend && python -c "from app.routers.feedback import router; print('OK')"`
Expected: `OK` (no errors)

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/feedback.py
git commit -m "feat: add gene_id filter to GET /feedbacks endpoint"
```

---

## Chunk 5: 前端 - API Client 修改

**Files:**
- Modify: `src/api/client.ts`

- [ ] **Step 1: 添加 AnalysisResultSummary 类型和 API 方法**

在 `AnalysisResult` 类型定义之后（约第 228 行）添加：

```typescript
export interface AnalysisResultSummary {
  id: string
  dataset_id: string
  dataset_name: string
  created_at: string
  feedback_count: number
  avg_rating: number
}
```

找到 `analysisApi` 对象（约第 159-172 行），修改为：

```typescript
export const analysisApi = {
  getDataSources: () =>
    api.get<ApiResponse<DataSource[]>>('/analysis/datasources'),
  runAnalysis: (data: { source_id: string; analysis_type: string; params?: any }) =>
    api.post<ApiResponse<AnalysisResult>>('/analysis/run', data),
  getResults: () =>
    api.get<ApiResponse<AnalysisResult[]>>('/analysis/results'),
  getResultById: (id: string) =>
    api.get<ApiResponse<AnalysisResult>>(`/analysis/results/${id}`),
  // 扩展方法 - 双轨分析
  compare: (data: CompareRequest) => api.post<ApiResponse<CompareResponse>>('/analysis/compare', data),
  getResult: (id: string) => api.get<ApiResponse<AnalysisResult>>(`/analysis/results/${id}`),
  // 新增：按基因获取分析结果列表
  getResultsByGene: (geneId: string) =>
    api.get<ApiResponse<AnalysisResultSummary[]>>('/analysis/results', { params: { gene_id: geneId } }),
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/client.ts
git commit -m "feat: add getResultsByGene API method and AnalysisResultSummary type"
```

---

## Chunk 6: 前端 - GeneDetailModal 修改（历史分析 Tab）

**Files:**
- Modify: `src/components/GeneDetailModal.tsx`

- [ ] **Step 1: 添加历史分析相关状态和导入**

在文件顶部添加导入：
```typescript
import { Spin, Empty, Card } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'
import { analysisApi, AnalysisResultSummary, AnalysisResult } from '../api/client'
```

在组件内部的状态定义处添加：
```typescript
const [historyAnalyses, setHistoryAnalyses] = useState<AnalysisResultSummary[]>([])
const [loadingHistory, setLoadingHistory] = useState(false)
const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
const [selectedHistoryResult, setSelectedHistoryResult] = useState<AnalysisResult | null>(null)
const [loadingHistoryDetail, setLoadingHistoryDetail] = useState(false)
```

- [ ] **Step 2: 添加获取历史分析的方法**

在 `fetchGeneFeedback` 方法之后添加：

```typescript
const fetchHistoryAnalyses = async (geneId: string) => {
  setLoadingHistory(true)
  try {
    const res = await analysisApi.getResultsByGene(geneId)
    setHistoryAnalyses(res.data?.data || [])
  } catch (e) {
    console.error('Failed to fetch history analyses:', e)
    setHistoryAnalyses([])
  } finally {
    setLoadingHistory(false)
  }
}

const handleViewHistoryDetail = async (jobId: string) => {
  setSelectedHistoryId(jobId)
  setLoadingHistoryDetail(true)
  try {
    const res = await analysisApi.getResult(jobId)
    setSelectedHistoryResult(res.data?.data || null)
  } catch (e) {
    console.error('Failed to fetch analysis detail:', e)
    setSelectedHistoryResult(null)
  } finally {
    setLoadingHistoryDetail(false)
  }
}
```

- [ ] **Step 3: 在 useEffect 中调用 fetchHistoryAnalyses**

修改现有的 useEffect（约第 124-130 行）：

```typescript
useEffect(() => {
  if (open && geneId) {
    fetchGeneFeedback(geneId)
    fetchHistoryAnalyses(geneId)  // 新增
  } else {
    setFeedbackWarnings([])
    setHistoryAnalyses([])
    setSelectedHistoryId(null)
    setSelectedHistoryResult(null)
  }
}, [open, geneId])
```

- [ ] **Step 4: 添加历史分析 Tab UI**

在 Modal 的 body 末尾（`</div>` 之前）添加：

```typescript
{/* 历史分析 Tab */}
{(historyAnalyses.length > 0 || loadingHistory) && (
  <div style={{ marginTop: 16 }}>
    <Divider style={{ margin: '12px 0' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <HistoryOutlined style={{ color: '#1890ff' }} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>历史分析</span>
      {loadingHistory && <Spin size="small" />}
    </div>

    {historyAnalyses.length === 0 && !loadingHistory ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史分析" />
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {historyAnalyses.map((analysis) => (
          <Card
            key={analysis.id}
            size="small"
            hoverable
            onClick={() => handleViewHistoryDetail(analysis.id)}
            style={{
              background: selectedHistoryId === analysis.id ? '#e6f7ff' : 'var(--color-bg-input)',
              border: selectedHistoryId === analysis.id ? '1px solid #1890ff' : '1px solid var(--color-border)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{analysis.dataset_name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {new Date(analysis.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: '#52c41a' }}>✓ {analysis.feedback_count}</span> 条反馈
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  评分: {analysis.avg_rating > 0 ? `${(analysis.avg_rating * 100).toFixed(0)}%` : '无'}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )}

    {/* 展开的历史分析详情 */}
    {selectedHistoryId && selectedHistoryResult && (
      <Card
        size="small"
        style={{ marginTop: 12, background: '#fafafa' }}
        title={<span style={{ fontSize: 12 }}>分析详情</span>}
      >
        <div style={{ fontSize: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>工具轨显著基因:</strong> {selectedHistoryResult.tool_result.significant_genes.length} 个
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>LLM轨显著基因:</strong> {selectedHistoryResult.llm_result.significant_genes.length} 个
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>一致性:</strong> 重叠 {(selectedHistoryResult.consistency.overlap || []).length} 个基因
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>工具轨推理:</strong>
            <div style={{ color: 'var(--color-text-muted)', marginTop: 4, whiteSpace: 'pre-wrap' }}>
              {selectedHistoryResult.llm_result.reasoning?.slice(0, 200)}
              {(selectedHistoryResult.llm_result.reasoning?.length || 0) > 200 ? '...' : ''}
            </div>
          </div>
        </div>
      </Card>
    )}
    {selectedHistoryId && loadingHistoryDetail && <Spin style={{ marginTop: 8 }} />}
  </div>
)}
```

- [ ] **Step 5: 修改 handleSubmitAnnotation 保存注释到后端**

将 `handleSubmitAnnotation` 函数修改为：

```typescript
const handleSubmitAnnotation = async () => {
  if (!annotation.trim()) return
  setSubmitting(true)
  try {
    await feedbackApi.create({
      analysis_id: result.id,
      track: 'tool',
      rating: 'positive',
      comment: annotation.trim(),
      gene_ids: [geneId]
    })
    message.success('注释已保存')
    setAnnotation('')
    // 刷新历史分析
    fetchHistoryAnalyses(geneId)
  } catch (e) {
    console.error('Failed to save annotation:', e)
    message.error('保存失败')
  } finally {
    setSubmitting(false)
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/GeneDetailModal.tsx
git commit -m "feat: add history analyses tab to GeneDetailModal"
```

---

## Chunk 7: 验证与测试

- [ ] **Step 1: 启动后端服务**

Run: `cd /d/code/claude/breeding-scientist/backend && uvicorn app.main:app --reload --port 8003`
Expected: 服务启动成功，无报错

- [ ] **Step 2: 测试 API 端点**

Open browser or use curl:
1. `GET http://localhost:8003/api/analysis/results` - 应返回空数组 `[]`
2. `GET http://localhost:8003/api/feedbacks` - 应返回反馈列表

- [ ] **Step 3: 启动前端服务**

Run: `cd /d/code/claude/breeding-scientist && npm run dev`
Expected: 前端启动成功

- [ ] **Step 4: 功能验证**

1. 在 ChatPage 进行一次双轨分析
2. 打开 GeneDetailModal 查看基因详情
3. 添加注释并提交
4. 刷新页面，重新打开 GeneDetailModal，验证历史分析和注释是否显示

---

## 验收标准

1. ✅ 分析完成后，结果保存到 `backend/data/analysis_results/{job_id}.json`
2. ✅ `GET /api/analysis/results?gene_id=xxx` 返回该基因的历史分析
3. ✅ `GET /api/analysis/results/{job_id}` 返回完整分析结果
4. ✅ `GET /api/feedbacks?gene_id=xxx` 返回该基因的注释
5. ✅ GeneDetailModal 显示历史分析列表和注释
6. ✅ 提交注释后，下次查询能看到新注释
