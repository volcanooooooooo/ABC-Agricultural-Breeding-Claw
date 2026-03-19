# Gene Detail Query Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement A+B mode gene detail query with automatic historical feedback display

**Architecture:** Two-part implementation:
1. **P0 (B模式)**: Extend GeneDetailModal with feedback fetching and display
2. **P1 (A模式)**: Add natural language intent recognition in ChatPage for gene queries

**Tech Stack:** React 18 + TypeScript, Ant Design, existing API client

---

## Chunk 1: GeneDetailModal Enhancement (P0 - B模式)

### Task 1.1: Add FeedbackHint Type and State

**Files:**
- Modify: `src/components/GeneDetailModal.tsx`

**Steps:**

- [ ] **Step 1: Add FeedbackHint interface and update imports**

Update the import line to add `useEffect` and add `FeedbackHint` interface. Also update `GeneDetailModalProps` to add optional `showFeedback` prop:

```typescript
import { useState, useEffect } from 'react'
import { Modal, Tag, Divider, Input, Button, message, Spin } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { AnalysisResult, GeneInfo, feedbackApi, api } from '../api/client'

interface FeedbackHint {
  id: number
  keyword: string
  track: 'tool' | 'llm'
  hint_type: 'warning' | 'praise'
  summary: string
  frequency: number
}

interface GeneDetailModalProps {
  geneId: string
  result: AnalysisResult
  open: boolean
  onClose: () => void
  showFeedback?: boolean  // 新增：是否显示反馈区域（默认 true）
}
```

- [ ] **Step 2: Add state for feedback warnings**

Find the line with `const [annotation, setAnnotation] = useState('')` and add after it. Also update the function signature to use props:

```typescript
export function GeneDetailModal({ geneId, result, open, onClose, showFeedback = true }: GeneDetailModalProps) {
  const [annotation, setAnnotation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedbackWarnings, setFeedbackWarnings] = useState<FeedbackHint[]>([])
  const [loadingFeedback, setLoadingFeedback] = useState(false)
```

- [ ] **Step 3: Add fetchGeneFeedback function with retry logic**

Find the `handleSubmitAnnotation` function and add BEFORE it:

```typescript
const fetchGeneFeedback = async (geneId: string, retryCount = 0) => {
  setLoadingFeedback(true)
  try {
    // 1. 精确匹配：获取包含该基因ID的原始反馈
    const allFeedbacksRes = await feedbackApi.getAll()
    const allFeedbacks = allFeedbacksRes.data?.data || []
    const geneFeedbacks = allFeedbacks.filter(
      (fb: any) => fb.gene_ids?.includes(geneId)
    )

    // 2. 关键词匹配：调用 hints API
    const hintRes = await api.get<{ data: FeedbackHint[] }>('/feedbacks/hints', {
      params: { keyword: geneId, limit: 10 }
    })
    const hints = hintRes.data?.data || []
    const warningsFromHints = hints.filter((h: FeedbackHint) => h.hint_type === 'warning')

    // 3. 合并去重：warning hints + 负面原始反馈
    const negativeGeneFeedbacks = geneFeedbacks
      .filter((f: any) => f.rating === 'negative')
      .map((f: any) => ({
        id: f.id,
        keyword: geneId,
        track: f.track,
        hint_type: 'warning' as const,
        summary: f.comment || `对 ${geneId} 的负面评价`,
        frequency: 1
      }))

    // 4. 合并 + 去重 + 排序（warning优先，再按frequency）+ 限制数量
    const combined = [...warningsFromHints, ...negativeGeneFeedbacks]
    const unique = combined.filter((item: FeedbackHint, idx: number, arr: FeedbackHint[]) =>
      arr.findIndex(t => t.id === item.id) === idx
    )
    const sorted = unique.sort((a: FeedbackHint, b: FeedbackHint) => {
      if (a.hint_type === 'warning' && b.hint_type !== 'warning') return -1
      if (a.hint_type !== 'warning' && b.hint_type === 'warning') return 1
      return (b.frequency || 0) - (a.frequency || 0)
    })
    setFeedbackWarnings(sorted.slice(0, 3))
  } catch (e) {
    console.error('Failed to fetch gene feedback:', e)
    // 网络超时或其他错误，5秒后重试一次
    if (retryCount < 1) {
      setTimeout(() => {
        fetchGeneFeedback(geneId, retryCount + 1)
      }, 5000)
      return // 等待重试，不关闭loading
    }
  } finally {
    setLoadingFeedback(false)
  }
}
```

- [ ] **Step 4: Add useEffect to fetch feedback when modal opens**

Find the closing brace of `fetchGeneFeedback` function and add after it (before `handleSubmitAnnotation`):

```typescript
useEffect(() => {
  if (open && geneId) {
    fetchGeneFeedback(geneId)
  } else {
    setFeedbackWarnings([])
  }
}, [open, geneId])
```

- [ ] **Step 5: Add feedback section UI in Modal body**

Inside the Modal component's return statement, find the first child `<div style={{ marginBottom: 16 }}>` (the 基本信息 section) and add BEFORE it:

```typescript
{/* 历史反馈区域 */}
{showFeedback && (feedbackWarnings.length > 0 || loadingFeedback) && (
  <div style={{
    background: 'rgba(250, 204, 21, 0.1)',
    border: '1px solid rgba(250, 204, 21, 0.3)',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 16
  }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: feedbackWarnings.length > 0 ? 8 : 0
    }}>
      <ExclamationCircleOutlined style={{ color: '#faad14' }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: '#d48806' }}>
        历史反馈标注
      </span>
      {loadingFeedback && <Spin size="small" />}
    </div>
    {feedbackWarnings.length > 0 && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {feedbackWarnings.map((warning, idx) => (
          <div key={warning.id || idx} style={{ fontSize: 12, color: '#d48806', lineHeight: 1.5 }}>
            • {warning.summary}
            {warning.track && <span style={{ color: '#999', marginLeft: 8 }}>({warning.track === 'tool' ? '工具轨' : '大模型轨'})</span>}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compilation**

Run: `cd D:\code\claude\breeding-scientist && npx tsc --noEmit`

Expected: No errors (or only pre-existing errors)

- [ ] **Step 7: Commit**

```bash
git add src/components/GeneDetailModal.tsx
git commit -m "feat: add historical feedback display to GeneDetailModal

- Add feedback fetching with exact+keyword combined matching
- Display warning-type feedbacks at modal top
- Sort by warning type first, then frequency descending
- Limit to 3 warnings max"
```

---

### Task 1.2: ChatPage - Gene Query Intent Recognition (P1 - A模式)

**Files:**
- Modify: `src/pages/ChatPage.tsx`

**Steps:**

- [ ] **Step 1: Add gene query intent detection function**

Find the `detectAnalysisIntent` function and add the new function AFTER it:

```typescript
// 基因查询意图识别
const detectGeneQueryIntent = (text: string): string | null => {
  // 基因查询模式：查看/展示 + 基因名
  const patterns = [
    /基因(\w+)/i,           // "展示基因Gene7" / "查看基因Gene7详情"
    /(gene\d+)/i,          // "查看 gene7" / "gene7详情"
    /(\w+)\s*详情/i,        // "Gene7详情" / "基因详情"
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      // 返回匹配的基因ID
      const geneId = match[1] || match[0]
      // 标准化为 GeneX 格式
      if (geneId.toLowerCase().startsWith('gene')) {
        return 'Gene' + geneId.slice(4).toLowerCase()
      }
      return geneId
    }
  }
  return null
}
```

- [ ] **Step 2: Add gene query state**

Find the ChatMessage interface definition and add `geneId` field:

```typescript
interface ChatMessage extends Message {
  isLoading?: boolean
  type?: 'text' | 'progress' | 'analysis' | 'result' | 'dataset-select' | 'dataset-selected' | 'step' | 'gene-query'
  progress?: { track: 'tool' | 'llm' | 'init' | 'consistency'; status: string; progress: number; currentStep?: string; elapsedTime?: number }
  analysisResult?: AnalysisResult
  candidateDatasets?: Dataset[]
  selectedDataset?: Dataset
  geneId?: string  // 新增：查询的基因ID
}
```

Note: `setSelectedGene`, `setSelectedResult`, and `setGeneModalOpen` already exist in ChatPage state from prior implementation.

- [ ] **Step 3: Modify handleSend to detect gene query intent**

Find the `handleSend` function. Inside it, find the block that checks `detectAnalysisIntent(input)` and add the gene query detection logic AFTER the analysis intent block (before the `const userMessage` block):

```typescript
// 检查基因查询意图
const detectedGeneId = detectGeneQueryIntent(input)
if (detectedGeneId && currentSession) {
  // 查找当前会话中的分析结果
  const resultMsg = currentSession.messages.find(
    msg => msg.type === 'progress' && msg.analysisResult
  )

  if (resultMsg?.analysisResult) {
    // 找到分析结果，直接打开基因详情弹窗
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toString(),
      type: 'gene-query',
      geneId: detectedGeneId
    }
    updateCurrentSession(msgs => [...msgs, userMsg])
    setInput('')
    setSelectedGene(detectedGeneId)
    setSelectedResult(resultMsg.analysisResult)
    setGeneModalOpen(true)
    return
  } else {
    // 没有分析结果，提示用户先进行分析
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toString(),
    }
    const systemMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `您查询的基因 "${detectedGeneId}" 信息需要先完成分析才能展示。请先发起一个差异表达分析任务。`,
      timestamp: new Date().toString(),
    }
    updateCurrentSession(msgs => [...msgs, userMsg, systemMsg])
    setInput('')
    return
  }
}
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `cd D:\code\claude\breeding-scientist && npx tsc --noEmit`

Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: add gene query intent recognition in ChatPage

- Detect gene query patterns like '查看Gene7', '基因xxx详情'
- Open GeneDetailModal when analysis result exists
- Show guidance message if no analysis result available"
```

---

## Chunk 2: Testing & Verification

### Task 2.1: Manual Testing Checklist

**Steps:**

- [ ] **Step 1: Start dev server**

Run: `cd D:\code\claude\breeding-scientist && npm run dev`

- [ ] **Step 2: Test B mode - Click gene in result card**

1. 发起一个差异分析
2. 在结果卡片中点击某个基因名
3. 验证 Modal 打开且包含历史反馈区域（如有）

- [ ] **Step 3: Test A mode - Chat input gene query**

1. 完成分析后，在聊天框输入「查看 Gene7 的详情」
2. 验证 Modal 自动打开

- [ ] **Step 4: Test edge case - No analysis result**

1. 在没有分析结果时输入「查看 Gene7」
2. 验证显示引导消息

- [ ] **Step 5: Commit final changes if any**

---

## Summary

| Task | File | Status |
|------|------|--------|
| 1.1 GeneDetailModal Enhancement | src/components/GeneDetailModal.tsx | P0 |
| 1.2 ChatPage Intent Recognition | src/pages/ChatPage.tsx | P1 |
| 2.1 Manual Testing | - | Verification |
