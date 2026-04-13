# KEGG/GO 富集分析实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 KEGG/GO 富集分析工具，集成到现有 Agent Loop，支持差异分析串联、直接输入基因 ID、上传文件三种触发方式，前端展示气泡图和表格。

**Architecture:** 后端新增 `tools/enrichment.py`（gseapy 调 Enrichr API），注册到 `analysis_agent.py` 的 TOOL_HANDLERS/TOOLS，LLM 解读结果后在回复中嵌入 `<!-- ENRICHMENT_DATA: {...} -->` 标记；前端新增 `EnrichmentResultCard.tsx` 组件（Recharts 气泡图 + Ant Design 表格），ChatPage 检测标记后渲染组件。

**Tech Stack:** Python gseapy>=1.0.0, FastAPI, React 18 + TypeScript, Recharts, Ant Design

---

## 文件变更一览

| 文件 | 操作 |
|------|------|
| `backend/app/tools/enrichment.py` | 新建 |
| `backend/app/tools/__init__.py` | 修改 |
| `backend/app/agent/analysis_agent.py` | 修改 |
| `backend/requirements.txt` | 修改 |
| `src/components/EnrichmentResultCard.tsx` | 新建 |
| `src/pages/ChatPage.tsx` | 修改 |

---

## Task 1: 安装依赖 + 创建 enrichment.py

**Files:**
- Create: `backend/app/tools/enrichment.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: 安装 gseapy**

```bash
cd D:/code/claude/breeding-scientist/backend && pip install "gseapy>=1.0.0"
```

期望输出：`Successfully installed gseapy-...`

- [ ] **Step 2: 在 requirements.txt 末尾添加依赖**

在 `backend/requirements.txt` 末尾追加一行：

```
gseapy>=1.0.0
```

- [ ] **Step 3: 创建 backend/app/tools/enrichment.py**

```python
"""KEGG/GO enrichment analysis tool - plain function + JSON schema for Agent Loop."""

import json
from typing import Any, Dict, List


def enrichment_analysis(
    gene_list: str,
    analysis_type: str = "both",
    organism: str = "oryza sativa",
    pvalue_cutoff: float = 0.05,
    gene_sets: str = "GO_Biological_Process_2023",
) -> str:
    """对基因列表进行 KEGG 和/或 GO 富集分析。

    Args:
        gene_list: 逗号分隔的基因 ID，如 "OsMH_01G0000400,OsMH_02G0001200"
        analysis_type: "GO" | "KEGG" | "both"，默认 "both"
        organism: 物种名称，默认 "oryza sativa"（水稻）
        pvalue_cutoff: p 值阈值，默认 0.05
        gene_sets: GO 数据库类型，默认 "GO_Biological_Process_2023"

    Returns:
        JSON 字符串，包含 kegg_results、go_results 和 summary。
    """
    result: Dict[str, Any] = {
        "kegg_results": [],
        "go_results": [],
        "summary": {},
    }

    if not gene_list or not gene_list.strip():
        return json.dumps({"error": "gene_list is empty"})

    genes: List[str] = [g.strip() for g in gene_list.split(",") if g.strip()]
    if not genes:
        return json.dumps({"error": "gene_list is empty"})

    try:
        import gseapy as gp

        kegg_results: List[Dict[str, Any]] = []
        go_results: List[Dict[str, Any]] = []

        def _parse_enr(df: Any) -> List[Dict[str, Any]]:
            rows = []
            df = df[df["Adjusted P-value"] <= pvalue_cutoff].head(20)
            for _, row in df.iterrows():
                overlap = str(row.get("Overlap", "0/0"))
                parts = overlap.split("/")
                hit_genes = [g.strip() for g in str(row.get("Genes", "")).split(";") if g.strip()]
                rows.append({
                    "pathway": str(row["Term"]),
                    "pathway_id": str(row.get("Gene_set", "")),
                    "gene_count": int(parts[0]) if parts[0].isdigit() else 0,
                    "total_genes": int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0,
                    "pvalue": float(row["P-value"]),
                    "adjusted_pvalue": float(row["Adjusted P-value"]),
                    "enrichment_score": float(row.get("Combined Score", 0)),
                    "genes": hit_genes,
                })
            return rows

        if analysis_type in ("KEGG", "both"):
            try:
                enr = gp.enrichr(
                    gene_list=genes,
                    gene_sets="KEGG_2021_Human",
                    organism=organism,
                    cutoff=pvalue_cutoff,
                )
                kegg_results = _parse_enr(enr.results)
            except Exception:
                kegg_results = []

        if analysis_type in ("GO", "both"):
            try:
                enr = gp.enrichr(
                    gene_list=genes,
                    gene_sets=gene_sets,
                    organism=organism,
                    cutoff=pvalue_cutoff,
                )
                go_results = _parse_enr(enr.results)
            except Exception:
                go_results = []

        result["kegg_results"] = kegg_results
        result["go_results"] = go_results
        result["summary"] = {
            "input_gene_count": len(genes),
            "kegg_significant": len(kegg_results),
            "go_significant": len(go_results),
            "top_kegg_pathway": kegg_results[0]["pathway"] if kegg_results else "",
            "top_go_term": go_results[0]["pathway"] if go_results else "",
            "organism": organism,
            "pvalue_cutoff": pvalue_cutoff,
        }

    except ImportError:
        return json.dumps({"error": "gseapy not installed. Run: pip install gseapy>=1.0.0"})
    except Exception as e:
        return json.dumps({"error": f"Enrichr API error: {str(e)}"})

    return json.dumps(result, ensure_ascii=False)


ENRICHMENT_ANALYSIS_SCHEMA = {
    "type": "function",
    "function": {
        "name": "enrichment_analysis",
        "description": (
            "对基因列表进行 KEGG 通路富集分析和 GO 功能富集分析。"
            "可接受差异分析结果中的显著基因，或用户直接提供的基因 ID 列表。"
            "返回富集通路列表、统计数据和摘要。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "gene_list": {
                    "type": "string",
                    "description": "逗号分隔的基因 ID 列表，如 'OsMH_01G0000400,OsMH_02G0001200'",
                },
                "analysis_type": {
                    "type": "string",
                    "enum": ["GO", "KEGG", "both"],
                    "description": "分析类型：GO、KEGG 或两者都做，默认 both",
                    "default": "both",
                },
                "organism": {
                    "type": "string",
                    "description": "物种名称，默认 'oryza sativa'（水稻）",
                    "default": "oryza sativa",
                },
                "pvalue_cutoff": {
                    "type": "number",
                    "description": "p 值阈值，默认 0.05",
                    "default": 0.05,
                },
                "gene_sets": {
                    "type": "string",
                    "description": "GO 数据库类型，默认 GO_Biological_Process_2023",
                    "default": "GO_Biological_Process_2023",
                },
            },
            "required": ["gene_list"],
        },
    },
}
```

- [ ] **Step 4: 验证可导入**

```bash
cd D:/code/claude/breeding-scientist && python -c "from backend.app.tools.enrichment import enrichment_analysis, ENRICHMENT_ANALYSIS_SCHEMA; print('OK')"
```

期望：`OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/tools/enrichment.py backend/requirements.txt
git commit -m "feat: add enrichment_analysis tool with gseapy"
```

---

## Task 2: 注册工具到 tools/__init__.py

**Files:**
- Modify: `backend/app/tools/__init__.py`

- [ ] **Step 1: 替换 __init__.py 内容**

将 `backend/app/tools/__init__.py` 完整替换为：

```python
from .differential import differential_expression_analysis, DIFFERENTIAL_ANALYSIS_SCHEMA
from .enrichment import enrichment_analysis, ENRICHMENT_ANALYSIS_SCHEMA

__all__ = [
    "differential_expression_analysis",
    "DIFFERENTIAL_ANALYSIS_SCHEMA",
    "enrichment_analysis",
    "ENRICHMENT_ANALYSIS_SCHEMA",
]
```

- [ ] **Step 2: 验证导入**

```bash
cd D:/code/claude/breeding-scientist && python -c "from backend.app.tools import enrichment_analysis, ENRICHMENT_ANALYSIS_SCHEMA; print('OK')"
```

期望：`OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/tools/__init__.py
git commit -m "feat: export enrichment tool from tools package"
```

---

## Task 3: 注册工具到 analysis_agent.py + 更新 SYSTEM_PROMPT

**Files:**
- Modify: `backend/app/agent/analysis_agent.py`

- [ ] **Step 1: 添加 import**

在 `analysis_agent.py` 现有 `from app.tools.differential import ...` 行之后添加：

```python
from app.tools.enrichment import (
    ENRICHMENT_ANALYSIS_SCHEMA,
    enrichment_analysis,
)
```

- [ ] **Step 2: 更新 TOOL_HANDLERS**

将 `TOOL_HANDLERS` 字典替换为：

```python
TOOL_HANDLERS = {
    "differential_expression_analysis": differential_expression_analysis,
    "enrichment_analysis": enrichment_analysis,
}
```

- [ ] **Step 3: 更新 TOOLS 列表**

将 `TOOLS` 列表替换为：

```python
TOOLS = [DIFFERENTIAL_ANALYSIS_SCHEMA, ENRICHMENT_ANALYSIS_SCHEMA]
```

- [ ] **Step 4: 在 SYSTEM_PROMPT 末尾追加富集分析指令**

找到 SYSTEM_PROMPT 字符串的结尾引号，在其之前追加：

```
\n\n当用户请求富集分析时：\n1. 如果用户已有差异分析结果，从 significant_genes 中提取所有 gene_id，用逗号拼接后调用 enrichment_analysis 工具。\n2. 如果用户直接提供基因 ID 列表，直接调用 enrichment_analysis 工具。\n3. 工具返回结果后，用中文解读 top 5 KEGG 通路和 top 5 GO term（通路名称、富集倍数、显著基因数）。\n4. 在回复正文末尾追加一行（JSON 必须单行不换行）：<!-- ENRICHMENT_DATA: {工具返回的完整 JSON} -->
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/analysis_agent.py
git commit -m "feat: register enrichment_analysis in agent loop"
```

---

## Task 4: 创建前端 EnrichmentResultCard 组件

**Files:**
- Create: `src/components/EnrichmentResultCard.tsx`

- [ ] **Step 1: 创建 src/components/EnrichmentResultCard.tsx**

```tsx
import { useState } from 'react'
import { Card, Radio, Table, Tag, Input, Space, Typography } from 'antd'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const { Text } = Typography

export interface PathwayResult {
  pathway: string
  pathway_id: string
  gene_count: number
  total_genes: number
  pvalue: number
  adjusted_pvalue: number
  enrichment_score: number
  genes: string[]
}

export interface EnrichmentResult {
  kegg_results: PathwayResult[]
  go_results: PathwayResult[]
  summary: {
    input_gene_count: number
    kegg_significant: number
    go_significant: number
    top_kegg_pathway: string
    top_go_term: string
    organism: string
    pvalue_cutoff: number
  }
}

interface EnrichmentResultCardProps {
  result: EnrichmentResult
}

const getBubbleColor = (adjP: number): string => {
  if (adjP <= 0.001) return '#cf1322'
  if (adjP <= 0.01) return '#fa541c'
  if (adjP <= 0.05) return '#fa8c16'
  return '#1677ff'
}

const getBubbleSize = (geneCount: number, maxCount: number): number => {
  if (maxCount === 0) return 10
  return 10 + (geneCount / maxCount) * 30
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d: PathwayResult = payload[0].payload
  return (
    <div style={{
      background: 'var(--color-bg-card, #1e1e2e)',
      border: '1px solid var(--color-border, #333)',
      borderRadius: 8,
      padding: '10px 14px',
      maxWidth: 280,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>{d.pathway}</div>
      <div style={{ fontSize: 12, color: '#aaa' }}>ID: {d.pathway_id}</div>
      <div style={{ fontSize: 12 }}>富集倍数: <b>{d.enrichment_score.toFixed(2)}</b></div>
      <div style={{ fontSize: 12 }}>基因数: <b>{d.gene_count}</b></div>
      <div style={{ fontSize: 12 }}>adj.P: <b>{d.adjusted_pvalue.toExponential(2)}</b></div>
      <div style={{ fontSize: 11, marginTop: 4, color: '#aaa' }}>
        {d.genes.slice(0, 6).join(', ')}{d.genes.length > 6 ? ` ...+${d.genes.length - 6}` : ''}
      </div>
    </div>
  )
}

export const EnrichmentResultCard = ({ result }: EnrichmentResultCardProps) => {
  const [dbType, setDbType] = useState<'KEGG' | 'GO'>('KEGG')
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
  const [searchText, setSearchText] = useState('')

  const data = dbType === 'KEGG' ? result.kegg_results : result.go_results
  const top15 = data.slice(0, 15)
  const maxCount = Math.max(...top15.map(d => d.gene_count), 1)

  const filtered = data.filter(d =>
    d.pathway.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns = [
    {
      title: '通路/Term',
      dataIndex: 'pathway',
      key: 'pathway',
      ellipsis: true,
      render: (text: string) => <Text style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: '基因数',
      dataIndex: 'gene_count',
      key: 'gene_count',
      width: 80,
      sorter: (a: PathwayResult, b: PathwayResult) => a.gene_count - b.gene_count,
    },
    {
      title: '富集倍数',
      dataIndex: 'enrichment_score',
      key: 'enrichment_score',
      width: 100,
      sorter: (a: PathwayResult, b: PathwayResult) => a.enrichment_score - b.enrichment_score,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: 'P值',
      dataIndex: 'pvalue',
      key: 'pvalue',
      width: 100,
      sorter: (a: PathwayResult, b: PathwayResult) => a.pvalue - b.pvalue,
      render: (v: number) => v.toExponential(2),
    },
    {
      title: 'adj.P值',
      dataIndex: 'adjusted_pvalue',
      key: 'adjusted_pvalue',
      width: 100,
      sorter: (a: PathwayResult, b: PathwayResult) => a.adjusted_pvalue - b.adjusted_pvalue,
      render: (v: number) => v.toExponential(2),
    },
  ]

  const expandedRowRender = (record: PathwayResult) => (
    <div style={{ padding: '4px 0' }}>
      {record.genes.map(g => (
        <Tag key={g} color="blue" style={{ marginBottom: 4 }}>{g}</Tag>
      ))}
    </div>
  )

  return (
    <Card
      style={{ marginTop: 12, background: 'var(--color-bg-card, #1e1e2e)', border: '1px solid var(--color-border, #333)' }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <Radio.Group value={dbType} onChange={e => setDbType(e.target.value)} buttonStyle="solid" size="small">
          <Radio.Button value="KEGG">KEGG ({result.summary.kegg_significant})</Radio.Button>
          <Radio.Button value="GO">GO ({result.summary.go_significant})</Radio.Button>
        </Radio.Group>
        <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)} buttonStyle="solid" size="small">
          <Radio.Button value="chart">气泡图</Radio.Button>
          <Radio.Button value="table">表格</Radio.Button>
        </Radio.Group>
        <Text style={{ fontSize: 12, color: '#888' }}>
          输入基因数: {result.summary.input_gene_count} | 物种: {result.summary.organism}
        </Text>
      </Space>

      {viewMode === 'chart' && (
        top15.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>
            无显著富集结果（adj.P ≤ {result.summary.pvalue_cutoff}）
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(300, top15.length * 28)}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 200 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                type="number"
                dataKey="enrichment_score"
                name="富集倍数"
                label={{ value: '富集倍数 (Combined Score)', position: 'insideBottom', offset: -15, fill: '#aaa', fontSize: 12 }}
                tick={{ fill: '#aaa', fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="pathway"
                name="通路"
                width={190}
                tick={{ fill: '#ccc', fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={top15}>
                {top15.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={getBubbleColor(entry.adjusted_pvalue)}
                    r={getBubbleSize(entry.gene_count, maxCount)}
                    fillOpacity={0.85}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )
      )}

      {viewMode === 'table' && (
        <>
          <Input.Search
            placeholder="搜索通路名称..."
            size="small"
            style={{ marginBottom: 8, maxWidth: 300 }}
            onChange={e => setSearchText(e.target.value)}
          />
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="pathway_id"
            size="small"
            expandable={{ expandedRowRender }}
            pagination={{ pageSize: 10, size: 'small' }}
            scroll={{ x: 600 }}
          />
        </>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EnrichmentResultCard.tsx
git commit -m "feat: add EnrichmentResultCard component with bubble chart and table"
```

---

## Task 5: 集成到 ChatPage.tsx

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: 添加 import**

在 `src/pages/ChatPage.tsx` 顶部现有 import 列表末尾添加：

```typescript
import { EnrichmentResultCard, EnrichmentResult } from '../components/EnrichmentResultCard'
```

- [ ] **Step 2: 添加 tryParseEnrichmentResult 函数**

在 `tryParseAnalysisResult` 函数定义之后，紧接着添加：

```typescript
const tryParseEnrichmentResult = (content: string): EnrichmentResult | null => {
  const match = content.match(/<!-- ENRICHMENT_DATA: (.+?) -->/)
  if (!match) return null
  try {
    return JSON.parse(match[1]) as EnrichmentResult
  } catch {
    return null
  }
}
```

- [ ] **Step 3: 在 renderMessageContent 中添加富集结果渲染**

在 `renderMessageContent` 函数中，`tryParseAnalysisResult` 检测块之前插入：

```typescript
// 检测消息内容是否包含富集分析数据
const enrichmentResult = tryParseEnrichmentResult(msg.content)
if (enrichmentResult) {
  const cleanContent = msg.content.replace(/<!-- ENRICHMENT_DATA: .+? -->/, '').trim()
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
      <EnrichmentResultCard result={enrichmentResult} />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: integrate EnrichmentResultCard into ChatPage"
```

---

## Task 6: 端到端验证

- [ ] **Step 1: 启动后端（手动在终端运行）**

```bash
cd D:/code/claude/breeding-scientist/backend && uvicorn app.main:app --reload --port 8000
```

- [ ] **Step 2: 启动前端（手动在终端运行）**

```bash
cd D:/code/claude/breeding-scientist && npm run dev
```

- [ ] **Step 3: 测试直接输入基因 ID**

在聊天框输入：
```
对以下基因做 KEGG 和 GO 富集分析：OsMH_01G0000400,OsMH_02G0001200,OsMH_03G0104200
```

期望：Agent 调用 `enrichment_analysis` 工具，返回中文解读 + 气泡图组件。

- [ ] **Step 4: 测试串联差异分析**

在聊天框输入：
```
先做差异分析，然后对显著基因做富集分析
```

期望：Agent 先调 `differential_expression_analysis`，再自动调 `enrichment_analysis`，最终展示富集结果卡片。

- [ ] **Step 5: 最终 Commit**

```bash
git add -A && git commit -m "feat: complete KEGG/GO enrichment analysis feature"
```

