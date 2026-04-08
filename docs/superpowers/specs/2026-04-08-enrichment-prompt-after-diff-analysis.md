# 差异分析后富集分析提示设计文档

**日期**: 2026-04-08  
**状态**: 已批准

## 需求

差异分析完成后，在聊天流中自动出现一条 assistant 消息，提示用户是否对全部显著差异基因进行富集分析。用户点击"立即富集"后直接触发富集分析，无需手动输入。

## 设计

### 数据流

1. 差异分析 SSE 完成（`data.result` 存在）时，在更新 `analysisResult` 的同时，追加一条 `type: 'enrichment-prompt'` 的 assistant 消息
2. 该消息携带 `analysisResult`，渲染为提示卡片：
   - 文案：「差异分析完成，共发现 **X** 个显著基因。是否对全部基因进行富集分析？」
   - 两个按钮：[立即富集] [跳过]
3. 点击"立即富集"：
   - 从 `analysisResult.tool_result.significant_genes` 提取所有 `gene_id`，拼接为逗号分隔字符串
   - 移除该提示消息
   - 追加用户消息：「对以下基因做富集分析：{gene_ids}」
   - 调用 `handleNormalChat` 走现有 agent loop
   - 结果通过现有 `EnrichmentResultCard` 渲染
4. 点击"跳过"：移除该提示消息

### 涉及改动

**`src/pages/ChatPage.tsx`**

- `ChatMessage` 类型：新增 `type: 'enrichment-prompt'`
- SSE `onmessage` 回调：分析完成时追加 enrichment-prompt 消息
- `renderMessageContent`：新增 `enrichment-prompt` 分支，渲染提示卡片
- 新增 `handleEnrichmentFromResult(analysisResult)` 函数：提取基因列表、移除提示消息、触发富集分析

### 不涉及改动

- 后端无需改动，复用现有 `/api/chat/` agent loop
- `EnrichmentResultCard` 无需改动
- `DualTrackResultCard` 无需改动

## 关键约束

- 基因列表来源：`result.tool_result.significant_genes`（前端已有，无需额外请求）
- 若 `significant_genes` 为空，不显示提示消息
- 提示消息只出现一次，点击任意按钮后消失
