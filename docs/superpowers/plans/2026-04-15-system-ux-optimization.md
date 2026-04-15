# ABC 系统操作体验优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 P0→P3 四个阶段系统性优化 ABC 系统的操作体验，解决崩溃、数据丢失、反馈缺失等问题。

**Architecture:** 前端新增 ErrorBoundary 组件 + 为关键操作添加确认弹窗 + 完善 loading/error 状态；后端为 chat 请求添加超时 + 改善错误信息 + SSE 增加心跳。每个阶段独立可测试可提交。

**Tech Stack:** React 18 + TypeScript + Ant Design (Modal.confirm, Popconfirm) / FastAPI + asyncio

---

## File Structure

### 新增文件
- `src/components/ErrorBoundary.tsx` — 全局错误边界组件

### 修改文件
- `src/pages/ChatPage.tsx` — 删除确认、空状态引导、加载状态、表单校验
- `src/pages/AnalysisPage.tsx` — 删除确认、表单校验、空状态引导
- `src/pages/SettingsPage.tsx` — 表单校验增强
- `src/App.tsx` — 包裹 ErrorBoundary
- `src/hooks/useSSE.ts` — 指数退避 + 最大重试次数
- `src/api/client.ts` — 超时提示
- `backend/app/routers/chat.py` — 请求超时 + 友好错误信息
- `backend/app/routers/analysis.py` — SSE 心跳 + 友好错误信息
- `backend/app/tools/differential.py` — 零值基因统计反馈
- `backend/app/main.py` — 全局异常处理器

---

## P0 阶段：严重问题修复（防止数据丢失和应用崩溃）

### Task 1: 添加删除确认弹窗

**Files:**
- Modify: `src/pages/ChatPage.tsx:1-3` (import) + `src/pages/ChatPage.tsx:1493-1502` (handleDeleteSession)
- Modify: `src/pages/AnalysisPage.tsx:1-3` (import) + `src/pages/AnalysisPage.tsx:127-138` (handleDeleteDataset)

- [ ] **Step 1: ChatPage — 为会话删除添加 Modal.confirm**

在 `src/pages/ChatPage.tsx` 的 antd import 中添加 `Modal`：

```tsx
// Line 2: 在现有 import 末尾添加 Modal
import { Input, Button, Avatar, Spin, Card, Row, Col, Tag, Table, Progress, message, Layout, Dropdown, Space, Modal } from 'antd'
```

替换 `handleDeleteSession` 函数（约 line 1493-1502）：

```tsx
const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
  e.stopPropagation()
  Modal.confirm({
    title: '确认删除',
    content: '删除后无法恢复，确定要删除这个会话吗？',
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: () => {
      const newSessions = sessions.filter(s => s.id !== sessionId)
      setSessions(newSessions)
      if (sessionId === currentSessionId) {
        if (newSessions.length > 0) setCurrentSessionId(newSessions[0].id)
        else createNewSession()
      }
    },
  })
}
```

- [ ] **Step 2: AnalysisPage — 为数据集删除添加 Modal.confirm**

在 `src/pages/AnalysisPage.tsx` 的 antd import 中确认包含 `Modal`，若缺少则添加。

替换 `handleDeleteDataset` 函数（约 line 127-138）：

```tsx
const handleDeleteDataset = (id: string) => {
  Modal.confirm({
    title: '确认删除',
    content: '删除后数据集将无法恢复，确定要删除吗？',
    okText: '删除',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await datasetApi.delete(id);
        message.success('删除成功');
        loadDatasets();
        if (selectedDatasetId === id) {
          setSelectedDatasetId(undefined);
        }
      } catch (error) {
        message.error('删除失败');
      }
    },
  })
}
```

- [ ] **Step 3: 手动验证**

1. 启动前端 `npm run dev`
2. 在聊天页面创建一个会话，点击删除按钮 → 应弹出确认弹窗
3. 点击"取消" → 会话不被删除
4. 再次点击删除 → 点击"删除" → 会话被删除
5. 在分析页面上传一个数据集，点击删除 → 应弹出确认弹窗
6. 验证取消和确认行为正确

- [ ] **Step 4: Commit**

```bash
git add src/pages/ChatPage.tsx src/pages/AnalysisPage.tsx
git commit -m "fix: add confirmation dialogs for session and dataset deletion"
```

---

### Task 2: 添加全局错误边界

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/App.tsx:7-18`

- [ ] **Step 1: 创建 ErrorBoundary 组件**

创建 `src/components/ErrorBoundary.tsx`：

```tsx
import React, { Component, ErrorInfo } from 'react'
import { Button, Result } from 'antd'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'var(--color-bg-dark)',
        }}>
          <Result
            status="error"
            title="页面出现了问题"
            subTitle="抱歉，页面发生了意外错误。请尝试刷新页面或返回首页。"
            extra={[
              <Button key="reload" type="primary" onClick={() => window.location.reload()}>
                刷新页面
              </Button>,
              <Button key="home" onClick={() => { window.location.href = '/' }}>
                返回首页
              </Button>,
            ]}
          />
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 2: 在 App.tsx 中包裹 ErrorBoundary**

修改 `src/App.tsx`，在 import 区域添加：

```tsx
import { ErrorBoundary } from './components/ErrorBoundary'
```

将 `App` 组件中的 `<Routes>` 用 `<ErrorBoundary>` 包裹：

```tsx
function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<ChatPage />} />
          {/* <Route path="/ontology" element={<OntologyPage />} /> */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </AuthProvider>
  )
}
```

- [ ] **Step 3: 手动验证**

1. 启动前端，正常访问页面确认无影响
2. 临时在某个组件中添加 `throw new Error('test')` 验证 ErrorBoundary 展示正确
3. 点击"刷新页面"和"返回首页"按钮验证行为正确
4. 移除测试代码

- [ ] **Step 4: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/App.tsx
git commit -m "fix: add global ErrorBoundary to prevent app white-screen crashes"
```

---

### Task 3: 后端 Chat 请求超时控制

**Files:**
- Modify: `backend/app/routers/chat.py:162-175`

- [ ] **Step 1: 为 agent_loop 添加超时包裹**

在 `backend/app/routers/chat.py` 中修改 chat 端点（约 line 162-175）：

```python
@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not settings.qwen_api_key:
        raise HTTPException(status_code=500, detail="QWEN_API_KEY 未配置，请在设置页面配置 API Key")

    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    try:
        content = await asyncio.wait_for(
            asyncio.to_thread(_agent_loop, messages),
            timeout=120.0  # 2 minutes max
        )
        return ChatResponse(content=content)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="AI 分析超时，请简化问题后重试，或检查网络连接"
        )
    except Exception as e:
        traceback.print_exc()
        error_msg = str(e)
        if "api_key" in error_msg.lower() or "authentication" in error_msg.lower():
            detail = "API Key 无效或已过期，请在设置页面重新配置"
        elif "connection" in error_msg.lower() or "timeout" in error_msg.lower():
            detail = "AI 服务连接失败，请检查网络后重试"
        else:
            detail = "AI 服务暂时不可用，请稍后重试"
        raise HTTPException(status_code=500, detail=detail)
```

- [ ] **Step 2: 手动验证**

1. 启动后端 `PYTHONPATH=backend uvicorn app.main:app --reload --port 8003`
2. 发送一个正常对话请求 → 应正常返回
3. 使用无效 API Key → 应返回"API Key 无效"提示
4. 在 Swagger UI (`/docs`) 中测试 `/api/chat/` 端点

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/chat.py
git commit -m "fix: add 2-minute timeout and user-friendly error messages to chat endpoint"
```

---

### Task 4: 后端全局异常处理器

**Files:**
- Modify: `backend/app/main.py:1-5` (imports) + `backend/app/main.py:18-27` (after app creation)

- [ ] **Step 1: 添加全局异常处理器**

在 `backend/app/main.py` 中，在 `app = FastAPI(...)` 创建之后、CORS middleware 之前添加：

```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return user-friendly error."""
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "detail": "服务器内部错误，请稍后重试",
            "status": "error",
        },
    )
```

- [ ] **Step 2: 手动验证**

1. 重启后端服务
2. 正常请求确认不受影响
3. 查看 `/docs` 确认 API 文档正常加载

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "fix: add global exception handler for user-friendly 500 errors"
```

---

## P1 阶段：高优先级体验改善（加载状态 + 错误提示 + SSE 稳定性）

### Task 5: ChatPage 空状态引导文案

**Files:**
- Modify: `src/pages/ChatPage.tsx:1724-1750`

- [ ] **Step 1: 在空状态下方添加引导文案**

在 `src/pages/ChatPage.tsx` 中找到空状态渲染区域（约 line 1724-1727），将：

```tsx
{!hasMessages ? (
  <div style={{ flex: 1, display: 'flex' }}>
    <AnalysisFlowChart />
  </div>
) : (
```

替换为：

```tsx
{!hasMessages ? (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
    <AnalysisFlowChart />
    <div style={{
      textAlign: 'center',
      padding: '0 24px 24px',
      color: 'var(--color-text-muted)',
      fontSize: 14,
    }}>
      <div style={{ marginBottom: 8, fontSize: 16, color: 'var(--color-text-secondary)' }}>
        试试以下操作开始分析
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Tag style={{ cursor: 'pointer', padding: '4px 12px' }}
             onClick={() => { setInput('分析 WT 和 osbzip23 的差异表达基因'); }}>
          分析 WT 和 osbzip23 的差异表达基因
        </Tag>
        <Tag style={{ cursor: 'pointer', padding: '4px 12px' }}
             onClick={() => { setInput('/tools'); }}>
          /tools 查看可用工具
        </Tag>
        <Tag style={{ cursor: 'pointer', padding: '4px 12px' }}
             onClick={() => { setInput('/datasets'); }}>
          /datasets 查看数据集
        </Tag>
      </div>
    </div>
  </div>
) : (
```

- [ ] **Step 2: 手动验证**

1. 刷新页面或新建会话 → 应看到流程图下方显示引导文案和 3 个可点击标签
2. 点击标签 → 输入框应自动填入对应文本
3. 发送消息后引导消失，显示消息列表

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: add guided prompts in chat empty state"
```

---

### Task 6: 前端 API 超时友好提示

**Files:**
- Modify: `src/api/client.ts:1-30`

- [ ] **Step 1: 增强 API client 的错误拦截**

在 `src/api/client.ts` 的响应拦截器中（约 line 21-30），修改 error 处理：

```tsx
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
    }
    // 超时友好提示
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      error.friendlyMessage = '请求超时，请检查网络连接后重试'
    }
    // 网络断开
    else if (!error.response) {
      error.friendlyMessage = '网络连接失败，请检查网络后重试'
    }
    // 服务端错误
    else if (error.response?.status >= 500) {
      error.friendlyMessage = error.response.data?.detail || '服务器暂时不可用，请稍后重试'
    }
    return Promise.reject(error)
  }
)
```

- [ ] **Step 2: 在 ChatPage 中使用友好提示**

在 `src/pages/ChatPage.tsx` 的 `handleNormalChat` catch 块（约 line 532-537）中，将错误提示改为：

```tsx
} catch (error: any) {
  const errorMsg = error.friendlyMessage
    || error.response?.data?.detail
    || '抱歉，发生了一些错误，请稍后重试'
  updateCurrentSession(msgs =>
    msgs.map(msg => msg.id === assistantMessage.id
      ? { ...msg, content: errorMsg, isLoading: false }
      : msg)
  )
}
```

- [ ] **Step 3: 手动验证**

1. 正常发送消息 → 正常回复
2. 断开网络后发送消息 → 应显示"网络连接失败"
3. 后端服务关闭后发送消息 → 应显示友好错误而非技术细节

- [ ] **Step 4: Commit**

```bash
git add src/api/client.ts src/pages/ChatPage.tsx
git commit -m "feat: add user-friendly error messages for API timeouts and failures"
```

---

### Task 7: SSE 重连增强 — 指数退避 + 最大重试

**Files:**
- Modify: `src/hooks/useSSE.ts:1-72`

- [ ] **Step 1: 重写 useSSE hook 的重连逻辑**

替换 `src/hooks/useSSE.ts` 全部内容：

```tsx
import { useState, useRef, useCallback, useEffect } from 'react'

interface UseSSEOptions {
  onMessage?: (data: any) => void
  onError?: (error: Event) => void
  onOpen?: () => void
}

interface UseSSEReturn {
  status: 'connected' | 'connecting' | 'disconnected'
  reconnect: () => void
  close: () => void
}

const MAX_RETRIES = 5
const BASE_DELAY = 1000 // 1 second

export function useSSE(url: string | null, options: UseSSEOptions = {}): UseSSEReturn {
  const { onMessage, onError, onOpen } = options
  const [status, setStatus] = useState<UseSSEReturn['status']>('disconnected')
  const eventSourceRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  const close = useCallback(() => {
    clearRetryTimer()
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setStatus('disconnected')
  }, [clearRetryTimer])

  const connect = useCallback(() => {
    if (!url) return
    close()
    setStatus('connecting')

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setStatus('connected')
      retryCountRef.current = 0 // reset on successful connection
      onOpen?.()
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage?.(data)
      } catch (e) {
        console.warn('SSE JSON parse error:', e)
      }
    }

    eventSource.onerror = (error) => {
      setStatus('disconnected')
      onError?.(error)

      if (eventSource.readyState === EventSource.CLOSED) {
        if (retryCountRef.current < MAX_RETRIES) {
          const delay = Math.min(BASE_DELAY * Math.pow(2, retryCountRef.current), 30000)
          retryCountRef.current++
          retryTimerRef.current = setTimeout(() => connect(), delay)
        }
      }
    }
  }, [url, onMessage, onError, onOpen, close])

  const reconnect = useCallback(() => {
    retryCountRef.current = 0
    connect()
  }, [connect])

  useEffect(() => {
    if (url) connect()
    return () => close()
  }, [url]) // intentionally only depend on url

  return { status, reconnect, close }
}
```

- [ ] **Step 2: 手动验证**

1. 触发一次差异表达分析 → SSE 应正常推送进度
2. 分析完成后 SSE 关闭，无多余重连
3. 如果后端短暂断开，前端应自动重连（最多 5 次）

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSSE.ts
git commit -m "feat: improve SSE reconnection with exponential backoff and max retry limit"
```

---

### Task 8: 后端 SSE 心跳 + 友好错误

**Files:**
- Modify: `backend/app/routers/analysis.py:507-689`

- [ ] **Step 1: 在 SSE event_generator 中添加心跳和友好错误**

在 `backend/app/routers/analysis.py` 的 `stream_analysis` 端点中，找到 `event_generator` 异步生成器函数。

在函数开头（进入主逻辑之前）添加心跳辅助函数，替换 `delay_no_cancel` 为支持心跳的版本：

```python
async def heartbeat_delay(seconds: float):
    """Sleep while sending SSE comments as heartbeat every 15 seconds."""
    elapsed = 0
    interval = 15.0
    while elapsed < seconds:
        wait = min(interval, seconds - elapsed)
        await asyncio.sleep(wait)
        elapsed += wait
        if elapsed < seconds:
            yield ": heartbeat\n\n"
```

在每个 `delay_no_cancel` 调用处，改为使用心跳版本。具体来说，将原本的：

```python
await delay_no_cancel(2)
```

改为：

```python
async for hb in heartbeat_delay(2):
    yield hb
```

同时修改异常处理块（约 line 677-681），使用 `json.dumps` 替代手动字符串格式化：

```python
except Exception as e:
    import json as json_module
    error_msg = json_module.dumps({
        "job_id": job_id,
        "status": "error",
        "message": "分析过程出现错误，请检查数据格式后重试",
    }, ensure_ascii=False)
    yield f"data: {error_msg}\n\n"
```

- [ ] **Step 2: 手动验证**

1. 触发差异分析 → SSE 流正常推送进度事件
2. 在浏览器 Network 面板观察 → 长时间运行分析时应看到 `: heartbeat` 注释
3. 分析出错时 → 前端应显示中文错误信息

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/analysis.py
git commit -m "feat: add SSE heartbeat and user-friendly error messages in analysis stream"
```

---

### Task 9: AnalysisPage 空状态引导增强

**Files:**
- Modify: `src/pages/AnalysisPage.tsx:242-250` + `src/pages/AnalysisPage.tsx:345-349`

- [ ] **Step 1: 增强空状态描述信息**

在 `src/pages/AnalysisPage.tsx` 中，修改数据集列表空状态（约 line 242-250）：

```tsx
{datasets.length === 0 ? (
  <Empty
    description={
      <span>
        暂无数据集
        <br />
        <span style={{ fontSize: 12, color: '#999' }}>
          支持 CSV、Excel 格式的基因表达矩阵
        </span>
      </span>
    }
    image={Empty.PRESENTED_IMAGE_SIMPLE}
  >
    <Button type="primary" onClick={() => setUploadModalVisible(true)}>
      上传数据集
    </Button>
  </Empty>
```

修改分析结果空状态（约 line 345-349）：

```tsx
<Empty
  description={
    <span>
      请先在左侧选择数据集，填写分组名称后开始分析
      <br />
      <span style={{ fontSize: 12, color: '#999' }}>
        如果没有数据集，请先在"数据集管理"标签页上传
      </span>
    </span>
  }
  image={Empty.PRESENTED_IMAGE_SIMPLE}
/>
```

- [ ] **Step 2: 手动验证**

1. 打开分析页面 → 空数据集列表应显示"支持 CSV、Excel 格式"引导
2. 没有选择数据集时 → 分析区域应显示引导文案

- [ ] **Step 3: Commit**

```bash
git add src/pages/AnalysisPage.tsx
git commit -m "feat: improve empty state guidance in analysis page"
```

---

## P2 阶段：中优先级改善（表单校验 + 安全加固 + 导航反馈）

### Task 10: AnalysisPage 分组名称校验

**Files:**
- Modify: `src/pages/AnalysisPage.tsx:61-65`

- [ ] **Step 1: 添加分组名称非空校验**

在 `src/pages/AnalysisPage.tsx` 的 `handleRunAnalysis` 函数中（约 line 61-65），在现有的 `selectedDatasetId` 检查之后添加分组校验：

```tsx
const handleRunAnalysis = async () => {
  if (!selectedDatasetId) {
    message.warning('请选择数据集');
    return;
  }
  if (!groupControl.trim()) {
    message.warning('请输入对照组名称');
    return;
  }
  if (!groupTreatment.trim()) {
    message.warning('请输入处理组名称');
    return;
  }
  if (groupControl.trim() === groupTreatment.trim()) {
    message.warning('对照组和处理组名称不能相同');
    return;
  }
```

- [ ] **Step 2: 手动验证**

1. 不输入分组名称，点击开始分析 → 提示"请输入对照组名称"
2. 只输入对照组 → 提示"请输入处理组名称"
3. 两个名称输入相同值 → 提示"不能相同"
4. 正确输入两个不同分组名称 → 正常开始分析

- [ ] **Step 3: Commit**

```bash
git add src/pages/AnalysisPage.tsx
git commit -m "fix: add group name validation in analysis page"
```

---

### Task 11: SettingsPage 表单校验增强

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: 增强 API Key 和温度参数校验**

在 `src/pages/SettingsPage.tsx` 的 LLM 配置表单中：

将 API Key 的 `Form.Item` 规则（约 line 99）改为：

```tsx
<Form.Item
  label="API Key"
  name="llm_api_key"
  rules={[
    { required: true, message: '请输入 API Key' },
    { min: 10, message: 'API Key 长度不正确' },
  ]}
>
```

将 temperature 的 `Form.Item` 改为使用 `InputNumber`（需要在 antd import 中添加 `InputNumber`）：

```tsx
<Form.Item
  label="Temperature"
  name="temperature"
  rules={[{ required: true, message: '请设置温度参数' }]}
>
  <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
</Form.Item>
```

- [ ] **Step 2: 手动验证**

1. 清空 API Key 后保存 → 应提示"请输入 API Key"
2. 输入过短的 API Key → 应提示"长度不正确"
3. 温度参数应只能输入 0-1 之间的数字

- [ ] **Step 3: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "fix: enhance form validation for API key and temperature settings"
```

---

### Task 12: 后端 SECRET_KEY 从环境变量读取

**Files:**
- Modify: `backend/app/routers/auth.py:13`

- [ ] **Step 1: 从环境变量读取 SECRET_KEY**

在 `backend/app/routers/auth.py` 中替换 line 13：

```python
import os

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
```

- [ ] **Step 2: 手动验证**

1. 不设置环境变量时 → 使用默认值（开发环境兼容）
2. 设置 `JWT_SECRET_KEY=my-secure-key` 后重启 → 使用新 key

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/auth.py
git commit -m "fix: read JWT secret key from environment variable"
```

---

### Task 13: 差异分析零值基因统计反馈

**Files:**
- Modify: `backend/app/tools/differential.py:57-95` + `backend/app/tools/differential.py:104-115`

- [ ] **Step 1: 统计并反馈被跳过的基因数量**

在 `backend/app/tools/differential.py` 的分析循环中（约 line 57），添加计数器：

```python
gene_results = []
significant_genes = []
skipped_zero = 0
skipped_variance = 0

for gene_id, row in df.iterrows():
    ctrl_vals = [row[s] for s in control_samples]
    trt_vals = [row[s] for s in treatment_samples]

    if len(ctrl_vals) < 2 or len(trt_vals) < 2:
        continue

    ctrl_mean = np.mean(ctrl_vals)
    trt_mean = np.mean(trt_vals)

    if ctrl_mean <= 0 or trt_mean <= 0:
        skipped_zero += 1
        continue

    log2fc = float(np.log2(trt_mean / ctrl_mean))
    _, pvalue = stats.ttest_ind(ctrl_vals, trt_vals)
    pvalue = float(pvalue)
    if np.isnan(pvalue):
        skipped_variance += 1
        continue
```

然后在 summary 中添加跳过信息（约 line 104-115）：

```python
result["summary"] = {
    "total_genes_tested": len(gene_results),
    "significant_genes_count": len(significant_genes),
    "upregulated_count": len(up),
    "downregulated_count": len(down),
    "skipped_zero_expression": skipped_zero,
    "skipped_no_variance": skipped_variance,
    "control_group": control_group,
    "treatment_group": treatment_group,
    "control_samples": control_samples,
    "treatment_samples": treatment_samples,
    "pvalue_threshold": pvalue_threshold,
    "log2fc_threshold": log2fc_threshold,
}
```

- [ ] **Step 2: 手动验证**

1. 运行差异分析 → summary 中应包含 `skipped_zero_expression` 和 `skipped_no_variance` 字段
2. 值应为非负整数

- [ ] **Step 3: Commit**

```bash
git add backend/app/tools/differential.py
git commit -m "feat: report skipped gene counts in differential analysis summary"
```

---

## P3 阶段：体验打磨（响应式 + 无障碍 + 性能）

### Task 14: ChatPage 侧边栏移动端折叠

**Files:**
- Modify: `src/pages/ChatPage.tsx` (state + sider)

- [ ] **Step 1: 添加侧边栏折叠状态**

在 `src/pages/ChatPage.tsx` 中添加 state（在其他 state 附近）：

```tsx
const [siderCollapsed, setSiderCollapsed] = useState(window.innerWidth < 768)
```

修改 `<Sider>` 组件（约 line 1554）：

```tsx
<Sider
  width={280}
  collapsedWidth={0}
  collapsed={siderCollapsed}
  breakpoint="md"
  onBreakpoint={(broken) => setSiderCollapsed(broken)}
  trigger={null}
  collapsible
  style={{
    background: '#faf8f5',
    borderRight: '1px solid var(--color-border)',
    height: '100vh',
    overflow: 'auto',
  }}
>
```

在 header 区域（约 line 1640）添加一个折叠切换按钮：

```tsx
{siderCollapsed && (
  <Button
    type="text"
    icon={<MessageOutlined />}
    onClick={() => setSiderCollapsed(false)}
    style={{ marginRight: 8 }}
  />
)}
```

- [ ] **Step 2: 手动验证**

1. 缩小浏览器窗口到 768px 以下 → 侧边栏应自动隐藏
2. 点击 header 中的 MessageOutlined 按钮 → 侧边栏展开
3. 放大窗口 → 侧边栏自动展开

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: add responsive sidebar collapse for mobile screens"
```

---

### Task 15: 关键元素无障碍属性

**Files:**
- Modify: `src/pages/ChatPage.tsx` (textarea, send button, avatars)

- [ ] **Step 1: 为输入框和按钮添加 aria 属性**

在 `src/pages/ChatPage.tsx` 中：

给 TextArea（约 line 1811-1829）添加 aria-label：

```tsx
<TextArea
  aria-label="输入分析问题"
  // ... 其他已有属性保持不变
```

给发送按钮（约 line 1831-1844）添加 aria-label：

```tsx
<Button
  aria-label="发送消息"
  // ... 其他已有属性保持不变
```

给消息列表中的 Avatar 添加 alt 属性（在 renderMessageContent 外层的 Avatar 渲染处）：

```tsx
<Avatar
  // ... 已有属性
  alt={msg.role === 'user' ? '用户' : 'AI 助手'}
```

- [ ] **Step 2: 手动验证**

1. 使用浏览器开发者工具的 Accessibility 面板 → 输入框和发送按钮应显示标签
2. Tab 键导航应能聚焦到输入框和发送按钮

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: add aria-labels for accessibility on key interactive elements"
```

---

### Task 16: 清理 ChatPage 重复代码

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: 移除重复的 datasets_list 和 enrichment-prompt 渲染块**

在 `src/pages/ChatPage.tsx` 的 `renderMessageContent` 函数中：

找到 `__datasets_list__` 的两个渲染块（约 line 989-1026 和 1029-1068）。删除第二个重复块（line 1029-1068）。

找到 `enrichment-prompt` 的两个渲染块（约 line 1292-1333 和 1336-1377）。删除第二个重复块（line 1336-1377）。

- [ ] **Step 2: 手动验证**

1. 输入 `/datasets` → 应正常显示数据集卡片列表
2. 触发富集分析提示 → 应正常显示"是/跳过"选择卡片
3. 确认没有双重渲染问题

- [ ] **Step 3: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "refactor: remove duplicate rendering blocks in ChatPage"
```

---

## 执行检查清单

| 阶段 | Task | 核心改动 | 影响范围 |
|------|------|----------|----------|
| P0 | Task 1 | 删除确认弹窗 | ChatPage, AnalysisPage |
| P0 | Task 2 | 全局 ErrorBoundary | ErrorBoundary.tsx, App.tsx |
| P0 | Task 3 | Chat 请求超时 | chat.py |
| P0 | Task 4 | 全局异常处理器 | main.py |
| P1 | Task 5 | 空状态引导 | ChatPage |
| P1 | Task 6 | API 友好错误 | client.ts, ChatPage |
| P1 | Task 7 | SSE 指数退避 | useSSE.ts |
| P1 | Task 8 | SSE 心跳 | analysis.py |
| P1 | Task 9 | 分析页空状态 | AnalysisPage |
| P2 | Task 10 | 分组名校验 | AnalysisPage |
| P2 | Task 11 | 设置表单校验 | SettingsPage |
| P2 | Task 12 | SECRET_KEY 环境变量 | auth.py |
| P2 | Task 13 | 零值基因反馈 | differential.py |
| P3 | Task 14 | 侧边栏响应式 | ChatPage |
| P3 | Task 15 | 无障碍属性 | ChatPage |
| P3 | Task 16 | 清理重复代码 | ChatPage |
