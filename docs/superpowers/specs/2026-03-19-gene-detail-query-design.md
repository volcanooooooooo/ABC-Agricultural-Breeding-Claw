# Gene7 第二次查询前端交互设计

## 1. 概述

### 1.1 背景
根据交互.md 中的步骤6，用户在完成双轨差异分析后，可能会主动查询某个基因（如 Gene7）的详细信息。系统需要展示该基因在本次分析中的表现、染色体位置、以及基于历史反馈的标注信息。

### 1.2 目标
设计一套 A+B 模式的基因详情查询交互：
- **A 模式**：聊天输入框支持自然语言查询（如「查看 Gene7 的详情」）
- **B 模式**：在分析结果卡片中点击基因名直接查看详情

### 1.3 设计原则
- 自动展示历史反馈标注，帮助用户了解基因背景
- 优先基因ID精确匹配，其次关键词模糊匹配
- 复用现有组件，统一交互体验

---

## 2. 交互流程

### 2.1 A 模式：聊天输入框查询

```
用户输入：「展示基因Gene7的详细信息」
    ↓
系统识别为基因查询意图
    ↓
系统回复：「正在查询 Gene7 的信息...」（加载状态）
    ↓
解析基因ID，从当前会话的 analysisResult 中提取数据
    ↓
展示 GeneDetailModal（包含历史反馈区域）
```

### 2.2 B 模式：点击基因名查看

```
用户在 DualTrackResultCard 中点击基因名（如 Gene7）
    ↓
触发 onGeneClick(geneId) 回调
    ↓
打开 GeneDetailModal（包含历史反馈区域）
```

---

## 3. 反馈匹配逻辑

### 3.1 组合匹配模式
1. **基因ID精确匹配**：从 `/feedbacks` 获取所有 feedback，筛选包含目标 gene_id 的记录
2. **关键词模糊匹配**：调用 `/feedbacks/hints?keyword=Gene7` 获取 FeedbackHint

### 3.2 展示优先级与去重规则
1. **去重逻辑**：精确匹配（gene_ids 包含目标基因）和关键词匹配（hint.keyword 包含目标基因）可能产生重复，以 `id` 字段去重
2. **排序规则**：按 `frequency` 降序排列，频率越高的反馈越靠前
3. **类型优先级**：warning 类型反馈优先展示
4. **数量限制**：最多显示 3 条

```typescript
// 合并去重，优先展示 warning，按 frequency 降序
const combined = [...warningsFromHints, ...negativeGeneFeedbacks]
const unique = combined.filter((item, idx, arr) =>
  arr.findIndex(t => t.id === item.id) === idx
)
const sorted = unique.sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
setFeedbackWarnings(sorted.slice(0, 3))
```

---

## 4. UI 设计

### 4.1 GeneDetailModal 结构调整

```
┌─────────────────────────────────────────────┐
│ Gene7                               详情     │  ← Header
├─────────────────────────────────────────────┤
│ ⚠️ 历史反馈标注                              │  ← 新增：反馈区域
│ ─────────────────────────────────────────── │
│ • 有用户反馈指出此基因曾被漏检               │
│   (大模型轨，下调基因，建议关注)             │
├─────────────────────────────────────────────┤
│ 基本信息                                     │
│ ┌──────────────┬──────────────┐            │
│ │ 基因ID: Gene7│ 差异方向: ↓   │            │
│ └──────────────┴──────────────┘            │
├─────────────────────────────────────────────┤
│ 工具轨 (scipy)                              │
│ ┌──────────────────────────────────────┐   │
│ │ log2FC: -2.000  p值: <0.001          │   │
│ │ 对照组: 421, 418, 423                │   │
│ │ 处理组: 102, 98, 105                 │   │
│ └──────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│ 大模型轨 (千问)                              │
│ ┌──────────────────────────────────────┐   │
│ │ ⚠️ 未能检测到显著差异               │   │
│ └──────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│ 添加注释                                     │
│ ┌────────────────────────────────┬─────┐   │
│ │ 输入关于该基因的注释...         │ 提交 │   │
│ └────────────────────────────────┴─────┘   │
└─────────────────────────────────────────────┘
```

### 4.2 视觉规范

| 元素 | 样式 |
|------|------|
| 历史反馈区域背景 | `rgba(250, 204, 21, 0.1)` 淡黄色 |
| Warning 图标 | `#faad14` 橙色 |
| Warning 文字 | `#d48806` 深橙色 |
| 反馈项间距 | 8px |

---

## 5. 组件变更

### 5.1 GeneDetailModal 修改

**新增 Props：**
```typescript
interface GeneDetailModalProps {
  geneId: string
  result: AnalysisResult
  open: boolean
  onClose: () => void
  // 新增：是否显示反馈区域（默认 true）
  showFeedback?: boolean
}
```

**新增内部状态：**
```typescript
const [feedbackWarnings, setFeedbackWarnings] = useState<FeedbackHint[]>([])
const [loadingFeedback, setLoadingFeedback] = useState(false)
```

**新增副作用：**
```typescript
useEffect(() => {
  if (open && geneId) {
    fetchGeneFeedback(geneId)
  }
}, [open, geneId])
```

### 5.2 反馈查询函数

```typescript
const fetchGeneFeedback = async (geneId: string) => {
  setLoadingFeedback(true)
  try {
    // 1. 精确匹配：获取包含该基因ID的原始反馈
    const allFeedbacksRes = await feedbackApi.getAll()
    const geneFeedbacks = (allFeedbacksRes.data || []).filter(
      fb => fb.gene_ids?.includes(geneId)
    )

    // 2. 关键词匹配：调用 hints API
    const hintRes = await api.get<{ data: FeedbackHint[] }>('/feedbacks/hints', {
      params: { keyword: geneId, limit: 10 }
    })
    const hints = hintRes.data?.data || []
    const warningsFromHints = hints.filter(h => h.hint_type === 'warning')

    // 3. 合并去重：warning hints + 负面原始反馈
    const negativeGeneFeedbacks = geneFeedbacks
      .filter(f => f.rating === 'negative')
      .map(f => ({
        id: f.id,
        keyword: geneId,
        track: f.track,
        hint_type: 'warning' as const,
        summary: f.comment || `对 ${geneId} 的负面评价`,
        frequency: 1 // 原始反馈 frequency 默认为 1
      }))

    // 4. 合并 + 去重（以 id 去重）+ 排序 + 限制数量
    const combined = [...warningsFromHints, ...negativeGeneFeedbacks]
    const unique = combined.filter((item, idx, arr) =>
      arr.findIndex(t => t.id === item.id) === idx
    )
    const sorted = unique.sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
    setFeedbackWarnings(sorted.slice(0, 3))
  } catch (e) {
    console.error('Failed to fetch gene feedback:', e)
  } finally {
    setLoadingFeedback(false)
  }
}
```

---

## 6. 数据流

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ 用户点击/查询 │ ──▶ │ GeneDetailModal│ ──▶ │ fetchGeneFeedback │
│   Gene7     │     │   (打开)       │     │                  │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                 │
                           ┌─────────────────────┼─────────────────────┐
                           ▼                     ▼                     ▼
                    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
                    │ /feedbacks    │     │ /feedbacks/hints    │     │ 合并去重      │
                    │ (精确匹配)     │     │ (关键词匹配)  │     │ 展示 warning  │
                    └──────────────┘     └──────────────┘     └──────────────┘
```

---

## 7. 错误处理

| 场景 | 处理方式 |
|------|----------|
| API 请求失败 | 静默失败，不展示反馈区域，不阻塞主流程 |
| 无历史反馈 | 正常展示 Modal，但不显示反馈区域 |
| 网络超时 | 静默失败，5秒后重试一次 |

---

## 8. 测试用例

| ID | 场景 | 预期结果 |
|----|------|----------|
| T1 | 用户点击结果卡片中的 Gene7 | Modal 打开，显示 Gene7 的双轨数据 + 历史反馈 |
| T2 | 用户在聊天框输入「查看 Gene7」 | 系统识别意图，打开 Modal |
| T3 | Gene7 无历史反馈 | Modal 正常显示，无反馈区域 |
| T4 | Gene7 有多条负面反馈 | 按 frequency 降序展示最多 3 条 |

---

## 9. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/components/GeneDetailModal.tsx` | 修改 | 新增反馈区域和查询逻辑 |
| `src/pages/ChatPage.tsx` | 修改 | 自然语言识别基因查询意图 |
| `src/api/client.ts` | 无变更 | 复用现有 API |
| `src/hooks/useFeedbackHints.ts` | 无变更 | 复用现有 Hook |

---

## 10. 实现优先级

1. **P0**：B 模式（点击查看）- 直接修改 GeneDetailModal
2. **P1**：A 模式（聊天查询）- ChatPage 增加意图识别
3. **P2**：反馈区域样式优化
