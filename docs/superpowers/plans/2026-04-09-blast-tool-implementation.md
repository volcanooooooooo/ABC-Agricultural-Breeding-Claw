# BLAST 本地序列比对工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local BLAST+ sequence alignment tool to the ABC breeding assistant, callable via the Agent chat loop.

**Architecture:** New `blast.py` tool using subprocess to call local BLAST+ commands with tabular output parsed by pandas. Agent integration via TOOL_HANDLERS/TOOLS registry. Frontend renders results via `BlastResultCard` component, parsed from `<!-- BLAST_DATA: {...} -->` comments in agent replies. Chat input supports drag-and-drop FASTA file upload.

**Tech Stack:** Python subprocess + pandas (backend), React + Ant Design + TypeScript (frontend), BLAST+ CLI (system dependency)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `backend/app/tools/blast.py` | BLAST tool function + schema |
| Modify | `backend/app/tools/__init__.py` | Export blast tool |
| Modify | `backend/app/agent/analysis_agent.py` | Register blast tool |
| Modify | `backend/app/routers/chat.py` | Update SYSTEM_PROMPT |
| Modify | `backend/app/routers/analysis.py` | Add FASTA upload endpoint |
| Create | `backend/data/blastdb/databases.json` | Pre-configured DB metadata |
| Create | `src/components/BlastResultCard.tsx` | BLAST result display component |
| Modify | `src/pages/ChatPage.tsx` | Parse BLAST_DATA + drag-drop upload |
| Modify | `src/api/client.ts` | Add uploadFasta API function |

---

### Task 1: Create BLAST tool backend (`blast.py`)

**Files:**
- Create: `backend/app/tools/blast.py`

- [ ] **Step 1: Create `blast.py` with helper functions**

```python
"""Local BLAST+ sequence alignment tool — subprocess + tabular output + pandas."""

import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

_BLASTDB_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "blastdb"
_UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "uploads"
_DATABASES_JSON = _BLASTDB_DIR / "databases.json"

_TABULAR_FIELDS = [
    "qseqid", "sseqid", "pident", "length", "mismatch", "gapopen",
    "qstart", "qend", "sstart", "send", "evalue", "bitscore", "qcovs", "stitle",
]
_OUTFMT = "6 " + " ".join(_TABULAR_FIELDS)

VALID_PROGRAMS = {"blastn", "blastp", "blastx", "tblastn"}


def _load_databases() -> List[Dict[str, Any]]:
    if not _DATABASES_JSON.exists():
        return []
    with open(_DATABASES_JSON, encoding="utf-8") as f:
        return json.load(f)


def _find_database(name: str) -> Optional[Dict[str, Any]]:
    for db in _load_databases():
        if db["name"] == name:
            return db
    return None


def _resolve_db_path(db_name: str) -> Optional[Path]:
    db = _find_database(db_name)
    if not db:
        return None
    db_dir = _BLASTDB_DIR / db_name
    fasta = db.get("fasta_source", "")
    candidate = db_dir / fasta
    if candidate.exists():
        return candidate
    return db_dir / db_name


def _extract_sequence_by_id(gene_id: str, db_name: str) -> Optional[str]:
    db = _find_database(db_name)
    if not db:
        return None
    fasta_path = _BLASTDB_DIR / db_name / db.get("fasta_source", "")
    if not fasta_path.exists():
        return None
    capturing = False
    lines: List[str] = []
    with open(fasta_path, encoding="utf-8") as f:
        for line in f:
            if line.startswith(">"):
                if capturing:
                    break
                header_id = line[1:].split()[0]
                if header_id == gene_id:
                    lines.append(line)
                    capturing = True
            elif capturing:
                lines.append(line)
    return "".join(lines) if lines else None
```

- [ ] **Step 2: Add the main `blast_search` function**

Append to `blast.py`:

```python
def blast_search(
    query: str,
    query_type: str = "sequence",
    program: str = "blastn",
    database: str = "MH63",
    evalue: float = 1e-5,
    max_hits: int = 50,
    identity_threshold: float = 0.0,
) -> str:
    """Run local BLAST+ search. Returns JSON string."""
    if program not in VALID_PROGRAMS:
        return json.dumps({"error": f"Invalid program '{program}'. Use: {', '.join(sorted(VALID_PROGRAMS))}"})

    # Validate database
    db_info = _find_database(database)
    if not db_info:
        available = [d["name"] for d in _load_databases()]
        return json.dumps({"error": f"Database '{database}' not found. Available: {available}"})

    # Check program/db type compatibility
    db_type = db_info.get("type", "nucl")
    allowed = db_info.get("programs", [])
    if allowed and program not in allowed:
        return json.dumps({"error": f"Program '{program}' not compatible with '{database}' ({db_type}). Use: {allowed}"})

    # Resolve query sequence
    query_fasta: Optional[str] = None
    if query_type == "gene_id":
        query_fasta = _extract_sequence_by_id(query, database)
        if not query_fasta:
            return json.dumps({"error": f"Gene ID '{query}' not found in database '{database}'"})
    elif query_type == "file":
        file_path = Path(query)
        if not file_path.exists():
            return json.dumps({"error": f"File not found: {query}"})
        query_fasta = file_path.read_text(encoding="utf-8")
    else:
        query_fasta = query
        if not query_fasta.startswith(">"):
            query_fasta = f">query\n{query_fasta}"

    # Write query to temp file
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".fa", delete=False, encoding="utf-8")
    try:
        tmp.write(query_fasta)
        tmp.close()

        db_path = _resolve_db_path(database)
        if not db_path:
            return json.dumps({"error": f"Database path not resolved for '{database}'"})

        cmd = [
            program,
            "-query", tmp.name,
            "-db", str(db_path),
            "-outfmt", _OUTFMT,
            "-evalue", str(evalue),
            "-max_target_seqs", str(max_hits),
        ]

        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

        if proc.returncode != 0:
            stderr = proc.stderr.strip()
            if "not found" in stderr.lower() or "No such file" in stderr.lower():
                return json.dumps({"error": f"BLAST+ not installed or database not built. Run: makeblastdb -in <fasta> -dbtype {db_type} -out {db_path}"})
            return json.dumps({"error": f"BLAST failed: {stderr[:500]}"})

        if not proc.stdout.strip():
            return json.dumps({
                "hits": [],
                "summary": {
                    "program": program, "database": database,
                    "query_count": query_fasta.count(">"), "total_hits": 0,
                    "top_hit_identity": 0, "top_hit_evalue": 0,
                },
            })

        # Parse tabular output
        from io import StringIO
        df = pd.read_csv(StringIO(proc.stdout), sep="\t", names=_TABULAR_FIELDS, header=None)

        if identity_threshold > 0:
            df = df[df["pident"] >= identity_threshold]

        hits = []
        for _, row in df.iterrows():
            hits.append({
                "query_id": str(row["qseqid"]),
                "subject_id": str(row["sseqid"]),
                "identity": float(row["pident"]),
                "alignment_length": int(row["length"]),
                "mismatches": int(row["mismatch"]),
                "gap_opens": int(row["gapopen"]),
                "query_start": int(row["qstart"]),
                "query_end": int(row["qend"]),
                "subject_start": int(row["sstart"]),
                "subject_end": int(row["send"]),
                "evalue": float(row["evalue"]),
                "bit_score": float(row["bitscore"]),
                "query_coverage": int(row["qcovs"]) if pd.notna(row["qcovs"]) else 0,
                "subject_title": str(row["stitle"]) if pd.notna(row["stitle"]) else "",
            })

        summary = {
            "program": program,
            "database": database,
            "query_count": query_fasta.count(">"),
            "total_hits": len(hits),
            "top_hit_identity": hits[0]["identity"] if hits else 0,
            "top_hit_evalue": hits[0]["evalue"] if hits else 0,
        }

        return json.dumps({"hits": hits, "summary": summary}, ensure_ascii=False)

    except subprocess.TimeoutExpired:
        return json.dumps({"error": "BLAST search timed out (300s limit)"})
    except Exception as e:
        return json.dumps({"error": f"BLAST search failed: {str(e)}"})
    finally:
        os.unlink(tmp.name)
```

- [ ] **Step 3: Add the schema constant**

Append to `blast.py`:

```python
BLAST_SEARCH_SCHEMA = {
    "type": "function",
    "function": {
        "name": "blast_search",
        "description": (
            "使用本地 BLAST+ 进行序列比对。支持 blastn（核酸比核酸）、blastp（蛋白比蛋白）、"
            "blastx（核酸翻译比蛋白）、tblastn（蛋白比核酸翻译）。"
            "可接受 FASTA 序列、基因 ID 或上传的文件路径作为查询输入。"
            "返回比对命中列表，包含相似度、E-value、比对位置等信息。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "查询序列（FASTA 格式字符串）、基因 ID、或上传文件的服务器路径",
                },
                "query_type": {
                    "type": "string",
                    "enum": ["sequence", "gene_id", "file"],
                    "description": "查询类型：sequence（FASTA序列）、gene_id（基因ID，从数据库提取）、file（上传文件路径）",
                    "default": "sequence",
                },
                "program": {
                    "type": "string",
                    "enum": ["blastn", "blastp", "blastx", "tblastn"],
                    "description": "BLAST 程序：blastn（核酸比核酸）、blastp（蛋白比蛋白）、blastx（核酸翻译比蛋白）、tblastn（蛋白比核酸翻译）",
                    "default": "blastn",
                },
                "database": {
                    "type": "string",
                    "description": "目标数据库名称，如 'MH63'（核酸）或 'MH63_pep'（蛋白）",
                    "default": "MH63",
                },
                "evalue": {
                    "type": "number",
                    "description": "E-value 阈值，默认 1e-5",
                    "default": 1e-5,
                },
                "max_hits": {
                    "type": "integer",
                    "description": "最大返回比对数，默认 50",
                    "default": 50,
                },
                "identity_threshold": {
                    "type": "number",
                    "description": "最低相似度百分比过滤（0-100），默认 0 不过滤",
                    "default": 0.0,
                },
            },
            "required": ["query"],
        },
    },
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/tools/blast.py
git commit -m "feat: add BLAST sequence alignment tool (blast.py)"
```

---

### Task 2: Create databases.json and directory structure

**Files:**
- Create: `backend/data/blastdb/databases.json`

- [ ] **Step 1: Create directories and databases.json**

```bash
mkdir -p backend/data/blastdb/MH63
mkdir -p backend/data/blastdb/MH63_pep
mkdir -p backend/data/blastdb/user
mkdir -p backend/data/uploads
```

Create `backend/data/blastdb/databases.json`:

```json
[
  {
    "name": "MH63",
    "type": "nucl",
    "description": "MH63RS3 水稻基因组",
    "fasta_source": "MH63RS3.fa",
    "programs": ["blastn", "tblastn"]
  },
  {
    "name": "MH63_pep",
    "type": "prot",
    "description": "MH63RS3 蛋白质序列",
    "fasta_source": "MH63RS3_pep.fa",
    "programs": ["blastp", "blastx"]
  }
]
```

- [ ] **Step 2: Add .gitkeep files for empty directories**

```bash
touch backend/data/blastdb/MH63/.gitkeep
touch backend/data/blastdb/MH63_pep/.gitkeep
touch backend/data/blastdb/user/.gitkeep
touch backend/data/uploads/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add backend/data/blastdb/ backend/data/uploads/.gitkeep
git commit -m "feat: add BLAST database directory structure and config"
```

---

### Task 3: Register BLAST tool in agent

**Files:**
- Modify: `backend/app/tools/__init__.py`
- Modify: `backend/app/agent/analysis_agent.py`

- [ ] **Step 1: Export blast tool from `__init__.py`**

Replace `backend/app/tools/__init__.py` with:

```python
from .differential import differential_expression_analysis, DIFFERENTIAL_ANALYSIS_SCHEMA
from .enrichment import enrichment_analysis, ENRICHMENT_ANALYSIS_SCHEMA
from .blast import blast_search, BLAST_SEARCH_SCHEMA

__all__ = [
    "differential_expression_analysis",
    "DIFFERENTIAL_ANALYSIS_SCHEMA",
    "enrichment_analysis",
    "ENRICHMENT_ANALYSIS_SCHEMA",
    "blast_search",
    "BLAST_SEARCH_SCHEMA",
]
```

- [ ] **Step 2: Register in `analysis_agent.py`**

Add import at top of `backend/app/agent/analysis_agent.py`:

```python
from app.tools.blast import (
    BLAST_SEARCH_SCHEMA,
    blast_search,
)
```

Update `TOOL_HANDLERS`:

```python
TOOL_HANDLERS = {
    "differential_expression_analysis": differential_expression_analysis,
    "enrichment_analysis": enrichment_analysis,
    "blast_search": blast_search,
}
```

Update `TOOLS`:

```python
TOOLS = [DIFFERENTIAL_ANALYSIS_SCHEMA, ENRICHMENT_ANALYSIS_SCHEMA, BLAST_SEARCH_SCHEMA]
```

- [ ] **Step 3: Update `_dispatch_tool` truncation for BLAST hits**

In `_dispatch_tool`, add BLAST-specific truncation alongside the existing volcano_data logic (after `backend/app/agent/analysis_agent.py:44`):

```python
# 如果有 hits，只保留前 30 个
if "hits" in data and len(data["hits"]) > 30:
    data["hits"] = data["hits"][:30]
    data["hits_truncated"] = True
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/tools/__init__.py backend/app/agent/analysis_agent.py
git commit -m "feat: register BLAST tool in agent dispatcher"
```

---

### Task 4: Update SYSTEM_PROMPT for BLAST

**Files:**
- Modify: `backend/app/routers/chat.py`

- [ ] **Step 1: Add BLAST section to SYSTEM_PROMPT**

In `backend/app/routers/chat.py`, append the following to `SYSTEM_PROMPT` string (before the closing `"""` at line 48):

```python

## BLAST 序列比对

当用户请求序列比对（如"比对"、"BLAST"、"同源"、"序列相似"、"序列比对"、"homolog"）时：
1. 根据序列类型自动选择 program：核酸序列用 blastn，蛋白序列用 blastp
2. 如果用户提供了 FASTA 格式序列，使用 query_type="sequence"
3. 如果用户提供了基因 ID，使用 query_type="gene_id"
4. 如果用户上传了文件（消息中包含文件路径），使用 query_type="file"
5. 默认数据库：核酸用 "MH63"，蛋白用 "MH63_pep"
6. 调用 blast_search 工具

BLAST 结果处理：
- 用中文解读 top 5 命中结果（相似度、E-value、覆盖度）
- 回复末尾追加（JSON 必须单行）：<!-- BLAST_DATA: {完整JSON} -->
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/routers/chat.py
git commit -m "feat: update SYSTEM_PROMPT with BLAST tool instructions"
```

---

### Task 5: Add FASTA file upload endpoint

**Files:**
- Modify: `backend/app/routers/analysis.py`

- [ ] **Step 1: Add upload endpoint**

Add import at top of `backend/app/routers/analysis.py`:

```python
from fastapi import APIRouter, HTTPException, UploadFile, File
```

Add endpoint (before the `# ============ 双轨分析 API 和 SSE ============` section):

```python
@router.post("/upload-fasta")
async def upload_fasta(file: UploadFile = File(...)):
    """上传 FASTA 文件，用于 BLAST 查询或建库"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # 验证扩展名
    allowed_exts = {".fa", ".fasta", ".fna", ".faa", ".fas", ".txt"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: {allowed_exts}")

    uploads_dir = Path(__file__).resolve().parent.parent.parent / "data" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    # 生成唯一文件名
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    dest = uploads_dir / safe_name

    content = await file.read()
    dest.write_bytes(content)

    return {"status": "success", "file_path": str(dest), "filename": file.filename}
```

Also add `from pathlib import Path` if not already imported (it's not — check the existing imports).

- [ ] **Step 2: Commit**

```bash
git add backend/app/routers/analysis.py
git commit -m "feat: add FASTA file upload endpoint for BLAST"
```

---

### Task 6: Create BlastResultCard component

**Files:**
- Create: `src/components/BlastResultCard.tsx`

- [ ] **Step 1: Create BlastResultCard.tsx**

```tsx
import { useState } from 'react'
import { Card, Table, Tag, Input, Space, Typography } from 'antd'

const { Text } = Typography

export interface BlastHit {
  query_id: string
  subject_id: string
  identity: number
  alignment_length: number
  mismatches: number
  gap_opens: number
  query_start: number
  query_end: number
  subject_start: number
  subject_end: number
  evalue: number
  bit_score: number
  query_coverage: number
  subject_title: string
}

export interface BlastResult {
  hits: BlastHit[]
  summary: {
    program: string
    database: string
    query_count: number
    total_hits: number
    top_hit_identity: number
    top_hit_evalue: number
  }
}

interface BlastResultCardProps {
  result: BlastResult
}

const getIdentityColor = (identity: number): string => {
  if (identity >= 95) return '#52c41a'
  if (identity >= 80) return '#1677ff'
  if (identity >= 60) return '#fa8c16'
  return '#ff4d4f'
}

export const BlastResultCard = ({ result }: BlastResultCardProps) => {
  const [searchText, setSearchText] = useState('')

  const filtered = result.hits.filter(h =>
    h.subject_id.toLowerCase().includes(searchText.toLowerCase()) ||
    h.subject_title.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns = [
    {
      title: 'Subject ID',
      dataIndex: 'subject_id',
      key: 'subject_id',
      ellipsis: true,
      width: 180,
      render: (text: string) => <Text style={{ fontSize: 13, fontFamily: 'monospace' }}>{text}</Text>,
    },
    {
      title: 'Identity%',
      dataIndex: 'identity',
      key: 'identity',
      width: 90,
      sorter: (a: BlastHit, b: BlastHit) => a.identity - b.identity,
      render: (v: number) => (
        <Tag color={getIdentityColor(v)} style={{ fontWeight: 600 }}>{v.toFixed(1)}%</Tag>
      ),
    },
    {
      title: 'E-value',
      dataIndex: 'evalue',
      key: 'evalue',
      width: 100,
      sorter: (a: BlastHit, b: BlastHit) => a.evalue - b.evalue,
      render: (v: number) => v === 0 ? '0.0' : v.toExponential(1),
    },
    {
      title: 'Bit Score',
      dataIndex: 'bit_score',
      key: 'bit_score',
      width: 90,
      sorter: (a: BlastHit, b: BlastHit) => a.bit_score - b.bit_score,
      render: (v: number) => v.toFixed(0),
    },
    {
      title: 'Coverage%',
      dataIndex: 'query_coverage',
      key: 'query_coverage',
      width: 90,
      sorter: (a: BlastHit, b: BlastHit) => a.query_coverage - b.query_coverage,
      render: (v: number) => `${v}%`,
    },
    {
      title: '比对长度',
      dataIndex: 'alignment_length',
      key: 'alignment_length',
      width: 80,
      sorter: (a: BlastHit, b: BlastHit) => a.alignment_length - b.alignment_length,
    },
  ]

  const expandedRowRender = (record: BlastHit) => (
    <div style={{ padding: '4px 0', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
      <span>Query: {record.query_start}-{record.query_end}</span>
      <span>Subject: {record.subject_start}-{record.subject_end}</span>
      <span>Mismatches: {record.mismatches}</span>
      <span>Gaps: {record.gap_opens}</span>
      {record.subject_title && <span>Description: {record.subject_title}</span>}
    </div>
  )

  return (
    <Card
      style={{ marginTop: 12, background: 'var(--color-bg-card, #1e1e2e)', border: '1px solid var(--color-border, #333)' }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <Tag color="cyan">{result.summary.program.toUpperCase()}</Tag>
        <Tag color="purple">DB: {result.summary.database}</Tag>
        <Text style={{ fontSize: 12, color: '#888' }}>
          命中: {result.summary.total_hits} | Top Identity: {result.summary.top_hit_identity.toFixed(1)}%
        </Text>
      </Space>

      <Input.Search
        placeholder="搜索 Subject ID 或描述..."
        size="small"
        style={{ marginBottom: 8, maxWidth: 300 }}
        onChange={e => setSearchText(e.target.value)}
      />

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey={(record, index) => `${record.subject_id}-${index}`}
        size="small"
        expandable={{ expandedRowRender }}
        pagination={{ pageSize: 10, size: 'small' }}
        scroll={{ x: 700 }}
      />
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BlastResultCard.tsx
git commit -m "feat: add BlastResultCard component"
```

---

### Task 7: Integrate BLAST into ChatPage

**Files:**
- Modify: `src/pages/ChatPage.tsx`
- Modify: `src/api/client.ts`

- [ ] **Step 1: Add uploadFasta to API client**

In `src/api/client.ts`, add to `analysisApi` object (after the `runEnrichment` entry):

```typescript
  // FASTA 文件上传（用于 BLAST）
  uploadFasta: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<{ file_path: string; filename: string }>>('/analysis/upload-fasta', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
```

- [ ] **Step 2: Add BLAST_DATA parser and import in ChatPage.tsx**

Add import at the top of `src/pages/ChatPage.tsx`:

```typescript
import { BlastResultCard, BlastResult } from '../components/BlastResultCard'
```

Add `'blast-result'` to the `type` union in `ChatMessage` interface:

```typescript
type?: 'text' | 'progress' | 'analysis' | 'result' | 'dataset-select' | 'dataset-selected' | 'step' | 'gene-query' | 'enrichment-prompt' | 'enrichment-loading' | 'enrichment-result' | 'blast-result'
```

Add `blastResult` field to `ChatMessage`:

```typescript
blastResult?: BlastResult
```

Add BLAST_DATA parser function (next to `tryParseEnrichmentResult`):

```typescript
  const tryParseBlastResult = (content: string): BlastResult | null => {
    if (!content) return null
    const match = content.match(/<!-- BLAST_DATA: (.+?) -->/)
    if (!match) return null
    try {
      return JSON.parse(match[1]) as BlastResult
    } catch {
      return null
    }
  }
```

- [ ] **Step 3: Add BLAST result rendering in `renderMessageContent`**

In `renderMessageContent`, add this block right before the `// 检测消息内容是否包含富集分析数据` comment (around line 1106):

```tsx
    // 检测消息内容是否包含 BLAST 比对数据
    const blastResult = tryParseBlastResult(msg.content)
    if (blastResult) {
      const cleanContent = msg.content.replace(/<!-- BLAST_DATA: .+? -->/, '').trim()
      return (
        <div>
          {cleanContent && (
            <div style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              padding: '12px 16px',
              borderRadius: 16,
              lineHeight: 1.6,
              marginBottom: 8,
              whiteSpace: 'pre-wrap',
            }}>
              {cleanContent}
            </div>
          )}
          <BlastResultCard result={blastResult} />
        </div>
      )
    }
```

- [ ] **Step 4: Add drag-and-drop FASTA upload to chat input**

Add state for uploaded file (near the other useState declarations):

```typescript
const [uploadedFile, setUploadedFile] = useState<{ path: string; name: string } | null>(null)
```

Add drag-drop handlers (before the `return` statement):

```typescript
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const exts = ['.fa', '.fasta', '.fna', '.faa', '.fas', '.txt']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!exts.includes(ext)) {
      message.error('请上传 FASTA 格式文件（.fa, .fasta, .fna, .faa）')
      return
    }
    try {
      const res = await analysisApi.uploadFasta(file)
      const data = (res.data as any).data ?? res.data
      setUploadedFile({ path: data.file_path, name: data.filename ?? file.name })
      message.success(`文件 ${file.name} 上传成功`)
    } catch (err: any) {
      message.error('文件上传失败: ' + (err.message || '未知错误'))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
```

Modify the input area wrapper div (the one with `padding: '0 24px 24px'` around line 1400) to add drag handlers:

```tsx
<div
  style={{ padding: '0 24px 24px', background: 'var(--color-bg-dark)' }}
  onDrop={handleDrop}
  onDragOver={handleDragOver}
>
```

Add uploaded file indicator above the TextArea (inside the input container div, before `<TextArea>`):

```tsx
{uploadedFile && (
  <Tag
    closable
    onClose={() => setUploadedFile(null)}
    style={{ marginRight: 8 }}
    color="cyan"
  >
    {uploadedFile.name}
  </Tag>
)}
```

Modify `handleSend` to include file path in message when a file is uploaded. In the `handleSend` function, before the final `const userMessage` creation (around line 338), add:

```typescript
    // 如果有上传文件，将文件路径附加到消息
    let finalContent = input.trim()
    if (uploadedFile) {
      finalContent += `\n[上传文件: ${uploadedFile.name}, 路径: ${uploadedFile.path}]`
    }
```

And change the `userMessage` creation to use `finalContent`:

```typescript
    const userMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: finalContent,
      timestamp: new Date().toString(),
    }
```

After the message is sent, clear the uploaded file:

```typescript
    setUploadedFile(null)
```

- [ ] **Step 5: Commit**

```bash
git add src/api/client.ts src/pages/ChatPage.tsx src/components/BlastResultCard.tsx
git commit -m "feat: integrate BLAST results and file upload into ChatPage"
```

---

### Task 8: Update TOOL_LIST display

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: Add BLAST tool to TOOL_LIST**

In `src/pages/ChatPage.tsx`, add to the `TOOL_LIST` array (after the enrichment_analysis entry, around line 728):

```typescript
    {
      name: 'blast_search',
      label: 'BLAST 序列比对',
      icon: '🧬',
      description: '使用本地 BLAST+ 进行序列比对分析。支持 blastn（核酸比核酸）、blastp（蛋白比蛋白）、blastx（核酸翻译比蛋白）、tblastn（蛋白比核酸翻译）。',
      usage: '帮我比对这条序列：ATGCGATCGATCG... 或拖拽 FASTA 文件到对话框',
      params: [
        { name: 'query', desc: 'FASTA 序列、基因 ID 或上传文件路径' },
        { name: 'program', desc: '"blastn" | "blastp" | "blastx" | "tblastn"，默认 blastn' },
        { name: 'database', desc: '目标数据库名称，默认 MH63' },
        { name: 'evalue', desc: 'E-value 阈值，默认 1e-5' },
        { name: 'max_hits', desc: '最大返回比对数，默认 50' },
      ],
      output: '返回 BLAST 比对命中表格，包含相似度、E-value、覆盖度等',
    },
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: add BLAST tool to /tools display list"
```

---

### Task 9: Final verification

- [ ] **Step 1: Verify backend imports**

```bash
cd backend && python -c "from app.tools.blast import blast_search, BLAST_SEARCH_SCHEMA; print('OK:', BLAST_SEARCH_SCHEMA['function']['name'])"
```

Expected: `OK: blast_search`

- [ ] **Step 2: Verify agent registration**

```bash
cd backend && python -c "from app.agent.analysis_agent import TOOLS, TOOL_HANDLERS; print('Tools:', len(TOOLS), 'Handlers:', list(TOOL_HANDLERS.keys()))"
```

Expected: `Tools: 3 Handlers: ['differential_expression_analysis', 'enrichment_analysis', 'blast_search']`

- [ ] **Step 3: Verify frontend builds**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors

- [ ] **Step 4: Final commit if any remaining changes**

```bash
git status
# if any unstaged changes:
git add -A && git commit -m "chore: final cleanup for BLAST tool integration"
```
