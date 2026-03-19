# 分析结果与注释持久化设计方案

## 1. 背景与目标

### 现状
- 分析结果仅存在于内存中，通过 SSE 流返回前端后未持久化
- 反馈/注释已通过 feedback.json 和 SQLite feedback_hints 表实现持久化
- GeneDetailModal 可以获取 feedback 但没有历史分析记录的完整数据

### 目标
- 分析结果完整持久化（tool_result, llm_result, consistency）
- 分析反馈注释 + 基因详情注释统一存储
- 基因详情弹窗中按基因 ID 关联查询历史分析及其注释

## 2. 架构设计

### 存储策略
| 数据类型 | 存储方式 | 文件/表 | 说明 |
|---------|---------|---------|------|
| 分析结果 | JSON 文件 | `backend/data/analysis_results/{job_id}.json` | 完整分析数据 |
| 分析反馈注释 | JSON 文件 | `backend/data/feedback.json` | 权威存储，包含完整 feedback 记录 |
| 基因详情注释 | JSON 文件 | `backend/data/feedback.json` | 复用 feedback 存储结构 |
| Feedback 关键词索引 | SQLite | `feedback_hints` 表 | 辅助表，用于关键词快速检索，非权威数据 |

### 核心逻辑
1. **分析完成时**：SSE 流返回结果后，后端保存完整结果到 JSON 文件
2. **反馈提交时**：用户对分析结果或基因添加注释，写入 feedback.json
3. **查询历史时**：通过 gene_ids 关联查询 feedback，再获取对应分析结果

## 3. 数据模型

### 分析结果 JSON 结构
```json
{
  "id": "job_xxx",
  "dataset_id": "ds_xxx",
  "dataset_name": "水稻数据集",
  "group_control": "WT",
  "group_treatment": "Mutant",
  "tool_result": {
    "statistics": {...},
    "significant_genes": [...]
  },
  "llm_result": {
    "analysis": "...",
    "conclusions": [...],
    "recommendations": [...]
  },
  "consistency": {
    "overlap_count": 10,
    "tool_only_count": 5,
    "llm_only_count": 8,
    "overlap_genes": ["gene1", "gene2"]
  },
  "created_at": "2026-03-19T10:00:00Z"
}
```

### Feedback 扩展（已有字段复用）
```json
{
  "analysis_id": "job_xxx",
  "track": "tool",        // "tool" | "llm"
  "rating": "positive",   // "positive" | "negative"
  "comment": "这个分析结果很准确",
  "gene_ids": ["gene1", "gene2"],  // 关联的基因
  "created_by": null,      // 预留字段，当前为 null（匿名反馈）
  "id": "fb_xxx",
  "created_at": "2026-03-19T10:30:00Z"
}
```

**字段说明：**
- `rating`: positive=1.0, negative=0.0，用于计算 avg_rating
- `created_by`: 当前固定为 null，表示匿名反馈（后续可扩展用户认证）
- `gene_ids`: 关联的基因 ID 列表，用于按基因查询历史分析

**avg_rating 计算方式：**
```python
# positive = 1.0, negative = 0.0
avg_rating = sum(rating_values) / len(rating_values)
```

## 4. API 设计

### 新增端点

#### GET /api/analysis/results
查询分析结果列表

**Query Parameters:**
- `gene_id` (optional): 按基因 ID 筛选

**Response:**
```json
{
  "results": [
    {
      "id": "job_xxx",
      "dataset_id": "ds_xxx",
      "dataset_name": "水稻数据集",
      "created_at": "2026-03-19T10:00:00Z",
      "feedback_count": 2,
      "avg_rating": 0.8
    }
  ]
}
```

#### GET /api/analysis/results/{job_id}
获取单个分析结果详情

**Response:**
```json
{
  "id": "job_xxx",
  "dataset_id": "ds_xxx",
  "dataset_name": "水稻数据集",
  "group_control": "WT",
  "group_treatment": "Mutant",
  "tool_result": {...},
  "llm_result": {...},
  "consistency": {...},
  "created_at": "2026-03-19T10:00:00Z"
}
```

### 修改端点

#### POST /api/feedbacks
创建反馈/注释（已存在，扩展 gene_ids 支持）

**Request:**
```json
{
  "analysis_id": "job_xxx",
  "track": "tool",
  "rating": "positive",
  "comment": "分析准确",
  "gene_ids": ["gene1", "gene2"]
}
```

#### GET /api/feedbacks
获取反馈列表

**Query Parameters:**
- `gene_id` (optional): 按基因 ID 筛选

## 5. 后端修改

### 5.1 AnalysisService 新增方法
```python
# services/analysis_service.py
class AnalysisService:
    def save_result(self, job_id: str, result: AnalysisResult) -> None:
        """保存分析结果到 JSON 文件"""

    def get_results(self, gene_id: Optional[str] = None) -> List[dict]:
        """获取分析结果列表，按基因筛选"""

    def get_result(self, job_id: str) -> Optional[dict]:
        """获取单个分析结果"""
```

### 5.2 FeedbackService 修改
```python
# services/feedback_service.py
class FeedbackService:
    def get_by_gene(self, gene_id: str) -> List[Feedback]:
        """按基因 ID 获取反馈"""

    def create(self, feedback: FeedbackCreate) -> Feedback:
        """创建反馈（已有，gene_ids 已支持）"""
```

### 5.3 Router 修改
```python
# routers/analysis.py
@router.get("/results")
async def get_analysis_results(gene_id: Optional[str] = None):
    """获取分析结果列表"""

@router.get("/results/{job_id}")
async def get_analysis_result(job_id: str):
    """获取单个分析结果详情"""

# routers/analysis.py (修改现有 SSE 结束逻辑)
async def stream_analysis(job_id: str):
    # 分析完成后保存结果
    analysis_service.save_result(job_id, result)
```

## 6. 前端修改

### 6.1 GeneDetailModal.tsx
- 新增 API 调用：`analysisApi.getResults(geneId)` 和 `analysisApi.getResult(jobId)`
- 在"历史分析"Tab 页展示分析结果列表
- 每个结果卡片显示：数据集名称、时间、反馈数、平均评分
- 点击展开查看完整分析结果
- 显示该分析结果关联的注释

**UI 状态处理：**
- Loading：显示加载动画
- Empty（无历史记录）：显示空状态提示
- Error：显示错误提示，提供重试按钮

### 6.2 DualTrackResultCard.tsx
- 已有的 FeedbackWidget 保持不变
- 确保提交反馈时正确传递 gene_ids

### 6.3 API Client
```typescript
// api/client.ts
export const analysisApi = {
  getResults(geneId?: string): Promise<AnalysisResultSummary[]>,
  getResult(jobId: string): Promise<AnalysisResult>,
}
```

## 7. 文件结构

```
backend/
├── data/
│   ├── feedback.json           # 已有，反馈存储
│   ├── analysis_results/       # 新增，分析结果存储
│   │   └── {job_id}.json       # 文件名格式：job_{hex}.json
│   └── breeding.db             # SQLite 数据库
├── app/
│   ├── services/
│   │   ├── analysis_service.py # 修改，添加 save/get 方法
│   │   └── feedback_service.py # 修改，添加 get_by_gene 方法
│   └── routers/
│       ├── analysis.py         # 修改，添加新端点
│       └── feedback.py        # 可能需要修改（gene_id 筛选）
```

**文件命名约定：**
- 分析结果文件：`{job_id}.json`，如 `job_2f83b371.json`
- 目录 `analysis_results/` 如果不存在需要自动创建
- 文件大小预估：单次分析结果约 10KB-100KB（取决于数据集规模）

## 8. 实现步骤

1. **后端：扩展 AnalysisService**
   - 实现 `save_result()` 保存到 JSON 文件
   - 实现 `get_results()` 支持基因筛选
   - 实现 `get_result()` 获取单个结果

2. **后端：扩展 FeedbackService**
   - 实现 `get_by_gene()` 方法

3. **后端：修改 AnalysisRouter**
   - SSE 分析完成时调用 `save_result()`
   - 添加 `/results` 和 `/results/{job_id}` 端点
   - 修改 `/feedbacks` 端点支持 gene_id 筛选

4. **前端：API Client**
   - 添加 `getResults()` 和 `getResult()` 方法

5. **前端：GeneDetailModal**
   - 添加"历史分析"Tab
   - 展示历史分析列表及注释

## 9. 注意事项

### 错误处理
- 文件不存在：返回 404 或空列表
- JSON 解析失败：记录日志，返回错误信息
- 目录创建失败：抛出异常（不应发生）
- 并发写入：JSON 文件写入使用锁或原子写（写临时文件再 rename）

### 清理策略（后续迭代）
- 保留策略：待定（如"保留最近 100 条"或"保留 30 天内"）
- 触发方式：待定（如启动时检查、或定时任务）
- **本期不做**：清理逻辑本期不实现，仅预留扩展点
