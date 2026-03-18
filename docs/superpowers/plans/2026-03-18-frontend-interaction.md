# 前端交互与进化机制实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现天枢系统的前端交互界面和进化机制，包括流式进度推送、交互式结果卡片、反馈闭环、经验复用

**Architecture:**
- 前端: React + TypeScript + Ant Design，使用自定义hooks封装SSE和业务逻辑
- 后端: FastAPI + SQLite，新增Analysis/FeedbackHint模型和API
- 数据流: 用户输入 → SSE进度 → 结果卡片 → 反馈 → 存入DB → 下次查询显示hint

**Tech Stack:** React 18, TypeScript, Ant Design, FastAPI, SQLite, SSE

---

## 实现文件结构

```
backend/app/models/
├── db_models.py         # 新建 - SQLAlchemy模型(Analysis, FeedbackHint)
└── __init__.py          # 修改 - 导出新模型

backend/app/routers/
└── feedback.py         # 修改 - 添加hints API (注意: 是feedback.py不是feedbacks.py)

backend/app/services/
└── feedback_service.py  # 修改 - 添加关键词提取和处理逻辑

src/
├── hooks/              # 新建目录
│   ├── useSSE.ts
│   └── useFeedbackHints.ts
└── components/
    ├── AnalysisProgress.tsx # 新建 - 双轨进度组件
    ├── DualTrackResultCard.tsx  # 新建 - 交互式结果卡片
    ├── FeedbackWidget.tsx   # 新建 - 简化反馈组件
    └── FeedbackHintBanner.tsx # 新建 - 历史反馈提示

src/pages/
└── ChatPage.tsx        # 修改 - 集成新组件
```

**注意**: 使用SQLAlchemy模型（已有database.py），不新建Pydantic模型（现有analysis.py是Pydantic）

---

## Chunk 1: 后端模型和API

### Task 1: 创建 SQLAlchemy 数据库模型

**Files:**
- Create: `backend/app/models/db_models.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: 创建 db_models.py (SQLAlchemy模型)**

```python
# backend/app/models/db_models.py
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base

class AnalysisDB(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True)
    dataset_id = Column(String, nullable=False)
    dataset_name = Column(String)
    group_control = Column(String)
    group_treatment = Column(String)
    tool_result_json = Column(Text)
    llm_result_json = Column(Text)
    consistency_json = Column(Text)
    created_by = Column(String)
    created_at = Column(DateTime, default=func.now())

class FeedbackHintDB(Base):
    __tablename__ = "feedback_hints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    keyword = Column(String, nullable=False, index=True)
    track = Column(String, nullable=False)
    hint_type = Column(String, nullable=False)
    summary = Column(Text)
    frequency = Column(Integer, default=1)
    last_seen = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
```

- [ ] **Step 2: 更新 __init__.py**

```python
# backend/app/models/__init__.py
from app.models.user import User
from app.models.dataset import Dataset
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.feedback import Feedback
from app.models.db_models import AnalysisDB, FeedbackHintDB

__all__ = ["User", "Dataset", "Conversation", "Message", "Feedback", "AnalysisDB", "FeedbackHintDB"]
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/
git commit -m "feat: add AnalysisDB and FeedbackHintDB SQLAlchemy models"
```

---

### Task 2: 扩展 FeedbackService 添加关键词提取

**Files:**
- Modify: `backend/app/services/feedback_service.py`

- [ ] **Step 1: 添加关键词提取函数**

```python
# 在 feedback_service.py 中添加
import re
from app.models.db_models import FeedbackHintDB

def extract_keywords(text: str) -> list[str]:
    """从文本中提取关键词（基因名、基因ID等）"""
    if not text:
        return []

    keywords = []

    # 匹配基因名模式
    gene_pattern = r'(?:gene[_-]?\w+|AT[1-5CG]\w+|LOC_\w+)'
    genes = re.findall(gene_pattern, text, re.IGNORECASE)
    keywords.extend([g.lower() for g in genes])

    # 匹配常见关键词
    manual_keywords = ['漏检', '误检', '重要', '准确', '遗漏', '错误', '好', '差']
    for kw in manual_keywords:
        if kw in text:
            keywords.append(kw)

    return list(set(keywords))

def process_feedback(feedback, db):
    """处理反馈并更新hint表"""
    from datetime import datetime

    hint_type = 'warning' if feedback.rating == 'negative' else 'praise'
    keywords = extract_keywords(feedback.comment or '')

    for keyword in keywords:
        existing = db.query(FeedbackHintDB).filter_by(keyword=keyword, track=feedback.track).first()
        if existing:
            existing.frequency += 1
            existing.last_seen = datetime.utcnow()
            existing.summary = (feedback.comment or '')[:100]
        else:
            hint = FeedbackHintDB(
                keyword=keyword,
                track=feedback.track,
                hint_type=hint_type,
                summary=(feedback.comment or '')[:100],
                frequency=1
            )
            db.add(hint)

    db.commit()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/feedback_service.py
git commit -m "feat: add keyword extraction and hint processing"
```

---

### Task 3: 添加 Feedback Hints API

**Files:**
- Modify: `backend/app/routers/feedback.py` (注意: 是feedback.py不是feedbacks.py)

- [ ] **Step 1: 添加 hints API**

```python
@router.get("/hints", response_model=List[dict])
async def get_feedback_hints(keyword: str, track: str = None, limit: int = 5):
    """获取相关反馈提示"""
    from app.database import SessionLocal
    from app.models.db_models import FeedbackHintDB

    db = SessionLocal()
    try:
        query = db.query(FeedbackHintDB).filter(
            FeedbackHintDB.keyword.like(f"%{keyword}%")
        )
        if track:
            query = query.filter(FeedbackHintDB.track == track)
        hints = query.order_by(FeedbackHintDB.frequency.desc()).limit(limit).all()

        return [
            {
                "id": h.id,
                "keyword": h.keyword,
                "track": h.track,
                "hint_type": h.hint_type,
                "summary": h.summary,
                "frequency": h.frequency
            }
            for h in hints
        ]
    finally:
        db.close()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/routers/feedback.py
git commit -m "feat: add feedback hints API endpoint"
```

---

## Chunk 2: 前端 Hooks

### Task 4: 创建 useSSE Hook

**Files:**
- Create: `src/hooks/useSSE.ts`

- [ ] **Step 1: 创建 useSSE hook**

```typescript
// src/hooks/useSSE.ts
import { useState, useEffect, useRef, useCallback } from 'react'

interface UseSSEOptions {
  onMessage?: (data: any) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  enabled?: boolean
}

interface UseSSEReturn {
  status: 'connecting' | 'connected' | 'disconnected'
  lastMessage: any | null
  reconnect: () => void
}

export function useSSE(url: string | null, options: UseSSEOptions = {}): UseSSEReturn {
  const { onMessage, onError, onOpen, enabled = true } = options
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const [lastMessage, setLastMessage] = useState<any>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (!url || !enabled) return

    setStatus('connecting')
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setStatus('connected')
      onOpen?.()
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setLastMessage(data)
        onMessage?.(data)
      } catch (e) {
        console.error('SSE parse error:', e)
      }
    }

    eventSource.onerror = (error) => {
      setStatus('disconnected')
      onError?.(error)
      // 简单重连逻辑
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          connect()
        }
      }, 3000)
    }
  }, [url, enabled, onMessage, onError, onOpen])

  const reconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    connect()
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      eventSourceRef.current?.close()
    }
  }, [connect])

  return { status, lastMessage, reconnect }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSSE.ts
git commit -m "feat: add useSSE hook for SSE connections"
```

---

### Task 5: 创建 useFeedbackHints Hook

**Files:**
- Create: `src/hooks/useFeedbackHints.ts`

- [ ] **Step 1: 创建 useFeedbackHints hook**

```typescript
// src/hooks/useFeedbackHints.ts
import { useState, useEffect } from 'react'
import { api } from '../api/client'

export interface FeedbackHint {
  id: number
  keyword: string
  track: 'tool' | 'llm'
  hint_type: 'warning' | 'praise'
  summary: string
  frequency: number
}

export function useFeedbackHints(keyword: string | null, track?: 'tool' | 'llm') {
  const [hints, setHints] = useState<FeedbackHint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!keyword) {
      setHints([])
      return
    }

    const fetchHints = async () => {
      setLoading(true)
      try {
        const params: Record<string, string> = { keyword }
        if (track) params.track = track
        const res = await api.get<{ data: FeedbackHint[] }>('/feedbacks/hints', { params })
        setHints(res.data?.data || [])
      } catch (e) {
        console.error('Failed to fetch hints:', e)
        setHints([])
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(fetchHints, 500)
    return () => clearTimeout(debounce)
  }, [keyword, track])

  return { hints, loading }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useFeedbackHints.ts
git commit -m "feat: add useFeedbackHints hook"
```

---

## Chunk 3: 前端组件

### Task 6: 创建 AnalysisProgress 组件

**Files:**
- Create: `src/components/AnalysisProgress.tsx`

- [ ] **Step 1: 创建 AnalysisProgress 组件**

```typescript
// src/components/AnalysisProgress.tsx
import { Card, Progress, Spin } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import { useMemo } from 'react'

interface ProgressData {
  track: 'tool' | 'llm'
  status: string
  progress: number
  currentStep?: string
  elapsedTime?: number
}

interface AnalysisProgressProps {
  progress: ProgressData | null
  isAnalyzing: boolean
}

export function AnalysisProgress({ progress, isAnalyzing }: AnalysisProgressProps) {
  if (!isAnalyzing && !progress) return null

  const toolProgress = progress?.track === 'tool' ? progress.progress : (isAnalyzing ? 0 : 100)
  const llmProgress = progress?.track === 'llm' ? progress.progress : (isAnalyzing ? 0 : 100)

  const toolStatus = progress?.track === 'tool' ? progress.status : (isAnalyzing ? '等待中...' : '已完成')
  const llmStatus = progress?.track === 'llm' ? progress.status : (isAnalyzing ? '等待中...' : '已完成')

  return (
    <Card size="small" style={{ marginBottom: 16, background: 'var(--color-bg-card)' }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Spin indicator={<LoadingOutlined spin />} />
        <span>{progress?.status || '准备分析...'}</span>
        {progress?.elapsedTime && (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
            已耗时 {Math.round(progress.elapsedTime)}s
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>工具轨 (scipy)</span>
            <span>{toolProgress}%</span>
          </div>
          <Progress
            percent={toolProgress}
            status={toolProgress >= 100 ? 'success' : 'active'}
            size="small"
            strokeColor="#52c41a"
          />
          {progress?.track === 'tool' && progress.currentStep && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {progress.currentStep}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>大模型轨 (千问)</span>
            <span>{llmProgress}%</span>
          </div>
          <Progress
            percent={llmProgress}
            status={llmProgress >= 100 ? 'success' : 'active'}
            size="small"
            strokeColor="#1890ff"
          />
          {progress?.track === 'llm' && progress.currentStep && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {progress.currentStep}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AnalysisProgress.tsx
git commit -m "feat: add AnalysisProgress component for dual-track progress"
```

---

### Task 7: 创建 DualTrackResultCard 组件

**Files:**
- Create: `src/components/DualTrackResultCard.tsx`

- [ ] **Step 1: 创建 DualTrackResultCard 组件**

```typescript
// src/components/DualTrackResultCard.tsx
import { Card, Row, Col, Tag, Table, Button, Collapse } from 'antd'
import { useState } from 'react'
import { AnalysisResult, GeneInfo } from '../api/client'
import FeedbackWidget from './FeedbackWidget'

interface DualTrackResultCardProps {
  result: AnalysisResult
}

export function DualTrackResultCard({ result }: DualTrackResultCardProps) {
  const [expanded, setExpanded] = useState(false)

  const toolColumns = [
    { title: '基因', dataIndex: 'gene_id', key: 'gene_id' },
    {
      title: '变化',
      dataIndex: 'expression_change',
      key: 'expression_change',
      render: (val: string) => (
        <Tag color={val === 'up' ? 'red' : val === 'down' ? 'blue' : 'default'}>
          {val === 'up' ? '上调' : val === 'down' ? '下调' : '无'}
        </Tag>
      )
    },
    { title: 'log2FC', dataIndex: 'log2fc', key: 'log2fc', render: (v: number) => v?.toFixed(2) },
    { title: 'p值', dataIndex: 'pvalue', key: 'pvalue', render: (v: number) => v?.toFixed(4) },
  ]

  return (
    <Card
      size="small"
      title={`双轨分析结果 - ${result.dataset_name}`}
      extra={
        <Button size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起' : '查看详情'}
        </Button>
      }
      style={{ marginTop: 16, background: 'var(--color-bg-card)' }}
    >
      {/* 一致性概览 - 默认显示 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8} style={{ textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: '#52c41a', color: '#fff', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px',
            fontSize: 18, fontWeight: 600
          }}>
            {result.consistency.overlap.length}
          </div>
          <div style={{ fontSize: 12 }}>共同检出</div>
        </Col>
        <Col span={8} style={{ textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: '#fa8c16', color: '#fff', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px',
            fontSize: 18, fontWeight: 600
          }}>
            {result.consistency.tool_only.length}
          </div>
          <div style={{ fontSize: 12 }}>仅工具</div>
        </Col>
        <Col span={8} style={{ textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: '#1890ff', color: '#fff', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px',
            fontSize: 18, fontWeight: 600
          }}>
            {result.consistency.llm_only.length}
          </div>
          <div style={{ fontSize: 12 }}>仅LLM</div>
        </Col>
      </Row>

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
          重合率: {(result.consistency.overlap_rate * 100).toFixed(0)}%
        </Tag>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card size="small" title={`工具轨 (scipy) - ${result.tool_result.execution_time.toFixed(2)}s`} style={{ background: '#fafafa' }}>
                <Tag color="green">{result.tool_result.significant_genes.length} 个显著基因</Tag>
                <Table
                  size="small"
                  dataSource={result.tool_result.significant_genes}
                  columns={toolColumns}
                  rowKey="gene_id"
                  pagination={false}
                  style={{ marginTop: 8 }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title={`大模型轨 (千问) - ${result.llm_result.execution_time.toFixed(2)}s`} style={{ background: '#f0f7ff' }}>
                <Tag color="blue">{result.llm_result.significant_genes.length} 个显著基因</Tag>
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  {result.llm_result.reasoning.substring(0, 200)}...
                </div>
              </Card>
            </Col>
          </Row>

          {/* 反馈组件 */}
          <FeedbackWidget analysisId={result.id} />
        </>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DualTrackResultCard.tsx
git commit -m "feat: add DualTrackResultCard component"
```

---

### Task 8: 创建 FeedbackWidget 组件

**Files:**
- Create: `src/components/FeedbackWidget.tsx`

- [ ] **Step 1: 创建 FeedbackWidget 组件**

```typescript
// src/components/FeedbackWidget.tsx
import { Button, message } from 'antd'
import { LikeOutlined, DislikeOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { feedbackApi } from '../api/client'

interface FeedbackWidgetProps {
  analysisId: string
}

export function FeedbackWidget({ analysisId }: FeedbackWidgetProps) {
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!rating) return

    setLoading(true)
    try {
      // 提交两条反馈：tool和llm各一条
      await feedbackApi.create({
        analysis_id: analysisId,
        track: 'tool',
        rating,
      })
      await feedbackApi.create({
        analysis_id: analysisId,
        track: 'llm',
        rating,
      })
      setSubmitted(true)
      message.success('感谢您的反馈！')
    } catch (e) {
      message.error('提交失败')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 16,
        background: '#f6ffed',
        borderRadius: 8,
        marginTop: 16
      }}>
        💚 感谢您的反馈！
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
      <div style={{ marginBottom: 8, fontSize: 13 }}>评价此分析结果：</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button
          type={rating === 'positive' ? 'primary' : 'default'}
          icon={<LikeOutlined />}
          onClick={() => setRating('positive')}
          style={{ background: rating === 'positive' ? '#52c41a' : undefined }}
        >
          点赞
        </Button>
        <Button
          type={rating === 'negative' ? 'primary' : 'default'}
          icon={<DislikeOutlined />}
          onClick={() => setRating('negative')}
          danger={rating === 'negative'}
        >
          点踩
        </Button>
      </div>
      <Button type="primary" onClick={handleSubmit} loading={loading} disabled={!rating}>
        提交反馈
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FeedbackWidget.tsx
git commit -m "feat: add FeedbackWidget component"
```

---

### Task 9: 创建 FeedbackHintBanner 组件

**Files:**
- Create: `src/components/FeedbackHintBanner.tsx`

- [ ] **Step 1: 创建 FeedbackHintBanner 组件**

```typescript
// src/components/FeedbackHintBanner.tsx
import { Alert } from 'antd'
import { BulbOutlined } from '@ant-design/icons'
import { FeedbackHint, useFeedbackHints } from '../hooks/useFeedbackHints'

interface FeedbackHintBannerProps {
  context?: string
}

export function FeedbackHintBanner({ context }: FeedbackHintBannerProps) {
  const { hints, loading } = useFeedbackHints(context || null)

  if (!context || hints.length === 0 || loading) return null

  const warnings = hints.filter(h => h.hint_type === 'warning')

  if (warnings.length === 0) return null

  return (
    <Alert
      message={
        <div>
          <BulbOutlined style={{ marginRight: 8 }} />
          <span>历史反馈提示</span>
        </div>
      }
      description={
        <div>
          {warnings.slice(0, 2).map(h => (
            <div key={h.id} style={{ marginBottom: 4 }}>
              • {h.summary || `有用户反馈大模型在此类数据中${h.hint_type === 'warning' ? '需注意' : '表现好'}`}
            </div>
          ))}
        </div>
      }
      type="warning"
      style={{ marginBottom: 16 }}
      showIcon
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FeedbackHintBanner.tsx
git commit -m "feat: add FeedbackHintBanner component"
```

---

## Chunk 4: 页面集成

### Task 10: 修改 ChatPage 集成组件

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: 添加新的import**

```typescript
import { AnalysisProgress } from '../components/AnalysisProgress'
import { DualTrackResultCard } from '../components/DualTrackResultCard'
import { FeedbackHintBanner } from '../components/FeedbackHintBanner'
import { useSSE } from '../hooks/useSSE'
```

- [ ] **Step 2: 修改 ChatMessage 接口添加progress类型**

```typescript
interface ChatMessage extends Message {
  isLoading?: boolean
  type?: 'text' | 'progress' | 'analysis' | 'result'
  progress?: { track: string; status: string; progress: number; currentStep?: string; elapsedTime?: number }
  analysisResult?: AnalysisResult
}
```

- [ ] **Step 3: 添加SSE连接逻辑（在组件内）**

```typescript
// 在 ChatPage 组件内添加
const [isAnalyzing, setIsAnalyzing] = useState(false)
const [progress, setProgress] = useState<{ track: string; status: string; progress: number } | null>(null)

const { lastMessage } = useSSE(
  analyzing ? `/api/analysis/stream/${currentJobId}` : null,
  {
    onMessage: (data) => {
      if (data.progress !== undefined) {
        setProgress(data)
      }
      if (data.result) {
        setIsAnalyzing(false)
        // 添加结果消息
        updateCurrentSession(msgs => [...msgs, {
          id: Date.now().toString(),
          role: 'assistant',
          type: 'result',
          analysisResult: data.result,
          timestamp: new Date().toString(),
        }])
      }
    },
    enabled: analyzing
  }
)
```

- [ ] **Step 4: 修改消息渲染逻辑**

```typescript
// 在消息渲染处添加
{msg.type === 'progress' && msg.progress ? (
  <AnalysisProgress progress={msg.progress} isAnalyzing={msg.isLoading || false} />
) : msg.type === 'result' && msg.analysisResult ? (
  <DualTrackResultCard result={msg.analysisResult} />
) : msg.isLoading ? (
  <Spin />
) : ...}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat: integrate new components into ChatPage"
```

---

## 验收检查

- [ ] 后端模型创建成功，启动无报错
- [ ] 前端组件编译通过
- [ ] 页面正常显示新组件
- [ ] SSE进度推送正常工作
- [ ] 反馈提交功能正常
