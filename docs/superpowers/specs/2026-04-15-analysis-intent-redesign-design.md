# 差异分析交互流程重设计

## 问题

当前前端 `ChatPage.tsx` 的 `detectAnalysisIntent()` 使用关键词匹配，只要用户输入中包含"差异分析"等关键词就直接弹出选择卡片，跳过 AI 对话。即使用户只是在聊天中提到这个词（如"差异分析是什么？"），也会被拦截，体验很差。

## 目标

- 自然语言统一走 AI 对话，由 Agent 判断意图后在回复中附带"开始分析"按钮
- 斜杠命令（`/analyze`、`/diff`）保留直接触发选择卡片的行为

## 改后流程

```
自然语言路径：
  用户输入"帮我做差异分析"
  → 发给后端 Agent
  → Agent 回复解读 + 末尾追加 <!-- ANALYSIS_READY -->
  → 前端检测到标记 → 在 AI 回复下方渲染"开始差异分析"按钮
  → 用户点击 → 弹出选择卡片（内置数据集 / 上传文件 / 手动输入）

斜杠命令路径（保持不变）：
  用户输入 /analyze 或 /diff
  → 前端直接弹出选择卡片
```

## 后端改动

### `backend/app/routers/chat.py` — SYSTEM_PROMPT

在差异表达分析部分追加规则：

```
当用户表达了差异分析意图（如"帮我做差异分析"、"分析差异基因"、"比较WT和osbzip23"），
但没有提供具体数据集或明确的分析参数时：
1. 先用中文回复，简要说明你可以帮助进行差异分析，并询问用户的数据来源
2. 在回复末尾追加标记（必须单独一行）：<!-- ANALYSIS_READY -->
3. 不要直接调用 differential_expression_analysis 工具

当用户已经提供了明确的数据集路径和分组信息时，直接调用工具，不追加标记。
```

### 不改动

- `analysis_agent.py` 工具注册
- `differential.py` 分析逻辑
- 双轨分析 API（`/api/analysis/compare`、`/api/analysis/stream`）

## 前端改动

### `src/pages/ChatPage.tsx`

1. **`detectAnalysisIntent()` 改造**：只检测 `/analyze`、`/diff`，移除自然语言关键词

2. **新增 `parseAnalysisReady(content: string)`**：
   - 检测 `<!-- ANALYSIS_READY -->` 标记
   - 返回 `{ hasIntent: boolean, cleanContent: string }`

3. **消息渲染调整**：
   - `renderMessageContent()` 中对 assistant 消息调用 `parseAnalysisReady()`
   - 检测到标记时，渲染干净的文本内容 + "开始差异分析"按钮
   - 按钮点击触发现有的选择卡片流程（内置数据集 / 上传 / 手动输入）

### 不改动

- 选择卡片 UI 和逻辑
- 双轨分析 SSE 流程
- 结果展示卡片

## 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/app/routers/chat.py` | SYSTEM_PROMPT 追加 ANALYSIS_READY 标记规则 |
| `src/pages/ChatPage.tsx` | detectAnalysisIntent 精简 + parseAnalysisReady 新增 + 渲染逻辑调整 |
