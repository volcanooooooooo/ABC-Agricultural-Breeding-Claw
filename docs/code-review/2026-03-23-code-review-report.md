# 代码审查报告

**日期**: 2026-03-23
**审查范围**: 当前 Git 未提交变更文件
**审查方式**: 自动审查 (Code Reuse + Quality + Efficiency)

---

## 问题汇总表

| # | 问题 | 文件 | 严重度 | 预期改善 |
|---|------|------|--------|----------|
| 1 | SSE 人为延迟 6s | `backend/app/routers/analysis.py` | 🔴 高 | 减少 6 秒 |
| 2 | 文件循环写入 | `backend/app/routers/analysis.py` | 🔴 高 | 减少 2N 次 I/O |
| 3 | setTimeout 卸载后调用 | `src/components/GeneDetailModal.tsx` | 🔴 高 | 防止内存泄漏 |
| 4 | N+1 查询模式 | `backend/app/routers/analysis.py` | 🟠 中 | O(n*m) → O(n) |
| 5 | 线性节点搜索 | `backend/app/services/ontology_service.py` | 🟠 中 | O(n) → O(1) |
| 6 | SSE 字符串格式化 | `backend/app/routers/analysis.py` | 🟠 中 | 代码更健壮 |
| 7 | print vs logging | `backend/app/routers/analysis.py` | 🟠 中 | 便于调试 |
| 8 | 双重 API 调用 | `src/components/GeneDetailModal.tsx` | 🟠 中 | 减少网络传输 |
| 9 | useEffect 依赖缺失 | `src/components/GeneDetailModal.tsx` | 🟠 中 | 更安全 |
| 10 | get_result 未复用 | `backend/app/services/analysis_service.py` | 🟡 低 | DRY |
| 11 | list vs set 查找 | `backend/app/services/analysis_service.py` | 🟡 低 | 性能提升 |
| 12 | 枚举命名不一致 | `backend/app/models/ontology.py` | 🟡 低 | 代码规范 |

---

## 🔴 高严重程度 (Critical)

### 1. SSE Stream 人为延迟 (~6秒)

**文件**: `backend/app/routers/analysis.py` (lines 314-443)

SSE 响应中有 **16 处** `await delay()` 调用，累计约 **6 秒**纯等待时间。

```python
# 统计的延迟
Line 321,324: await delay(0.5)  # x2 = 1.0s
Line 327,331,340,343: 0.4-0.6s  # x4 = 2.0s
Line 347,355,358: 0.4-0.5s  # x3 = 1.3s
...
Total: ~5.8 seconds artificial delay
```

**修复方案**:

```python
# 方案1: 移除所有人为延迟
# 方案2: 仅保留必要的进度更新节点
# 方案3: 将延迟移到客户端控制UI动画
```

**预期改善**: 减少 6 秒响应时间

---

### 2. 文件 I/O 循环写入 (N*2 次写入)

**文件**: `backend/app/routers/analysis.py` (lines 409-431) + `backend/app/services/ontology_service.py`

对于 N 个显著基因，触发 **2N 次文件写入**（每次写入 JSON + CSV）：

```python
for g in all_significant_genes:
    ontology_service.get_or_create_gene_node(...)  # 触发 _save_ontology() → 写 JSON + CSV
    ontology_service.add_analysis_result_edge(...)  # 再触发 _save_ontology() → 写 JSON + CSV
```

**修复方案**: 添加批量写入方法

```python
# ontology_service.py 新增方法
def sync_genes_batch(self, genes: List[Dict], job_id: str) -> None:
    """批量同步基因节点，边操作边收集，最后统一保存"""
    for gene in genes:
        existing = self._node_index.get(gene["gene_id"])
        if existing:
            existing.properties.update(gene.get("properties", {}))
        else:
            self.graph.nodes.append(OntologyNode(
                id=gene["gene_id"],
                type=OntologyType.GENE,
                name=gene["gene_id"],
                properties=gene.get("properties", {})
            ))
        # 收集边，暂不保存

    # 最后统一保存一次
    self._save_ontology()
```

**预期改善**: 减少 2N-1 次文件 I/O 操作

---

### 3. setTimeout 组件卸载后调用风险

**文件**: `src/components/GeneDetailModal.tsx` (lines 121-126)

```typescript
setTimeout(() => {
    fetchGeneFeedback(geneId, retryCount + 1)
}, FEEDBACK_RETRY_DELAY_MS)
// 问题：如果组件卸载后超时触发，会导致已卸载组件状态更新
```

**修复方案**:

```typescript
const mountedRef = useRef(true)

useEffect(() => {
    mountedRef.current = true
    return () => {
        mountedRef.current = false
    }
}, [])

const fetchGeneFeedback = async (geneId: string, retryCount = 0) => {
    // ...
    if (retryCount < 1) {
        setTimeout(() => {
            if (mountedRef.current) {
                fetchGeneFeedback(geneId, retryCount + 1)
            }
        }, FEEDBACK_RETRY_DELAY_MS)
        return
    }
    // ...
}
```

**预期改善**: 防止内存泄漏和已卸载组件状态更新

---

## 🟠 中严重程度 (Medium)

### 4. N+1 查询模式 - 反馈统计

**文件**: `backend/app/routers/analysis.py` (lines 265-283)

```python
all_feedbacks = feedback_service.get_all()  # 1次调用
for result in results:
    job_feedbacks = [fb for fb in all_feedbacks if fb.analysis_id == job_id]  # O(n*m)
```

**修复方案**:

```python
from collections import defaultdict

all_feedbacks = feedback_service.get_all()

# 预建字典索引: O(m)
feedbacks_by_analysis = defaultdict(list)
for fb in all_feedbacks:
    feedbacks_by_analysis[fb.analysis_id].append(fb)

summary_results = []
for result in results:
    job_feedbacks = feedbacks_by_analysis[job_id]  # O(1) 查找
    # ... 后续逻辑不变
```

**预期改善**: O(n*m) → O(n+m)

---

### 5. 线性搜索 node_exists() / get_node()

**文件**: `backend/app/services/ontology_service.py` (lines 152-176)

```python
def get_node(self, node_id: str):
    for n in self.graph.nodes:  # O(n) 每次
        if n.id == node_id:
            return n
```

**修复方案**:

```python
class OntologyService:
    def __init__(self):
        self.graph: OntologyGraph = OntologyGraph()
        self._node_index: Dict[str, OntologyNode] = {}  # 新增索引
        self._load_ontology()

    def _rebuild_index(self):
        """重建节点索引"""
        self._node_index = {n.id: n for n in self.graph.nodes}

    def get_node(self, node_id: str) -> Optional[OntologyNode]:
        return self._node_index.get(node_id)  # O(1)

    def node_exists(self, node_id: str) -> bool:
        return node_id in self._node_index  # O(1)

    # 所有修改节点的地方需要调用 _rebuild_index()
```

**预期改善**: O(n) → O(1) 查找

---

### 6. 重复的 SSE 字符串格式化

**文件**: `backend/app/routers/analysis.py` (lines 320-449)

18 处手动字符串格式化，易出错：

```python
yield "data: {\"job_id\": \"%s\", \"track\": \"init\", ...}\n\n" % job_id
```

**修复方案**:

```python
import json

def sse_message(data: dict) -> str:
    """生成 SSE 格式消息"""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

# 使用
yield sse_message({
    "job_id": job_id,
    "track": "init",
    "status": "正在初始化分析任务...",
    "progress": 5,
    "currentStep": "读取数据集"
})
```

**预期改善**: 代码更健壮，减少格式化错误

---

### 7. print() 而非 logging

**文件**: `backend/app/routers/analysis.py` (line 430)

```python
print(f"Failed to sync genes to ontology: {e}")
```

**修复方案**:

```python
import logging

logger = logging.getLogger(__name__)

# 替换 print 为
logger.error(f"Failed to sync genes to ontology: {e}")
```

**预期改善**: 便于生产环境调试

---

### 8. GeneDetailModal 双重 API 调用

**文件**: `src/components/GeneDetailModal.tsx` (lines 82-92)

每次打开 Modal 都获取**所有**反馈再客户端过滤：

```typescript
const allFeedbacksRes = await feedbackApi.getAll()  // 获取全部
const geneFeedbacks = allFeedbacks.filter(...)  // 客户端过滤
```

**修复方案**:

```typescript
// 检查是否存在按基因过滤的 API
// 如果不存在，添加后端接口
const res = await feedbackApi.getByGene(geneId)
const geneFeedbacks = res.data?.data || []
```

**预期改善**: 减少网络传输，尤其反馈数据量大时

---

### 9. useEffect 缺少依赖项

**文件**: `src/components/GeneDetailModal.tsx` (lines 162-179)

使用 `eslint-disable-next-line react-hooks/exhaustive-deps` 掩盖问题。

**修复方案**:

```typescript
const fetchGeneFeedback = useCallback(async (id: string) => {
    // 实现...
}, [])  // 空依赖，因为内部没有使用外部变量

const fetchHistoryAnalyses = useCallback(async (id: string) => {
    // 实现...
}, [])

useEffect(() => {
    if (open && geneId) {
        fetchGeneFeedback(geneId)
        fetchHistoryAnalyses(geneId)
    }
}, [open, geneId, fetchGeneFeedback, fetchHistoryAnalyses])
```

**预期改善**: 更安全的 React 状态管理

---

## 🟡 低严重程度 (Low)

### 10. get_results() 未复用 get_result()

**文件**: `backend/app/services/analysis_service.py`

两处文件读取逻辑重复。

**修复**: 在循环内调用 `get_result(job_id)` 替代重复的文件读取代码。

---

### 11. 基因列表查找用 list 而非 set

**文件**: `backend/app/services/analysis_service.py` (lines 219-221)

```python
tool_genes = [g.get('gene_id', '').lower() for ...]  # list - O(n) 查找
if gene_id.lower() in tool_genes:  # O(n)
```

**修复**: 改用 set

```python
tool_genes = {g.get('gene_id', '').lower() for ...}  # set - O(1) 查找
```

---

### 12. OntologyType 枚举命名不一致

**文件**: `backend/app/models/ontology.py`

```python
# 原有类型: snake_case
GENOTYPE = "genotype"
# 新类型: PascalCase
DATASET = "Dataset"
```

**建议**: 统一为 snake_case 或 PascalCase

---

## 🎯 推荐优先修复顺序

1. **移除 SSE 人为延迟** - 最大的性能瓶颈 (~6秒)
2. **批量写入基因节点** - 避免大量文件 I/O
3. **添加节点索引** - O(n) → O(1) 查找
4. **修复 setTimeout 问题** - 防止内存泄漏
5. **N+1 查询优化** - 提升反馈统计性能

---

## 变更文件清单

```
backend/app/models/ontology.py
backend/app/routers/analysis.py
backend/app/routers/feedback.py
backend/app/routers/ontology.py
backend/app/services/analysis_service.py
backend/app/services/feedback_service.py
backend/app/services/ontology_service.py
src/components/GeneDetailModal.tsx
src/pages/ChatPage.tsx
src/pages/OntologyPage.tsx
```
