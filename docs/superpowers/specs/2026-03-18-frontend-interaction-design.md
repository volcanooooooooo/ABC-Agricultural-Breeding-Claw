# 前端交互与进化机制设计文档

**项目**: 育种 AI 科学家系统 (ABC: Agricultural Breeding Claw)
**日期**: 2026-03-18
**版本**: 1.1
**状态**: 已根据审查反馈修改

---

## 一、概述

本文档描述 ABC 系统的前端交互界面和进化机制实现方案，包括：
1. 流式进度推送（SSE）
2. 交互式结果对比卡片
3. 反馈闭环机制
4. 经验复用功能

---

## 二、数据库设计 (SQLite)

### 2.1 SQLAlchemy ORM 模型

```python
# backend/app/models/analysis.py
from sqlalchemy import Column, Integer, String, Text, DateTime, Float
from sqlalchemy.sql import func
from app.database import Base

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True)
    dataset_id = Column(String, nullable=False)
    dataset_name = Column(String)
    group_control = Column(String)
    group_treatment = Column(String)
    tool_result_json = Column(Text)      # JSON存储为TEXT
    llm_result_json = Column(Text)      # JSON存储为TEXT
    consistency_json = Column(Text)      # JSON存储为TEXT
    created_by = Column(String)
    created_at = Column(DateTime, default=func.now())

class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(String, nullable=False)
    track = Column(String, nullable=False)       # 'tool' | 'llm'
    rating = Column(String, nullable=False)      # 'positive' | 'negative'
    comment = Column(Text)
    gene_ids = Column(Text)                     # JSON数组存储为TEXT
    created_by = Column(String)
    created_at = Column(DateTime, default=func.now())

class FeedbackHint(Base):
    __tablename__ = "feedback_hints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    keyword = Column(String, nullable=False, index=True)
    track = Column(String, nullable=False)      # 'tool' | 'llm'
    hint_type = Column(String, nullable=False)  # 'warning' | 'praise'
    summary = Column(Text)                       # 摘要文本
    frequency = Column(Integer, default=1)
    last_seen = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
```

### 2.2 现有模型复用

| 模型 | 位置 | 状态 |
|------|------|------|
| `Feedback` | `backend/app/models/feedback.py` | 已存在，需扩展 gene_ids 字段 |
| `Analysis` | 新建 | `backend/app/models/analysis.py` |
| `FeedbackHint` | 新建 | `backend/app/models/feedback_hint.py` |

---

## 三、功能模块设计

### 3.1 流式进度推送 (SSE)

#### 技术说明
- **现状**: 后端已实现 SSE (`/api/analysis/stream/{job_id}`)，前端 ChatPage 已集成 EventSource
- **改进**:
  - 抽取 `useSSE` hook 封装连接和重连逻辑
  - 添加心跳检测
  - 支持 `currentStep` 和 `elapsedTime` 字段

#### 前端组件: `AnalysisProgress.tsx`

```tsx
interface ProgressData {
  track: 'tool' | 'llm'      // 当前执行轨道
  status: string              // 状态描述
  progress: number           // 0-100
  currentStep?: string       // 当前步骤（如"正在执行DESeq2"）
  elapsedTime?: number       // 已用时间(秒)
}

// SSE Hook 实现思路
function useSSE(url: string, options?: { onMessage, onError, onOpen }) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const [lastMessage, setLastMessage] = useState<any>(null)

  useEffect(() => {
    const eventSource = new EventSource(url)
    eventSource.onopen = () => setStatus('connected')
    eventSource.onmessage = (e) => {
      setLastMessage(JSON.parse(e.data))
      options?.onMessage?.(JSON.parse(e.data))
    }
    eventSource.onerror = () => {
      setStatus('disconnected')
      // 简单的重连逻辑
      setTimeout(() => eventSource.open(), 3000)
      options?.onError?.()
    }
    return () => eventSource.close()
  }, [url])

  return { status, lastMessage }
}

// 显示逻辑
- 双轨进度条并行显示
- 工具轨：显示具体步骤（数据预处理→差异分析→富集分析）
- 大模型轨：显示LLM调用状态
- 完成后显示总耗时
```

#### UI 布局
```
┌─────────────────────────────────────┐
│  🔬 双轨差异分析                    │
├─────────────────────────────────────┤
│  工具轨 (scipy)                     │
│  ████████████░░░░░░  60%           │
│  正在执行DESeq2差异分析...          │
├─────────────────────────────────────┤
│  大模型轨 (千问)                    │
│  ████████████████░░░  80%           │
│  LLM推理中 - 已分析120个基因...      │
└─────────────────────────────────────┘
```

### 3.2 交互式结果对比卡片

#### 前端组件: `DualTrackResultCard.tsx`

```tsx
interface ResultCardProps {
  analysisId: string
  datasetName: string
  toolResult: ToolResult
  llmResult: LLMResult
  consistency: ConsistencyInfo
  onFeedback?: (track: 'tool' | 'llm', rating: 'positive' | 'negative') => void
}

// 功能特性
- 默认显示一致性概览（Venn图风格的三个圆）
- 可展开查看每个轨道的详细结果
- 悬停高亮显示差异基因
- 工具轨：表格展示（基因、log2FC、p值）
- LLM轨：推理理由 + 检出基因标签
```

#### UI 布局（默认收起状态）
```
┌────────────────────────────────────────────────────────────────┐
│  🔬 双轨分析结果 - dataset_001                          [收起] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│     ┌─────────┐    ┌─────────┐    ┌─────────┐                 │
│     │  共同  │    │ 仅工具  │    │  仅LLM  │                 │
│     │   25   │    │   12    │    │    8    │                 │
│     └─────────┘    └─────────┘    └─────────┘                 │
│                                                                │
│     重合率: 68%                                                │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  [查看详情]  [工具轨]  [LLM轨]  [导出报告]                     │
└────────────────────────────────────────────────────────────────┘
```

#### UI 布局（展开状态）
```
┌────────────────────────────────────────────────────────────────┐
│  🔬 双轨分析结果 - dataset_001                          [展开] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │  工具轨 (scipy)    │  │  大模型轨 (千问)    │             │
│  │  ⏱ 2.3s           │  │  ⏱ 5.1s           │             │
│  ├─────────────────────┤  ├─────────────────────┤             │
│  │ 显著基因: 37个     │  │ 显著基因: 33个      │             │
│  │ ↑上调: 20         │  │ ↑上调: 18           │             │
│  │ ↓下调: 17         │  │ ↓下调: 15           │             │
│  ├─────────────────────┤  ├─────────────────────┤             │
│  │ Gene1   ↑  2.3   │  │ Gene1   ↑          │             │
│  │ Gene2   ↓  -1.8  │  │ Gene3   ↑          │             │
│  │ Gene4   ↑  3.1   │  │ ...                │             │
│  └─────────────────────┘  └─────────────────────┘             │
│                                                                │
│  LLM推理理由: 基于差异表达分析，基因A在treatment组显著上调...   │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  评价此结果: 👍 点赞  |  👎 点踩     [提交]                   │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 反馈闭环机制

#### 前端组件: `FeedbackWidget.tsx`

```tsx
interface FeedbackWidgetProps {
  analysisId: string
  onSubmit?: () => void
}

// 功能
- 整体评价：点赞/点踩按钮
- 可选：添加评论
- 提交后显示"感谢您的反馈"
- 提交到后端 /api/feedbacks
```

#### 反馈数据流
```
用户点击反馈
    ↓
前端收集: { analysis_id, track, rating, comment? }
    ↓
POST /api/feedbacks
    ↓
后端:
  1. 存入 feedbacks 表
  2. 解析关键词，更新 feedback_hints 表
  3. 累加频率或新增记录
```

#### 反馈处理逻辑（后端）
```python
import re

def extract_keywords(text: str) -> list[str]:
    """从文本中提取关键词（基因名、基因ID等）"""
    if not text:
        return []

    keywords = []

    # 匹配基因名模式（如Gene1, gene_abc, AT1G01010等）
    gene_pattern = r'(?:gene[_-]?\w+|AT[1-5CG]\w+|LOC_\w+)'
    genes = re.findall(gene_pattern, text, re.IGNORECASE)
    keywords.extend([g.lower() for g in genes])

    # 匹配常见关键词
    manual_keywords = ['漏检', '误检', '重要', '准确', '遗漏', '错误', '好', '差']
    for kw in manual_keywords:
        if kw in text:
            keywords.append(kw)

    return list(set(keywords))

def process_feedback(feedback: Feedback, db: Session):
    # 1. 存入feedbacks表
    db.add(feedback)

    # 2. 更新feedback_hints摘要表
    if feedback.rating == 'negative':
        hint_type = 'warning'
    else:
        hint_type = 'praise'

    # 从comment中提取关键词（如基因名）
    keywords = extract_keywords(feedback.comment or '')

    for keyword in keywords:
        existing = db.query(FeedbackHint).filter_by(keyword=keyword, track=feedback.track).first()
        if existing:
            existing.frequency += 1
            existing.last_seen = datetime.utcnow()
            existing.summary = feedback.comment[:100]  # 更新摘要
        else:
            db.add(FeedbackHint(keyword=keyword, track=feedback.track, hint_type=hint_type, summary=feedback.comment[:100]))

    db.commit()
```

### 3.4 经验复用（对话提示）

#### 前端组件: `FeedbackHintBanner.tsx`

```tsx
interface FeedbackHintBannerProps {
  datasetId?: string
  context?: string  // 当前对话上下文
}

// 显示逻辑
- 当检测到相关关键词时，显示历史反馈提示
- 位置：消息区域顶部，介于用户输入和AI回复之间
- 样式：柔和的黄色/橙色背景提示条
```

#### UI 布局
```
┌────────────────────────────────────────────────────────────────┐
│  💡 历史反馈提示: 有用户反馈大模型在类似数据中易漏检下调基因   │
│     [查看详情]                                                 │
├────────────────────────────────────────────────────────────────┤
│  🤖 ABC                                                        │
│  基于您的数据集，我发现了以下显著差异表达基因...                │
└────────────────────────────────────────────────────────────────┘
```

#### 后端 API
```python
@router.get("/hints")
async def get_feedback_hints(keyword: str, track: str = None):
    """获取相关反馈提示"""
    hints = db.query(FeedbackHint).filter(
        FeedbackHint.keyword.like(f"%{keyword}%")
    )
    if track:
        hints = hints.filter(FeedbackHint.track == track)
    return hints.order_by(FeedbackHint.frequency.desc()).limit(5).all()
```

---

## 四、技术实现

### 4.1 现有代码复用策略

| 设计文档组件 | 现有组件 | 策略 | 说明 |
|-------------|---------|------|------|
| `AnalysisProgress.tsx` | `ProgressPanel.tsx` | **重构** | 保留Progress组件，添加`currentStep`和`elapsedTime`字段支持 |
| `DualTrackResultCard.tsx` | `ComparisonCard.tsx` | **替换** | 新建组件，现有ComparisonCard可作为内部实现复用 |
| `FeedbackWidget.tsx` | `FeedbackPanel.tsx` | **简化** | 移除track参数，改为整体评价模式 |

### 4.2 新增文件清单

```
src/components/
├── AnalysisProgress.tsx      # 双轨进度显示 (重构自ProgressPanel)
├── DualTrackResultCard.tsx  # 交互式结果卡片 (新建)
├── FeedbackWidget.tsx       # 整体反馈组件 (简化自FeedbackPanel)
└── FeedbackHintBanner.tsx  # 历史反馈提示条 (新建)

src/hooks/
├── useSSE.ts               # SSE连接hook (新建)
└── useFeedbackHints.ts     # 反馈提示hook (新建)

backend/app/models/
├── analysis.py            # Analysis模型 (新建)
└── feedback_hint.py        # FeedbackHint模型 (新建)

backend/app/routers/
└── feedbacks.py           # 扩展hint相关API (修改)
```

### 4.3 API 设计

```python
# 扩展现有 /api/feedbacks 路由
@router.get("/hints")
async def get_feedback_hints(keyword: str, track: str = None, limit: int = 5):
    """获取相关反馈提示"""
    query = db.query(FeedbackHint).filter(
        FeedbackHint.keyword.like(f"%{keyword}%")
    )
    if track:
        query = query.filter(FeedbackHint.track == track)
    return query.order_by(FeedbackHint.frequency.desc()).limit(limit).all()

@router.post("/with-hint")
async def create_feedback_with_hint(feedback: FeedbackCreate, db: Session = Depends(get_db)):
    """创建反馈并自动更新hint"""
    # 1. 创建反馈
    db_feedback = Feedback(**feedback.dict())
    db.add(db_feedback)

    # 2. 更新hint
    process_feedback(db_feedback, db)

    db.commit()
    return db_feedback
```

### 4.3 页面集成

修改 `ChatPage.tsx`:
1. 消息类型扩展: 添加 `'progress'` 和 `'result'` 类型
2. 渲染逻辑: 根据消息类型显示对应组件
3. SSE连接: 分析时建立，分析完成后关闭

---

## 五、用户体验流程

```
1. 用户输入: "帮我分析这个数据集"
2. 前端检测意图 → 打开SSE连接
3. 显示 AnalysisProgress 组件，双轨进度并行
4. 后端推送进度 → 前端实时更新
5. 分析完成 → 显示 DualTrackResultCard
6. 用户查看结果 → 点击反馈
7. 提交反馈 → 后端更新数据库 + 生成hint
8. 用户下次查询相关数据 → 显示 FeedbackHintBanner
```

---

## 六、验收标准

### 6.1 流式进度推送
- [ ] 双轨进度条并行显示
- [ ] 进度实时更新（每秒至少1次）
- [ ] 完成后自动收起，显示耗时

### 6.2 交互式结果卡片
- [ ] 默认收起，显示一致性概览
- [ ] 点击可展开查看详情
- [ ] 工具轨显示表格（含log2FC、p值）
- [ ] LLM轨显示推理理由

### 6.3 反馈闭环
- [ ] 点赞/点踩按钮可用
- [ ] 可添加评论
- [ ] 提交后数据存入数据库

### 6.4 经验复用
- [ ] 相关关键词触发时显示提示条
- [ ] 提示条显示历史反馈摘要
- [ ] 点击可查看详情

---

## 七、后续迭代

- MVP阶段使用SQLite，后续可迁移至Neo4j
- 可添加：多维度评分、基因级反馈详情页
- 可扩展：用户反馈统计面板、管理员查看所有反馈
