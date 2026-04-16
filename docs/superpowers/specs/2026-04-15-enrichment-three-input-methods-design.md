# 富集分析三种输入方式设计

**日期**: 2026-04-15
**状态**: 已批准
**方案**: 纯 Agent 增强（方案 A）
**展示位置**: ChatPage 聊天页面

## 概述

为富集分析功能增加三种输入方式，全部在聊天页面中操作，通过 Agent 统一处理：

1. **直接输入** — 自然语言 + 基因列表
2. **文件上传** — 基因ID列表文件 (.txt) 或差异分析结果 CSV
3. **内置数据** — 使用差异分析结果中的显著基因

## 后端改动

### enrichment.py — 扩展输入参数

当前 `enrichment_analysis()` 只接受 `gene_list: str`（逗号分隔的基因ID）。扩展为三种输入源：

```python
def enrichment_analysis(
    gene_list: str = "",           # 方式1：直接输入基因ID列表（逗号分隔）
    gene_file_path: str = "",      # 方式2：基因列表文件路径
    analysis_result_id: str = "",  # 方式3：引用差异分析结果的 job_id
    analysis_type: str = "both",
    pvalue_cutoff: float = 0.05,
) -> str:
```

**基因提取优先级**（互斥，按优先级取第一个非空的）：

1. `gene_list` 非空 → 直接使用（现有逻辑，兼容不变）
2. `gene_file_path` 非空 → 读取文件，支持两种格式：
   - 纯基因ID文件：每行一个基因ID，或逗号/制表符分隔
   - 差异分析结果 CSV：自动检测含 `gene_id` + `pvalue`/`log2fc` 列 → 按默认阈值（pvalue ≤ 0.05, |log2fc| ≥ 1）筛选显著基因
3. `analysis_result_id` 非空 → 从 `backend/data/analysis_results/{id}.json` 读取 `tool_result.all_significant_genes` 或 `tool_result.significant_genes`

三种输入至少需要提供一种，否则返回错误。

### analysis_agent.py — 更新工具 Schema

更新 `ENRICHMENT_ANALYSIS_SCHEMA`，增加两个新参数：

```python
"gene_file_path": {
    "type": "string",
    "description": "基因列表文件路径（.txt 每行一个基因ID，或差异分析结果 CSV）",
},
"analysis_result_id": {
    "type": "string",
    "description": "差异分析结果 ID（如 job_xxxxxxxx），从中提取显著基因进行富集分析",
},
```

`required` 字段从 `["gene_list"]` 改为 `[]`（三种输入互斥，至少提供一种）。

### analysis router — 新增文件上传端点

新增 `POST /api/analysis/upload-genelist` 端点：

- 接受文件类型：.txt, .csv, .tsv
- 解析逻辑：
  - 尝试读取为 CSV/TSV，检查是否包含 `gene_id` 列
  - 如果是结构化数据（有 pvalue/log2fc 列）→ 按阈值筛选，返回显著基因列表
  - 如果是纯文本 → 按行/逗号分割，返回基因ID列表
- 返回格式：
  ```json
  {
    "status": "success",
    "data": {
      "file_path": "/path/to/uploaded/file",
      "filename": "genes.txt",
      "gene_count": 156,
      "gene_preview": ["OsMH_01G0000400", "OsMH_02G0001200", ...],  // 前 10 个
      "file_type": "gene_list" | "diff_result"
    }
  }
  ```
- 保存文件到 `backend/data/uploads/`

## 前端改动

### ChatPage — 去掉规则识别

删除 `detectEnrichmentIntent()` 函数及相关调用。富集分析意图完全由 Agent（LLM）判断，不再使用前端关键词规则。

### ChatPage — 文件上传确认卡片

**文件类型区分**：用户上传文件时，前端先调用 `POST /api/analysis/upload-genelist` 尝试解析。如果成功检测到基因ID → 走富集流程；如果解析失败（如文件是表达矩阵格式）→ 回退到现有的差异分析上传流程（upload-matrix）。

用户上传基因列表文件时的交互流程：

1. 用户通过聊天附件上传 .txt/.csv 文件
2. 前端调用 `POST /api/analysis/upload-genelist` 解析文件
3. 显示确认卡片：
   - 卡片内容："检测到 N 个基因ID（预览：OsMH_01G..., OsMH_02G..., ...），是否进行富集分析？"
   - 两个按钮："开始富集分析" / "取消"
4. 用户点击确认 → 发送消息给 Agent，包含 `gene_file_path`
5. Agent 调用 `enrichment_analysis(gene_file_path=...)` 并返回结果

新增消息类型：`enrichment-file-confirm`

### ChatPage — 内置数据走 Agent

修改现有"立即富集"按钮的处理逻辑：

- 当前：直接调用 `analysisApi.runEnrichment(geneIds)` API
- 改为：构造消息发送给 Agent，内容类似"请对差异分析结果 {job_id} 中的显著基因进行富集分析"
- Agent 调用 `enrichment_analysis(analysis_result_id=job_id)`
- 结果通过 Agent 返回，包含 AI 解读

### 结果展示

复用现有 `EnrichmentResultCard` 组件，无需改动。Agent 返回的富集结果通过 `<!-- ENRICHMENT_DATA: ... -->` 标记嵌入消息中，前端已能自动识别和渲染。

## 数据流总览

```
方式1 - 自然语言输入:
  用户输入 "帮我对这些基因做富集分析：OsMH_01G..."
  → ChatPage 发送到 /api/chat/
  → Agent 识别意图 + 提取基因列表
  → 调用 enrichment_analysis(gene_list="OsMH_01G...")
  → 返回结果 + AI 解读
  → 前端渲染 EnrichmentResultCard

方式2 - 文件上传:
  用户上传 .txt/.csv 文件
  → 前端调用 POST /api/analysis/upload-genelist
  → 返回基因预览卡片（N个基因，确认/取消）
  → 用户确认 → 发送消息给 Agent
  → Agent 调用 enrichment_analysis(gene_file_path="...")
  → 返回结果 + AI 解读
  → 前端渲染 EnrichmentResultCard

方式3 - 内置数据（差异分析结果）:
  差异分析完成 → 显示"立即富集"提示卡片
  → 用户点击"立即富集"
  → 发送消息给 Agent
  → Agent 调用 enrichment_analysis(analysis_result_id="job_xxx")
  → 返回结果 + AI 解读
  → 前端渲染 EnrichmentResultCard
```

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `backend/app/tools/enrichment.py` | 修改 | 扩展 enrichment_analysis 函数，增加 gene_file_path 和 analysis_result_id 参数 |
| `backend/app/agent/analysis_agent.py` | 修改 | 更新 ENRICHMENT_ANALYSIS_SCHEMA |
| `backend/app/routers/analysis.py` | 修改 | 新增 POST /api/analysis/upload-genelist 端点 |
| `src/pages/ChatPage.tsx` | 修改 | 文件上传确认卡片、去掉 detectEnrichmentIntent、内置数据走 Agent |
| `src/api/client.ts` | 修改 | 新增 uploadGeneList API 调用 |
