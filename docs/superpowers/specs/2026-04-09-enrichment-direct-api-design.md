# 富集分析直接 API 调用设计

## 背景

当前富集分析流程存在两个问题：
1. `handleEnrichmentFromResult()` 读取 `significant_genes`（仅 top10 上调 + top10 下调 = 最多 20 个），而非 `all_significant_genes`（全部显著基因）
2. 富集分析通过发送聊天消息给 Agent 循环处理，增加了不必要的 LLM 调用延迟

## 目标

- 使用全部显著基因进行富集分析
- 前端直接调用后端 REST API，不经过 Agent 循环
- 点击"立即富集"后原地显示加载动画，完成后替换为结果卡片

## 设计

### 后端：新增 REST 端点

新增 `POST /api/analysis/enrichment`，位于 `backend/app/routers/analysis.py`。

**请求体：**
```json
{
  "gene_list": ["OsMH63_01G000010", "OsMH63_02G000020", ...],
  "analysis_type": "both",
  "pvalue_cutoff": 0.05
}
```

**响应体：**
```json
{
  "status": "success",
  "data": {
    "kegg_results": [...],
    "go_results": [...],
    "summary": "共分析 N 个基因，发现 X 个显著 KEGG 通路，Y 个显著 GO 条目"
  }
}
```

**实现：**
- 直接 import 并调用 `enrichment.py` 中的 `enrichment_analysis()` 函数
- 将 `gene_list` 数组 join 为逗号分隔字符串传入
- 解析返回的 JSON 字符串，提取 `kegg_results`、`go_results`、`summary`

### 前端：API 客户端

在 `src/api/client.ts` 新增：

```typescript
export async function runEnrichmentAnalysis(
  geneList: string[],
  analysisType?: string,
  pvalueCutoff?: number
): Promise<EnrichmentResult>
```

### 前端：ChatPage 交互改造

修改 `handleEnrichmentFromResult()`：

1. 从 `all_significant_genes`（而非 `significant_genes`）获取基因列表，兼容旧数据回退到 `significant_genes`
2. 移除 enrichment-prompt 消息
3. 插入一条 `type: 'enrichment-loading'` 的消息，显示 Spin + "正在对 N 个显著基因进行富集分析..."
4. 调用 `runEnrichmentAnalysis(geneIds)`
5. 请求成功后，将 loading 消息替换为 `type: 'enrichment-result'` 消息，渲染 `EnrichmentResultCard`
6. 请求失败时，将 loading 消息替换为错误提示

### 消息类型扩展

在 `ChatMessage` 类型中新增：
- `type: 'enrichment-loading'` — 加载状态
- `type: 'enrichment-result'` — 富集结果
- `enrichmentResult?: EnrichmentResult` — 存储富集分析结果

### 渲染逻辑

在 ChatPage 的消息渲染区域：
- `enrichment-loading`：显示 `<Spin />` + 提示文字，居中显示
- `enrichment-result`：渲染 `<EnrichmentResultCard result={msg.enrichmentResult} />`

## 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/app/routers/analysis.py` | 新增 `POST /api/analysis/enrichment` 端点 |
| `src/api/client.ts` | 新增 `runEnrichmentAnalysis()` 函数 |
| `src/pages/ChatPage.tsx` | 改造 `handleEnrichmentFromResult()`，新增消息类型渲染 |

## 不变的部分

- `EnrichmentResultCard.tsx` 组件不需要修改，复用现有渲染逻辑
- `enrichment.py` 核心逻辑不变
- Agent 循环中的富集分析能力保留（用户也可以通过自然语言触发）
