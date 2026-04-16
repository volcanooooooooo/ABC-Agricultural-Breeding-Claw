# Enrichment Analysis Three Input Methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three input methods (direct input, file upload, built-in data) for enrichment analysis in the ChatPage, all routed through the Agent.

**Architecture:** Extend the backend `enrichment_analysis()` tool with `gene_file_path` and `analysis_result_id` parameters. Add a new `/api/analysis/upload-genelist` endpoint for file parsing. On the frontend, remove `detectEnrichmentIntent()` rule-based detection, add a file upload confirmation card, and route the "立即富集" button through the Agent instead of direct API calls.

**Tech Stack:** FastAPI (backend), React 18 + TypeScript + Ant Design (frontend), LangChain Agent (tool dispatch)

---

### Task 1: Extend enrichment_analysis() with file and result ID input

**Files:**
- Modify: `backend/app/tools/enrichment.py:228-293` (enrichment_analysis function)
- Modify: `backend/app/tools/enrichment.py:300-337` (ENRICHMENT_ANALYSIS_SCHEMA)

- [ ] **Step 1: Add gene extraction helper functions**

Add two new helper functions before `enrichment_analysis()` in `backend/app/tools/enrichment.py`:

```python
def _extract_genes_from_file(file_path: str) -> List[str]:
    """从文件中提取基因ID列表。

    支持两种格式：
    1. 纯基因ID文件：每行一个基因ID，或逗号/制表符分隔
    2. 差异分析结果 CSV：自动检测含 gene_id + pvalue/log2fc 列，按阈值筛选
    """
    import csv as csv_module
    p = Path(file_path)
    if not p.exists():
        return []

    content = p.read_text(encoding="utf-8").strip()
    if not content:
        return []

    # 尝试结构化 CSV/TSV 解析
    sep = "\t" if p.suffix in (".tsv", ".txt") and "\t" in content.split("\n")[0] else ","
    try:
        lines = content.split("\n")
        header = lines[0].lower()
        if "gene_id" in header and ("pvalue" in header or "log2fc" in header):
            # 差异分析结果格式
            genes = []
            reader = csv_module.DictReader(lines, delimiter=sep)
            for row in reader:
                gene_id = row.get("gene_id", "").strip()
                if not gene_id:
                    continue
                try:
                    pval = float(row.get("pvalue", row.get("p_value", "1")))
                    l2fc = abs(float(row.get("log2fc", row.get("log2_fc", "0"))))
                except (ValueError, TypeError):
                    continue
                if pval <= 0.05 and l2fc >= 1.0:
                    genes.append(gene_id)
            if genes:
                return genes
    except Exception:
        pass

    # 纯文本格式：每行一个基因ID 或 逗号分隔
    genes = []
    for line in content.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # 多列 TSV（表达矩阵），跳过
        if "\t" in line and len(line.split("\t")) > 3:
            continue
        # 逗号分隔
        if "," in line:
            genes.extend(g.strip() for g in line.split(",") if g.strip() and not g.strip().replace(".", "").replace("-", "").isdigit())
        else:
            # 单行一个基因ID（忽略纯数字行）
            if not line.replace(".", "").replace("-", "").isdigit():
                genes.append(line)
    return genes


def _extract_genes_from_result(result_id: str) -> List[str]:
    """从差异分析结果 JSON 文件中提取显著基因ID列表。"""
    results_dir = Path(__file__).resolve().parent.parent.parent / "backend" / "data" / "analysis_results"
    result_file = results_dir / f"{result_id}.json"
    if not result_file.exists():
        # 也尝试不带 backend 前缀的路径
        results_dir_alt = Path(__file__).resolve().parent.parent.parent / "data" / "analysis_results"
        result_file = results_dir_alt / f"{result_id}.json"
        if not result_file.exists():
            return []

    try:
        data = json.loads(result_file.read_text(encoding="utf-8"))
        tool_result = data.get("tool_result", {})
        sig_genes = tool_result.get("all_significant_genes") or tool_result.get("significant_genes", [])
        return [g["gene_id"] for g in sig_genes if g.get("gene_id")]
    except Exception:
        return []
```

- [ ] **Step 2: Modify enrichment_analysis() signature and logic**

Replace the `enrichment_analysis` function signature and the gene extraction section (lines 228-252) in `backend/app/tools/enrichment.py`:

```python
def enrichment_analysis(
    gene_list: str = "",
    gene_file_path: str = "",
    analysis_result_id: str = "",
    analysis_type: str = "both",
    organism: str = "oryza sativa",
    pvalue_cutoff: float = 0.05,
    gene_sets: str = "GO_Biological_Process_2023",
) -> str:
    """对基因列表进行 KEGG 和/或 GO 富集分析（本地 MH63 注释文件）。

    三种输入方式（互斥，按优先级取第一个非空的）：
    1. gene_list: 逗号分隔的基因 ID
    2. gene_file_path: 基因列表文件路径
    3. analysis_result_id: 差异分析结果 ID

    Args:
        gene_list: 逗号分隔的基因 ID，如 "OsMH_01G0000400,OsMH_02G0001200"
        gene_file_path: 基因列表文件路径（.txt 每行一个基因ID，或差异分析结果 CSV）
        analysis_result_id: 差异分析结果 ID（如 job_xxxxxxxx）
        analysis_type: "GO" | "KEGG" | "both"，默认 "both"
        organism: 物种名称，默认 "oryza sativa"
        pvalue_cutoff: p 值阈值，默认 0.05
        gene_sets: 保留参数（向后兼容），不再使用

    Returns:
        JSON 字符串，包含 kegg_results、go_results 和 summary。
    """
    # 按优先级提取基因列表
    genes: List[str] = []

    if gene_list and gene_list.strip():
        genes = [g.strip() for g in gene_list.split(",") if g.strip()]
    elif gene_file_path and gene_file_path.strip():
        genes = _extract_genes_from_file(gene_file_path.strip())
        if not genes:
            return json.dumps({"error": f"无法从文件 {gene_file_path} 中提取基因ID"})
    elif analysis_result_id and analysis_result_id.strip():
        genes = _extract_genes_from_result(analysis_result_id.strip())
        if not genes:
            return json.dumps({"error": f"无法从分析结果 {analysis_result_id} 中提取显著基因"})

    if not genes:
        return json.dumps({"error": "请提供基因列表、基因文件路径或差异分析结果ID"})
```

The rest of the function (lines 254-293, starting from `# ID 转换`) stays unchanged.

- [ ] **Step 3: Update ENRICHMENT_ANALYSIS_SCHEMA**

Replace the `ENRICHMENT_ANALYSIS_SCHEMA` at the bottom of `backend/app/tools/enrichment.py` (lines 300-337):

```python
ENRICHMENT_ANALYSIS_SCHEMA = {
    "type": "function",
    "function": {
        "name": "enrichment_analysis",
        "description": (
            "对基因列表进行 KEGG 通路富集分析和 GO 功能富集分析，"
            "使用本地 MH63 水稻注释文件（Fisher 精确检验 + BH 校正）。"
            "支持三种输入方式：1) 直接传入基因ID列表 2) 指定基因列表文件路径 "
            "3) 引用差异分析结果ID。返回富集通路列表、统计数据和摘要。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "gene_list": {
                    "type": "string",
                    "description": "逗号分隔的基因 ID 列表，如 'OsMH_01G0000400,OsMH_02G0001200'",
                },
                "gene_file_path": {
                    "type": "string",
                    "description": "基因列表文件路径（.txt 每行一个基因ID，或差异分析结果 CSV）",
                },
                "analysis_result_id": {
                    "type": "string",
                    "description": "差异分析结果 ID（如 job_xxxxxxxx），从中提取显著基因进行富集分析",
                },
                "analysis_type": {
                    "type": "string",
                    "enum": ["GO", "KEGG", "both"],
                    "description": "分析类型：GO、KEGG 或两者都做，默认 both",
                    "default": "both",
                },
                "organism": {
                    "type": "string",
                    "description": "物种名称，默认 'oryza sativa'（水稻 MH63）",
                    "default": "oryza sativa",
                },
                "pvalue_cutoff": {
                    "type": "number",
                    "description": "p 值阈值，默认 0.05",
                    "default": 0.05,
                },
            },
            "required": [],
        },
    },
}
```

- [ ] **Step 4: Verify backend starts without errors**

Run: `cd /data/chenghuang11/ABC-Agricultural-Breeding-Claw && PYTHONPATH=backend python -c "from app.tools.enrichment import enrichment_analysis, ENRICHMENT_ANALYSIS_SCHEMA; print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/tools/enrichment.py
git commit -m "feat: extend enrichment_analysis with file and result ID input

支持三种输入方式：gene_list、gene_file_path、analysis_result_id"
```

---

### Task 2: Add upload-genelist endpoint to analysis router

**Files:**
- Modify: `backend/app/routers/analysis.py` (add new endpoint after existing `/enrichment` endpoint)

- [ ] **Step 1: Add the upload-genelist endpoint**

Add the following after the `run_enrichment` endpoint (after line 243) in `backend/app/routers/analysis.py`:

```python
@router.post("/upload-genelist")
async def upload_genelist(file: UploadFile = File(...)):
    """上传基因列表文件，解析并返回基因ID预览"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed_exts = {".txt", ".csv", ".tsv"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型 '{ext}'，请上传 .txt/.csv/.tsv 格式文件")

    uploads_dir = Path(__file__).resolve().parent.parent.parent / "data" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    dest = uploads_dir / safe_name

    content = await file.read()
    dest.write_bytes(content)

    # 解析基因列表
    text = content.decode("utf-8", errors="ignore").strip()
    if not text:
        raise HTTPException(status_code=400, detail="文件内容为空")

    genes: list[str] = []
    file_type = "gene_list"

    # 尝试结构化解析（差异分析结果 CSV）
    lines = text.split("\n")
    header = lines[0].lower()
    if "gene_id" in header and ("pvalue" in header or "log2fc" in header):
        file_type = "diff_result"
        import csv as csv_module
        import io
        sep = "\t" if "\t" in lines[0] else ","
        reader = csv_module.DictReader(io.StringIO(text), delimiter=sep)
        for row in reader:
            gene_id = row.get("gene_id", "").strip()
            if not gene_id:
                continue
            try:
                pval = float(row.get("pvalue", row.get("p_value", "1")))
                l2fc = abs(float(row.get("log2fc", row.get("log2_fc", "0"))))
            except (ValueError, TypeError):
                continue
            if pval <= 0.05 and l2fc >= 1.0:
                genes.append(gene_id)
    elif "\t" in lines[0] and len(lines[0].split("\t")) > 3:
        # 多列 TSV（表达矩阵），不是基因列表
        raise HTTPException(status_code=400, detail="文件看起来是表达矩阵而非基因列表，请拖拽到差异分析流程")
    else:
        # 纯文本格式：每行一个基因ID 或 逗号分隔
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # 逗号分隔
            if "," in line:
                genes.extend(g.strip() for g in line.split(",") if g.strip())
            else:
                # 单行一个基因ID（忽略纯数字行）
                if not line.replace(".", "").replace("-", "").isdigit():
                    genes.append(line)

    if not genes:
        raise HTTPException(status_code=400, detail="未能从文件中识别到基因ID")

    return {
        "status": "success",
        "data": {
            "file_path": str(dest),
            "filename": file.filename,
            "gene_count": len(genes),
            "gene_preview": genes[:10],
            "file_type": file_type,
        }
    }
```

- [ ] **Step 2: Verify backend starts without errors**

Run: `cd /data/chenghuang11/ABC-Agricultural-Breeding-Claw && PYTHONPATH=backend python -c "from app.routers.analysis import router; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/analysis.py
git commit -m "feat: add POST /api/analysis/upload-genelist endpoint

解析基因列表文件（.txt/.csv/.tsv），支持纯基因ID和差异分析结果格式"
```

---

### Task 3: Add uploadGeneList to frontend API client

**Files:**
- Modify: `src/api/client.ts` (add method to `analysisApi` object)

- [ ] **Step 1: Add the uploadGeneList method**

In `src/api/client.ts`, add the following method to the `analysisApi` object, after the `uploadMatrix` method (after line 226):

```typescript
  // 基因列表文件上传（用于富集分析）
  uploadGeneList: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<{
      file_path: string
      filename: string
      gene_count: number
      gene_preview: string[]
      file_type: 'gene_list' | 'diff_result'
    }>>('/analysis/upload-genelist', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /data/chenghuang11/ABC-Agricultural-Breeding-Claw && npx tsc --noEmit src/api/client.ts 2>&1 | head -20`

Expected: No errors (or only pre-existing unrelated warnings).

- [ ] **Step 3: Commit**

```bash
git add src/api/client.ts
git commit -m "feat: add uploadGeneList API method for enrichment file upload"
```

---

### Task 4: ChatPage — Remove detectEnrichmentIntent and update enrichment-from-result to use Agent

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: Remove detectEnrichmentIntent function**

Delete the `detectEnrichmentIntent` function (lines 181-185 in `src/pages/ChatPage.tsx`):

```typescript
// DELETE THIS:
  // 识别富集分析意图（优先级高于差异分析）
  const detectEnrichmentIntent = (text: string): boolean => {
    const keywords = ['富集', 'kegg', 'go分析', 'go富集', 'pathway', '通路分析']
    return keywords.some(k => text.toLowerCase().includes(k.toLowerCase()))
  }
```

Also search for any references to `detectEnrichmentIntent` in the file and remove them. There should be no remaining calls since this function is only defined but checking confirms.

- [ ] **Step 2: Modify handleEnrichmentFromResult to use Agent**

Replace the `handleEnrichmentFromResult` function (the function that starts at `const handleEnrichmentFromResult = async (analysisResult: AnalysisResult) =>`) with:

```typescript
  // 从差异分析结果触发富集分析（通过 Agent）
  const handleEnrichmentFromResult = async (analysisResult: AnalysisResult) => {
    // 移除富集提示卡片
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'enrichment-prompt'))

    const totalSig = analysisResult.tool_result.total_significant
      ?? analysisResult.tool_result.significant_genes.length

    // 构造用户消息发送给 Agent
    const userMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: `请对差异分析结果 ${analysisResult.id} 中的 ${totalSig} 个显著基因进行 KEGG/GO 富集分析`,
      timestamp: new Date().toString(),
    }
    updateCurrentSession(msgs => [...msgs, userMsg])
    setIsAtBottom(true)
    setLoading(true)
    await handleNormalChat(userMsg)
    setLoading(false)
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /data/chenghuang11/ABC-Agricultural-Breeding-Claw && npx tsc --noEmit 2>&1 | head -20`

Expected: No new errors related to detectEnrichmentIntent or handleEnrichmentFromResult.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "refactor: remove detectEnrichmentIntent, route enrichment through Agent

- 删除前端规则识别，富集分析意图完全由 Agent 判断
- 立即富集按钮改为通过 Agent 对话调用"
```

---

### Task 5: ChatPage — Add file upload confirmation card for enrichment

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: Add enrichment-file-confirm to ChatMessage type**

In `src/pages/ChatPage.tsx`, update the `ChatMessage` interface's `type` field (around line 27) to add the new type. Find the existing type union and add `'enrichment-file-confirm'`:

```typescript
  type?: 'text' | 'progress' | 'analysis' | 'result' | 'dataset-select' | 'dataset-selected' | 'step' | 'gene-query' | 'enrichment-prompt' | 'enrichment-loading' | 'enrichment-result' | 'blast-result' | 'analysis-method-select' | 'enrichment-file-confirm'
```

Add a new optional field to `ChatMessage`:

```typescript
  enrichmentFileInfo?: { filePath: string; filename: string; geneCount: number; genePreview: string[]; fileType: string }
```

- [ ] **Step 2: Modify handleDrop to detect gene list files**

In the `handleDrop` function (around line 782), modify the `else if (matrixExts.includes(ext) || ext === '.txt')` branch. Replace it with logic that tries `upload-genelist` first, falls back to `upload-matrix`:

```typescript
    } else if (matrixExts.includes(ext) || ext === '.txt') {
      // 先尝试解析为基因列表（富集分析）
      try {
        const geneRes = await analysisApi.uploadGeneList(file)
        const geneData = (geneRes.data as any).data ?? geneRes.data
        // 成功检测到基因列表 → 显示富集确认卡片
        updateCurrentSession(msgs => [...msgs,
          {
            id: `${Date.now()}-upload-user`,
            role: 'user' as const,
            content: `上传基因列表文件：${file.name}`,
            timestamp: new Date().toString(),
          },
          {
            id: `${Date.now()}-enrichment-file-confirm`,
            role: 'assistant' as const,
            content: '',
            timestamp: new Date().toString(),
            type: 'enrichment-file-confirm' as const,
            enrichmentFileInfo: {
              filePath: geneData.file_path,
              filename: geneData.filename,
              geneCount: geneData.gene_count,
              genePreview: geneData.gene_preview,
              fileType: geneData.file_type,
            },
          },
        ])
      } catch {
        // 解析失败 → 回退到表达矩阵上传流程
        updateCurrentSession(msgs => [...msgs, {
          id: `${Date.now()}-upload-user`,
          role: 'user' as const,
          content: `上传表达矩阵文件：${file.name}`,
          timestamp: new Date().toString(),
        }])
        await handleUploadAndAnalyze(file)
      }
```

- [ ] **Step 3: Add handleEnrichmentFileConfirm and handleEnrichmentFileCancel handlers**

Add these two functions near `handleEnrichmentFromResult` (around line 724):

```typescript
  // 确认基因列表文件 → 发送给 Agent 进行富集分析
  const handleEnrichmentFileConfirm = async (filePath: string, filename: string, geneCount: number) => {
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'enrichment-file-confirm'))

    const userMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: `请对上传的基因列表文件进行 KEGG/GO 富集分析（文件：${filename}，共 ${geneCount} 个基因）`,
      timestamp: new Date().toString(),
      attachedFile: { name: filename, path: filePath },
    }

    // 发送给后端的消息包含文件路径
    const messageForBackend: ChatMessage = {
      ...userMsg,
      content: `${userMsg.content}\n[上传文件: ${filename}, 路径: ${filePath}]`,
    }

    updateCurrentSession(msgs => [...msgs, userMsg])
    setIsAtBottom(true)
    setLoading(true)
    await handleNormalChat(messageForBackend)
    setLoading(false)
  }

  // 取消基因列表文件富集分析
  const handleEnrichmentFileCancel = () => {
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'enrichment-file-confirm'))
  }
```

- [ ] **Step 4: Add enrichment-file-confirm card rendering**

In the message rendering section of `ChatPage.tsx`, find the existing `enrichment-prompt` card rendering block (around line 1263). Add the following block **before** it:

```typescript
    // 富集分析文件上传确认卡片
    if (msg.type === 'enrichment-file-confirm' && msg.enrichmentFileInfo) {
      const info = msg.enrichmentFileInfo
      return (
        <div style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '16px 20px',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
            检测到基因列表文件
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            文件：{info.filename}（{info.fileType === 'diff_result' ? '差异分析结果' : '基因ID列表'}）
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            共 {info.geneCount} 个基因：{info.genePreview.slice(0, 5).join(', ')}{info.geneCount > 5 ? ` ...等` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              size="small"
              style={{ borderRadius: 8, background: 'var(--gradient-accent)', border: 'none' }}
              onClick={() => handleEnrichmentFileConfirm(info.filePath, info.filename, info.geneCount)}
            >
              开始富集分析
            </Button>
            <Button
              type="text"
              size="small"
              style={{ color: 'var(--color-text-muted)' }}
              onClick={handleEnrichmentFileCancel}
            >
              取消
            </Button>
          </div>
        </div>
      )
    }
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /data/chenghuang11/ABC-Agricultural-Breeding-Claw && npx tsc --noEmit 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: add enrichment file upload confirmation card in ChatPage

- 文件上传时先尝试解析为基因列表，成功则显示确认卡片
- 确认后通过 Agent 调用富集分析
- 解析失败则回退到差异分析文件上传流程"
```

---

### Task 6: Manual integration test

**Files:** None (testing only)

- [ ] **Step 1: Start backend**

Run: `cd /data/chenghuang11/ABC-Agricultural-Breeding-Claw && PYTHONPATH=backend uvicorn app.main:app --reload --port 8003 &`

- [ ] **Step 2: Start frontend**

Run: `cd /data/chenghuang11/ABC-Agricultural-Breeding-Claw && npm run dev &`

- [ ] **Step 3: Test Method 1 — Direct input via natural language**

Open http://localhost:3003, go to ChatPage, type:
`帮我对这些基因做富集分析：OsMH_01G0000400,OsMH_02G0001200,OsMH_03G0005600`

Expected: Agent recognizes enrichment intent, calls enrichment_analysis tool, returns results with EnrichmentResultCard rendered.

- [ ] **Step 4: Test Method 2 — File upload**

Create a test gene list file `/tmp/test_genes.txt` with content:
```
OsMH_01G0000400
OsMH_02G0001200
OsMH_03G0005600
OsMH_04G0001000
OsMH_05G0002300
```

Drag the file into the chat area. Expected: A confirmation card appears showing "检测到 5 个基因", click "开始富集分析", Agent runs enrichment analysis.

- [ ] **Step 5: Test Method 3 — Built-in data (from differential analysis result)**

Run a differential analysis first (e.g., `/analyze --control WT --treatment osbzip23`), wait for results. When the "立即富集" prompt appears, click it. Expected: A user message is sent to Agent requesting enrichment on the analysis result, Agent returns enrichment results.

- [ ] **Step 6: Commit final state if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration test fixes for enrichment three input methods"
```
