# 差异分析交互流程重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除前端关键词拦截，改为 AI 判断意图后在回复中附带"开始分析"按钮，斜杠命令保留直接触发

**Architecture:** 后端 Agent 在 SYSTEM_PROMPT 中新增规则，当判断用户有分析意图但未提供数据时，回复末尾追加 `<!-- ANALYSIS_READY -->` 标记。前端解析标记并渲染按钮，点击后触发现有选择卡片流程。

**Tech Stack:** FastAPI (后端), React + TypeScript (前端), OpenAI function calling

---

## Task 1: 后端 SYSTEM_PROMPT 追加标记规则

**Files:**
- Modify: `backend/app/routers/chat.py:17-73`

- [ ] **Step 1: 在 SYSTEM_PROMPT 的差异表达分析部分追加规则**

在 `chat.py:23-42` 的差异表达分析部分末尾（第 42 行 `- 处理组（osbzip23）：DS_osbzip23_rep1, DS_osbzip23_rep2` 之后）追加：

```python
## 差异表达分析意图识别

当用户表达了差异分析意图（如"帮我做差异分析"、"分析差异基因"、"比较WT和osbzip23"），
但没有提供具体数据集或明确的分析参数时：
1. 先用中文回复，简要说明你可以帮助进行差异分析，并询问用户的数据来源
2. 在回复末尾追加标记（必须单独一行）：<!-- ANALYSIS_READY -->
3. 不要直接调用 differential_expression_analysis 工具

当用户已经提供了明确的数据集路径和分组信息时，直接调用工具，不追加标记。
```

- [ ] **Step 2: 验证 SYSTEM_PROMPT 格式**

运行后端服务，确保没有语法错误：

```bash
cd backend
PYTHONPATH=backend uvicorn app.main:app --reload --port 8003
```

Expected: 服务正常启动，无报错

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/chat.py
git commit -m "feat: add ANALYSIS_READY marker rule to chat agent

Agent 在判断用户有差异分析意图但未提供数据时，回复末尾追加标记"
```

## Task 2: 前端精简 detectAnalysisIntent 函数

**Files:**
- Modify: `src/pages/ChatPage.tsx:187-192`

- [ ] **Step 1: 移除自然语言关键词，只保留斜杠命令**

将 `detectAnalysisIntent` 函数（第 188-192 行）改为：

```typescript
// 识别差异表达分析意图（仅斜杠命令）
const detectAnalysisIntent = (text: string): boolean => {
  const commands = ['/analyze', '/diff', '/analyse']
  return commands.some(cmd => text.toLowerCase().startsWith(cmd))
}
```

- [ ] **Step 2: 验证语法**

```bash
npm run build
```

Expected: 编译成功，无 TypeScript 错误

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "refactor: simplify detectAnalysisIntent to slash commands only

移除自然语言关键词匹配，只保留 /analyze /diff 命令检测"
```

## Task 3: 前端新增 parseAnalysisReady 函数

**Files:**
- Modify: `src/pages/ChatPage.tsx:193` (在 `detectAnalysisIntent` 之后插入)

- [ ] **Step 1: 新增解析函数**

在 `detectAnalysisIntent` 函数之后（第 193 行）插入：

```typescript
// 解析 AI 回复中的 ANALYSIS_READY 标记
const parseAnalysisReady = (content: string): { hasIntent: boolean; cleanContent: string } => {
  const marker = '<!-- ANALYSIS_READY -->'
  const hasIntent = content.includes(marker)
  const cleanContent = content.replace(marker, '').trim()
  return { hasIntent, cleanContent }
}
```

- [ ] **Step 2: 验证语法**

```bash
npm run build
```

Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: add parseAnalysisReady to detect AI intent marker

解析 <!-- ANALYSIS_READY --> 标记并返回干净内容"
```

## Task 4: 前端调整消息渲染逻辑

**Files:**
- Modify: `src/pages/ChatPage.tsx:1375-1409`

- [ ] **Step 1: 在普通文本消息渲染中添加标记检测和按钮**

将 `renderMessageContent` 函数中的普通文本消息部分（第 1375-1409 行）改为：

```typescript
// 普通文本消息
const { hasIntent, cleanContent } = msg.role === 'assistant' 
  ? parseAnalysisReady(msg.content) 
  : { hasIntent: false, cleanContent: msg.content }

return (
  <div>
    <div style={{
      background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-card)',
      color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
      padding: '12px 16px',
      borderRadius: 16,
      lineHeight: 1.6
    }}>
      {msg.role === 'assistant' ? (
        <div className="markdown-body">
          <ReactMarkdown>{cleanContent}</ReactMarkdown>
        </div>
      ) : (
        <>
          {msg.content}
          {msg.attachedFile && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginLeft: msg.content ? 8 : 0,
              background: 'rgba(255,255,255,0.2)',
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 13,
            }}>
              <FileOutlined style={{ fontSize: 14 }} />
              <span>{msg.attachedFile.name}</span>
            </div>
          )}
        </>
      )}
    </div>
    {hasIntent && (
      <div style={{ marginTop: 12 }}>
        <Button
          type="primary"
          icon={<ArrowRightOutlined />}
          onClick={() => {
            // 显示分析方式选择卡片
            updateCurrentSession(msgs => [...msgs, {
              id: `${Date.now()}-analysis-method`,
              role: 'assistant',
              content: '',
              timestamp: new Date().toString(),
              type: 'analysis-method-select',
            }])
          }}
          style={{
            borderRadius: 8,
            background: 'var(--gradient-accent)',
            border: 'none',
          }}
        >
          开始差异分析
        </Button>
      </div>
    )}
  </div>
)
```

- [ ] **Step 2: 验证语法**

```bash
npm run build
```

Expected: 编译成功

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: render analysis button when ANALYSIS_READY detected

检测到标记时在 AI 回复下方渲染"开始差异分析"按钮"
```

## Task 5: 端到端测试

**Files:**
- Test: 前后端集成测试

- [ ] **Step 1: 启动后端服务**

```bash
cd backend
PYTHONPATH=backend uvicorn app.main:app --reload --port 8003
```

Expected: 服务在 http://localhost:8003 启动

- [ ] **Step 2: 启动前端服务**

```bash
npm run dev
```

Expected: 前端在 http://localhost:3003 启动

- [ ] **Step 3: 测试自然语言路径**

1. 打开浏览器访问 http://localhost:3003
2. 输入"帮我做差异分析"
3. 验证：消息发送给 AI，AI 回复中出现"开始差异分析"按钮
4. 点击按钮
5. 验证：弹出分析方式选择卡片（内置数据集/手动输入/上传文件）

Expected: 流程正常，按钮点击后显示选择卡片

- [ ] **Step 4: 测试斜杠命令路径**

1. 输入 `/analyze`
2. 验证：直接弹出分析方式选择卡片，不经过 AI 对话

Expected: 斜杠命令直接触发选择卡片

- [ ] **Step 5: 测试非意图消息**

1. 输入"差异分析是什么意思？"
2. 验证：AI 正常回复解释，不出现"开始差异分析"按钮

Expected: 普通对话不触发按钮

- [ ] **Step 6: 测试已有数据的分析请求**

1. 输入"用默认数据集分析 WT 和 osbzip23 的差异"
2. 验证：AI 直接调用工具执行分析，不出现按钮

Expected: 明确请求直接执行分析

- [ ] **Step 7: 所有测试通过后 Commit**

```bash
git add -A
git commit -m "test: verify analysis intent redesign end-to-end

验证自然语言、斜杠命令、非意图消息、已有数据请求等场景"
```

## Task 6: 清理和文档

**Files:**
- Modify: `CLAUDE.md` (可选，如需更新文档)

- [ ] **Step 1: 检查是否需要更新 CLAUDE.md**

查看 `CLAUDE.md` 中是否有关于差异分析交互的描述需要更新。

如果有，更新相关部分说明新的交互方式。

- [ ] **Step 2: 最终验证**

再次运行前后端服务，快速验证核心流程：
- 自然语言 → AI 回复 + 按钮 → 选择卡片
- 斜杠命令 → 直接选择卡片

Expected: 所有流程正常

- [ ] **Step 3: Final Commit**

```bash
git add -A
git commit -m "chore: finalize analysis intent redesign

完成差异分析交互流程重设计，自然语言走 AI 判断，斜杠命令保留直接触发"
```
