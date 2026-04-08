# KEGG/GO 富集分析工具设计

**日期**: 2026-04-08
**版本**: 1.0
**状态**: 已确认

---

## 一、概述

在现有差异表达分析（differential expression analysis）基础上，新增 KEGG 和 GO 富集分析工具。用户可通过三种方式触发富集分析：

1. **串联差异分析**：Agent 先做差异分析，自动将显著基因传入富集分析
2. **直接输入基因 ID**：用户提供逗号分隔的基因 ID 列表
3. **上传文件**：用户上传含基因列表的文件，前端解析后传给 Agent

结果以中文文字报告 + 交互式气泡图 + 可排序表格的形式展示。

---

## 二、技术架构

### 整体流程

```
用户输入（基因列表 / 差异分析结果 / 上传文件）
    ↓
Agent Loop（analysis_agent.py）
    ↓ 自动串联 or 直接调用
enrichment_analysis 工具（tools/enrichment.py）
    ↓ gseapy 调 Enrichr API
返回结构化 JSON（通路列表 + 统计）
    ↓
LLM 解读 top 通路 → 中文报告（嵌入 ENRICHMENT_DATA 标记）
    ↓
前端 EnrichmentResultCard 组件渲染气泡图 + 表格
```

### 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/tools/enrichment.py` | 新建 | 富集分析工具函数 + JSON schema |
| `backend/app/tools/__init__.py` | 修改 | 导出新工具 |
| `backend/app/agent/analysis_agent.py` | 修改 | 注册新工具到 TOOL_HANDLERS + TOOLS，更新 SYSTEM_PROMPT |
| `backend/requirements.txt` | 修改 | 添加 `gseapy>=1.0.0` |
| `src/components/EnrichmentResultCard.tsx` | 新建 | 气泡图 + 表格展示组件 |
| `src/pages/ChatPage.tsx` | 修改 | 解析富集结果并渲染组件 |

---

## 三、后端工具设计

### 3.1 工具函数签名

```python
# backend/app/tools/enrichment.py

def enrichment_analysis(
    gene_list: str,                          # 逗号分隔的基因 ID，如 "OsMH_01G0000400,OsMH_02G0001200"
    analysis_type: str = "both",             # "GO" | "KEGG" | "both"
    organism: str = "oryza sativa",          # 物种，默认水稻
    pvalue_cutoff: float = 0.05,             # p值阈值
    gene_sets: str = "GO_Biological_Process_2023",  # GO 数据库类型
) -> str:
    """对基因列表进行 KEGG 和/或 GO 富集分析。
    
    返回 JSON 字符串，包含富集通路列表和统计摘要。
    """
```

### 3.2 输出 JSON 结构

```json
{
  "kegg_results": [
    {
      "pathway": "Photosynthesis",
      "pathway_id": "osa00195",
      "gene_count": 12,
      "total_genes": 45,
      "pvalue": 0.0001,
      "adjusted_pvalue": 0.002,
      "enrichment_score": 3.2,
      "genes": ["OsMH_01G0000400", "OsMH_02G0001200"]
    }
  ],
  "go_results": [
    {
      "pathway": "response to stress",
      "pathway_id": "GO:0006950",
      "gene_count": 28,
      "total_genes": 120,
      "pvalue": 0.00003,
      "adjusted_pvalue": 0.0008,
      "enrichment_score": 2.8,
      "genes": ["OsMH_03G0104200", "OsMH_04G0440300"]
    }
  ],
  "summary": {
    "input_gene_count": 150,
    "kegg_significant": 8,
    "go_significant": 23,
    "top_kegg_pathway": "Photosynthesis",
    "top_go_term": "response to stress",
    "organism": "oryza sativa",
    "pvalue_cutoff": 0.05
  }
}
```

### 3.3 JSON Schema（供 LLM function calling）

```python
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
                    "description": "逗号分隔的基因 ID 列表，如 'OsMH_01G0000400,OsMH_02G0001200'"
                },
                "analysis_type": {
                    "type": "string",
                    "enum": ["GO", "KEGG", "both"],
                    "description": "分析类型：GO、KEGG 或两者都做，默认 both",
                    "default": "both"
                },
                "organism": {
                    "type": "string",
                    "description": "物种名称，默认 'oryza sativa'（水稻）",
                    "default": "oryza sativa"
                },
                "pvalue_cutoff": {
                    "type": "number",
                    "description": "p值阈值，默认 0.05",
                    "default": 0.05
                },
                "gene_sets": {
                    "type": "string",
                    "description": "GO 数据库类型，默认 GO_Biological_Process_2023",
                    "default": "GO_Biological_Process_2023"
                }
            },
            "required": ["gene_list"]
        }
    }
}
```

### 3.4 Agent 串联逻辑

Agent 的 SYSTEM_PROMPT 中新增说明：

```
当用户请求富集分析时：
1. 如果用户已有差异分析结果，从 significant_genes 中提取 gene_id 列表
2. 将基因 ID 用逗号拼接，调用 enrichment_analysis 工具
3. 用中文解读 top 5 KEGG 通路和 top 5 GO term
4. 在回复末尾嵌入：<!-- ENRICHMENT_DATA: {json} -->
```

---

## 四、前端组件设计

### 4.1 EnrichmentResultCard 组件

**文件**：`src/components/EnrichmentResultCard.tsx`

**结构**：
```
EnrichmentResultCard
├── 顶部：Radio 切换 KEGG / GO
├── Tab 1：气泡图（Recharts ScatterChart）
│   ├── X 轴：enrichment_score（富集倍数）
│   ├── Y 轴：pathway 名称（top 15）
│   ├── 气泡大小：gene_count
│   ├── 气泡颜色：adjusted_pvalue（红=显著，蓝=不显著）
│   └── Tooltip：通路名、p值、基因数、命中基因列表
└── Tab 2：结果表格（Ant Design Table）
    ├── 列：通路名 | 基因数 | 富集倍数 | p值 | adjusted p值
    ├── 可排序、可搜索
    └── 展开行：显示命中基因列表（Tag 形式）
```

**Props 接口**：
```typescript
interface EnrichmentResult {
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

interface PathwayResult {
  pathway: string
  pathway_id: string
  gene_count: number
  total_genes: number
  pvalue: number
  adjusted_pvalue: number
  enrichment_score: number
  genes: string[]
}

interface EnrichmentResultCardProps {
  result: EnrichmentResult
}
```

### 4.2 ChatPage 集成

在 `ChatPage.tsx` 中新增 `tryParseEnrichmentResult` 函数：

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

在消息渲染逻辑中，检测到富集数据时渲染 `EnrichmentResultCard`：

```typescript
const enrichmentResult = tryParseEnrichmentResult(msg.content)
if (enrichmentResult) {
  return (
    <>
      <div>{msg.content.replace(/<!-- ENRICHMENT_DATA: .+? -->/, '').trim()}</div>
      <EnrichmentResultCard result={enrichmentResult} />
    </>
  )
}
```

---

## 五、依赖

```
# backend/requirements.txt 新增
gseapy>=1.0.0
```

---

## 六、错误处理

| 场景 | 处理方式 |
|------|---------|
| 基因列表为空 | 返回 `{"error": "gene_list is empty"}` |
| gseapy 网络超时 | 捕获异常，返回 `{"error": "Enrichr API timeout, please retry"}` |
| 无显著富集结果 | 返回空列表 + summary 说明 `kegg_significant: 0` |
| 物种不支持 | 返回 `{"error": "Organism not supported: ..."}` |
| 基因 ID 格式不匹配 | gseapy 会忽略无效 ID，summary 中记录实际匹配数 |
