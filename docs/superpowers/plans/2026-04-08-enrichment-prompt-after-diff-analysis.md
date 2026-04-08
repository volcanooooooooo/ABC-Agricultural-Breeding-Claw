# 差异分析后富集分析提示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 差异分析完成后，在聊天流中自动出现提示消息，询问用户是否对全部显著基因进行富集分析，点击"立即富集"后直接触发。

**Architecture:** 仅修改 `ChatPage.tsx`。在 SSE 完成回调中追加 `type: 'enrichment-prompt'` 消息，`renderMessageContent` 新增对应渲染分支，新增 `handleEnrichmentFromResult` 函数提取基因列表并触发富集分析。

**Tech Stack:** React 18, TypeScript, Ant Design

---

## File Map

- Modify: `src/pages/ChatPage.tsx`

---

### Task 1: 扩展 ChatMessage 类型 + 追加 enrichment-prompt 消息

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: 在 ChatMessage 接口的 type 字段中新增 'enrichment-prompt'**

在 `src/pages/ChatPage.tsx` 第 22 行，找到：

```typescript
  type?: 'text' | 'progress' | 'analysis' | 'result' | 'dataset-select' | 'dataset-selected' | 'step' | 'gene-query'
```

替换为：

```typescript
  type?: 'text' | 'progress' | 'analysis' | 'result' | 'dataset-select' | 'dataset-selected' | 'step' | 'gene-query' | 'enrichment-prompt'
```

- [ ] **Step 2: 在 SSE 完成回调中追加 enrichment-prompt 消息**

在 `src/pages/ChatPage.tsx` 中找到 SSE `onmessage` 回调里处理 `data.result` 的代码块（约第 493-502 行）：

```typescript
        if (data.result) {
          // 分析完成
          updateCurrentSession(msgs =>
            msgs.map(msg =>
              msg.id === progressMsgId
                ? { ...msg, analysisResult: data.result, progress: { ...msg.progress!, progress: 100, status: '分析完成', elapsedTime } }
                : msg
            )
          )
          eventSource.close()
          setCurrentJobId(null)
```

替换为：

```typescript
        if (data.result) {
          // 分析完成
          updateCurrentSession(msgs =>
            msgs.map(msg =>
              msg.id === progressMsgId
                ? { ...msg, analysisResult: data.result, progress: { ...msg.progress!, progress: 100, status: '分析完成', elapsedTime } }
                : msg
            )
          )
          // 若有显著基因，追加富集分析提示
          const sigGenes = data.result?.tool_result?.significant_genes ?? []
          if (sigGenes.length > 0) {
            updateCurrentSession(msgs => [...msgs, {
              id: `${Date.now()}-enrichment-prompt`,
              role: 'assistant' as const,
              type: 'enrichment-prompt' as const,
              content: '',
              analysisResult: data.result,
              timestamp: new Date().toString(),
            }])
          }
          eventSource.close()
          setCurrentJobId(null)
```

- [ ] **Step 3: 验证 TypeScript 无报错**

在终端运行：
```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: 无错误输出（或仅有与本次改动无关的已有警告）

- [ ] **Step 4: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: append enrichment-prompt message after diff analysis completes"
```

---

### Task 2: 新增 handleEnrichmentFromResult 函数

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: 在 handleCancelAnalysis 函数之后新增 handleEnrichmentFromResult 函数**

在 `src/pages/ChatPage.tsx` 中找到 `handleCancelAnalysis` 函数结束处（约第 559 行 `}`），在其后插入：

```typescript
  // 从差异分析结果触发富集分析
  const handleEnrichmentFromResult = async (analysisResult: AnalysisResult) => {
    // 移除提示消息
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'enrichment-prompt'))

    // 提取全部显著基因 ID
    const geneIds = analysisResult.tool_result.significant_genes
      .map(g => g.gene_id)
      .join(',')

    const userMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: `对以下基因做富集分析：${geneIds}`,
      timestamp: new Date().toString(),
    }

    updateCurrentSession(msgs => [...msgs, userMessage])
    setLoading(true)
    setIsAtBottom(true)
    await handleNormalChat(userMessage)
    setLoading(false)
  }

  // 跳过富集分析提示
  const handleSkipEnrichment = () => {
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'enrichment-prompt'))
  }
```

- [ ] **Step 2: 验证 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: add handleEnrichmentFromResult and handleSkipEnrichment"
```

---

### Task 3: 渲染 enrichment-prompt 消息卡片

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: 在 renderMessageContent 中新增 enrichment-prompt 分支**

在 `src/pages/ChatPage.tsx` 中找到 `renderMessageContent` 函数内，`// 进度卡片` 注释之前（约第 904 行），插入以下代码块：

```typescript
    // 富集分析提示卡片
    if (msg.type === 'enrichment-prompt' && msg.analysisResult) {
      const totalSig = msg.analysisResult.tool_result.total_significant
        ?? msg.analysisResult.tool_result.significant_genes.length
      return (
        <div style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          padding: '16px 20px',
          minWidth: 360,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🔬</span>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>
              差异分析完成
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            共发现 <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{totalSig}</span> 个显著差异基因。
            <br />是否对全部基因进行 KEGG/GO 富集分析？
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              size="small"
              style={{ borderRadius: 8, background: 'var(--gradient-accent)', border: 'none' }}
              onClick={() => handleEnrichmentFromResult(msg.analysisResult!)}
            >
              立即富集
            </Button>
            <Button
              type="text"
              size="small"
              style={{ color: 'var(--color-text-muted)' }}
              onClick={handleSkipEnrichment}
            >
              跳过
            </Button>
          </div>
        </div>
      )
    }
```

- [ ] **Step 2: 验证 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: render enrichment-prompt card in chat message flow"
```

---

### Task 4: 手动验证完整流程

- [ ] **Step 1: 启动前后端**

后端：
```bash
cd backend && PYTHONPATH=backend uvicorn app.main:app --reload --port 8003
```
前端（另开终端）：
```bash
npm run dev
```

- [ ] **Step 2: 触发差异分析**

打开 http://localhost:3003，在聊天框输入「帮我做差异表达分析」，选择数据集，等待分析完成。

- [ ] **Step 3: 验证提示消息出现**

分析完成后，聊天流中应出现一条 assistant 消息，内容为：
- 「差异分析完成」标题
- 「共发现 X 个显著差异基因。是否对全部基因进行 KEGG/GO 富集分析？」
- [立即富集] 和 [跳过] 两个按钮

- [ ] **Step 4: 验证"跳过"行为**

点击"跳过"，提示消息应消失，聊天流恢复正常。

- [ ] **Step 5: 再次触发差异分析，验证"立即富集"行为**

点击"立即富集"后：
1. 提示消息消失
2. 聊天流中出现用户消息「对以下基因做富集分析：...」
3. 系统开始处理，最终显示 EnrichmentResultCard

- [ ] **Step 6: 验证显著基因为空时不显示提示**

若分析结果无显著基因（significant_genes 为空数组），不应出现提示消息。

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "chore: verify enrichment prompt flow works end-to-end"
```
