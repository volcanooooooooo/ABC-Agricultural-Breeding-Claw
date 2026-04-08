# Enrichment Direct API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Agent-loop enrichment flow with a direct REST API call using all significant genes, with inline loading animation.

**Architecture:** New `POST /api/analysis/enrichment` endpoint calls `enrichment_analysis()` directly. Frontend `handleEnrichmentFromResult()` reads `all_significant_genes`, calls the new API, and shows a loading bubble that replaces with `EnrichmentResultCard` on completion.

**Tech Stack:** FastAPI (backend), React + Ant Design (frontend), axios (HTTP client)

---

### Task 1: Backend — Add enrichment REST endpoint

**Files:**
- Modify: `backend/app/routers/analysis.py`

- [ ] **Step 1: Add Pydantic request model and endpoint**

Add at the top of `backend/app/routers/analysis.py`, after the existing imports:

```python
from app.tools.enrichment import enrichment_analysis
```

Add the request model after the existing model classes (after `TopPerformersRequest`):

```python
class EnrichmentRequest(BaseModel):
    """富集分析请求"""
    gene_list: List[str]
    analysis_type: str = "both"
    pvalue_cutoff: float = 0.05
```

Add the endpoint before the `# ============ 双轨分析 API 和 SSE ============` comment:

```python
@router.post("/enrichment")
async def run_enrichment(request: EnrichmentRequest):
    """直接调用富集分析（不经过 Agent 循环）"""
    if not request.gene_list:
        raise HTTPException(status_code=400, detail="gene_list is empty")

    gene_list_str = ",".join(request.gene_list)
    raw = enrichment_analysis(
        gene_list=gene_list_str,
        analysis_type=request.analysis_type,
        pvalue_cutoff=request.pvalue_cutoff,
    )
    result = json.loads(raw)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"status": "success", "data": result}
```

- [ ] **Step 2: Verify the endpoint loads**

Run: `cd backend && python -c "from app.routers.analysis import router; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/analysis.py
git commit -m "feat: add POST /api/analysis/enrichment endpoint for direct enrichment calls"
```

---

### Task 2: Frontend — Add API client function

**Files:**
- Modify: `src/api/client.ts`

- [ ] **Step 1: Add EnrichmentResult import type and API function**

Add the `runEnrichmentAnalysis` function to the `analysisApi` object in `src/api/client.ts`. Insert it after the `cancel` entry (line 186):

```typescript
  // 富集分析（直接调用，不经过 Agent）
  runEnrichment: (geneList: string[], analysisType?: string, pvalueCutoff?: number) =>
    api.post<ApiResponse<any>>('/analysis/enrichment', {
      gene_list: geneList,
      analysis_type: analysisType ?? 'both',
      pvalue_cutoff: pvalueCutoff ?? 0.05,
    }),
```

- [ ] **Step 2: Commit**

```bash
git add src/api/client.ts
git commit -m "feat: add analysisApi.runEnrichment() client function"
```

---

### Task 3: Frontend — Rewrite handleEnrichmentFromResult and add loading/result rendering

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: Add enrichment message types to ChatMessage interface**

In `src/pages/ChatPage.tsx`, update the `ChatMessage` interface (line 20-28). Change the `type` union to include the new types:

```typescript
interface ChatMessage extends Message {
  isLoading?: boolean
  type?: 'text' | 'progress' | 'analysis' | 'result' | 'dataset-select' | 'dataset-selected' | 'step' | 'gene-query' | 'enrichment-prompt' | 'enrichment-loading' | 'enrichment-result'
  progress?: { track: 'tool' | 'llm' | 'init' | 'consistency'; status: string; progress: number; currentStep?: string; elapsedTime?: number }
  analysisResult?: AnalysisResult
  candidateDatasets?: Dataset[]
  selectedDataset?: Dataset
  geneId?: string
  enrichmentResult?: EnrichmentResult
}
```

- [ ] **Step 2: Rewrite handleEnrichmentFromResult**

Replace the entire `handleEnrichmentFromResult` function (lines 574-593) with:

```typescript
  const handleEnrichmentFromResult = async (analysisResult: AnalysisResult) => {
    // 移除富集提示卡片
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'enrichment-prompt'))

    // 使用全部显著基因，兼容旧数据回退到 significant_genes
    const allGenes = analysisResult.tool_result.all_significant_genes
      ?? analysisResult.tool_result.significant_genes
    const geneIds = allGenes.map(g => g.gene_id)

    const loadingId = `enrichment-loading-${Date.now()}`

    // 插入加载消息
    const loadingMsg: ChatMessage = {
      id: loadingId,
      role: 'assistant',
      content: `正在对 ${geneIds.length} 个显著基因进行 KEGG/GO 富集分析...`,
      timestamp: new Date().toString(),
      type: 'enrichment-loading',
    }
    updateCurrentSession(msgs => [...msgs, loadingMsg])
    setIsAtBottom(true)

    try {
      const res = await analysisApi.runEnrichment(geneIds)
      const enrichmentData: EnrichmentResult = res.data.data

      // 替换 loading 为结果
      updateCurrentSession(msgs =>
        msgs.map(msg =>
          msg.id === loadingId
            ? { ...msg, type: 'enrichment-result' as const, content: '', enrichmentResult: enrichmentData }
            : msg
        )
      )
    } catch (err: any) {
      // 替换 loading 为错误提示
      updateCurrentSession(msgs =>
        msgs.map(msg =>
          msg.id === loadingId
            ? { ...msg, type: 'text' as const, content: `富集分析失败: ${err?.response?.data?.detail || err.message || '未知错误'}` }
            : msg
        )
      )
    }
  }
```

- [ ] **Step 3: Add rendering for enrichment-loading and enrichment-result message types**

In the `renderMessage` function, find the first `enrichment-prompt` block (around line 942). Add the following two blocks BEFORE the `enrichment-prompt` block:

```typescript
    // 富集分析加载中
    if (msg.type === 'enrichment-loading') {
      return (
        <div style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          padding: '24px 32px',
          textAlign: 'center',
          minWidth: 300,
        }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {msg.content}
          </div>
        </div>
      )
    }

    // 富集分析结果
    if (msg.type === 'enrichment-result' && msg.enrichmentResult) {
      return <EnrichmentResultCard result={msg.enrichmentResult} />
    }
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: enrichment uses all significant genes with direct API call and loading animation"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start backend**

Run manually: `cd backend && uvicorn app.main:app --reload --port 8003`

- [ ] **Step 2: Start frontend**

Run manually: `npm run dev`

- [ ] **Step 3: Test the flow**

1. Run a differential expression analysis (e.g. WT vs osbzip23)
2. Wait for the enrichment prompt card to appear
3. Click "立即富集"
4. Verify: loading spinner appears with "正在对 N 个显著基因进行富集分析..." (N should be the total significant count, not 20)
5. Verify: spinner is replaced by `EnrichmentResultCard` with KEGG/GO results
6. Verify: clicking "跳过" still works to dismiss the prompt
