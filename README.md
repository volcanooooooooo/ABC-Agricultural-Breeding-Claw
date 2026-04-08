# 育种科学家 AI 助手 — 前端项目文档

## 项目概述

面向育种科研人员的 AI 对话分析平台。用户通过自然语言描述分析需求，系统自动匹配数据集、调用统计工具与 LLM 双轨分析，输出差异基因结果、火山图、知识本体图谱等可视化内容。

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 5 |
| UI 组件 | Ant Design 5 |
| 路由 | React Router v6 |
| HTTP | Axios |
| 图表 | Recharts |
| 流程图 | @xyflow/react |
| Markdown | react-markdown + remark-gfm |

---

## 目录结构

```
src/
├── api/
│   ├── client.ts          # Axios 实例、所有 API 方法、类型定义
│   └── auth.ts            # 认证相关 API
├── context/
│   └── AuthContext.tsx    # 全局用户认证状态
├── hooks/
│   ├── useSSE.ts          # SSE 长连接 Hook（分析进度推送）
│   └── useFeedbackHints.ts
├── pages/
│   ├── ChatPage.tsx       # 主对话页（核心页面）
│   ├── OntologyPage.tsx   # 知识本体图谱页
│   ├── AnalysisPage.tsx   # 分析历史页
│   └── SettingsPage.tsx   # 系统设置页
├── components/
│   ├── DualTrackResultCard.tsx   # 双轨分析结果卡片（工具+LLM）
│   ├── AnalysisResultCard.tsx    # 简单分析结果卡片
│   ├── AnalysisProgress.tsx      # 分析进度展示
│   ├── DatasetSelector.tsx       # 数据集选择器
│   ├── GeneDetailModal.tsx       # 基因详情弹窗
│   ├── GeneInfoPanel.tsx         # 基因信息侧边面板
│   ├── OntologyModal.tsx         # 知识本体弹窗
│   ├── FeedbackPanel.tsx         # 反馈面板
│   ├── FeedbackWidget.tsx        # 反馈组件
│   ├── FeedbackHintBanner.tsx    # 反馈提示横幅
│   ├── FileUploader.tsx          # 文件上传组件
│   ├── ComparisonCard.tsx        # 对比卡片
│   ├── ProgressPanel.tsx         # 进度面板
│   └── AuthModal.tsx             # 登录/注册弹窗
├── App.tsx
├── main.tsx
└── index.css                     # 全局 CSS 变量 + 主题
```

---

## 路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | ChatPage | 主对话页，默认入口 |
| `/ontology` | OntologyPage | 知识本体图谱浏览 |
| `*` | → `/` | 未匹配路由重定向 |

---

## 核心功能

### 1. 对话分析（ChatPage）

主页面，承载所有核心交互逻辑。

**会话管理**
- 多会话支持，会话列表持久化到 `localStorage`
- 新建、切换、删除会话

**消息类型**

| type | 说明 |
|------|------|
| `text` | 普通文本 / Markdown |
| `progress` | 分析进度条（SSE 实时推送） |
| `analysis` | 双轨分析结果卡片 |
| `dataset-select` | 数据集候选选择卡片 |
| `dataset-selected` | 已选数据集确认 |
| `step` | 分析步骤说明 |
| `gene-query` | 基因查询结果 |

**意图识别**
- 分析意图 → 触发双轨分析流程
- 基因查询意图 → 打开 GeneDetailModal
- 知识本体意图 → 打开 OntologyModal
- 普通对话 → 调用 `/api/chat/`

**斜杠命令**

| 命令 | 功能 |
|------|------|
| `/tools` | 展示所有可用分析工具列表 |
| `/datasets` | 展示当前可用数据集列表 |

输入 `/` 自动弹出命令提示面板，支持 `↑` `↓` 键导航，`Enter` 确认，`Esc` 关闭。

### 2. 双轨分析

分析流程分两条并行轨道：

- **Tool 轨道**：统计方法（DESeq2 / t-test 等）计算差异基因
- **LLM 轨道**：大模型基于表达数据推理显著基因

两轨结果通过一致性分析（overlap rate）交叉验证，结果展示在 `DualTrackResultCard` 中，包含：
- 显著基因列表（TOP10 上调 / 下调）
- 火山图（按需加载，30% 随机采样渲染）
- 一致性统计
- 用户反馈（👍 / 👎）

### 3. SSE 实时进度

分析任务通过 `useSSE` Hook 订阅后端 SSE 流，实时推送各阶段进度：

```
init → tool（统计分析）→ llm（模型推理）→ consistency（一致性计算）
```

支持取消正在进行的分析任务。

### 4. 知识本体图谱（OntologyPage / OntologyModal）

基于 `@xyflow/react` 渲染节点关系图，节点类型包括：

`Dataset` / `Sample` / `Gene` / `Measurement` / `ProcessStep` / `Tool` / `Result` / `Conclusion` / `genotype` / `trait` / `metabolome` / `environment` / `method`

### 5. 数据集管理

- 支持 CSV 格式基因表达矩阵上传
- 数据集元信息：基因数、样本数、分组信息
- 分析时自动匹配或手动选择数据集

---

## API 接口

所有请求通过 `/api` 前缀代理到后端，Bearer Token 认证。

| 模块 | 前缀 | 主要接口 |
|------|------|---------|
| 对话 | `/api/chat/` | POST 发送消息 |
| 分析 | `/api/analysis/` | compare、results、cancel |
| 数据集 | `/api/datasets/` | getAll、upload、delete |
| 本体 | `/api/ontology/` | graph、nodes、edges、search |
| 反馈 | `/api/feedbacks/` | create、getByAnalysis |
| 配置 | `/api/config/llm` | get、update、test |
| 认证 | `/api/auth/` | login、register |

---

## 认证

- JWT Token 存储于 `localStorage`
- 请求拦截器自动注入 `Authorization: Bearer <token>`
- 响应拦截器捕获 401，自动清除 Token
- 未登录用户可使用部分功能，分析类操作需登录

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（需后端同时运行）
npm run dev

# 构建生产包
npm run build
```

后端默认运行在 `http://localhost:8000`，Vite 配置代理 `/api` 到后端。

---

## 主题与样式

全局使用 CSS 变量定义主题色，支持暗色风格：

```css
--color-bg-dark        /* 主背景 */
--color-bg-card        /* 卡片背景 */
--color-bg-input       /* 输入框背景 */
--color-accent         /* 主题色（青色 #00d4ff） */
--color-gold           /* 金色强调 */
--color-text-primary   /* 主文字 */
--color-text-secondary /* 次要文字 */
--color-text-muted     /* 弱化文字 */
--color-border         /* 边框色 */
--gradient-accent      /* 渐变主题色 */
--shadow-card          /* 卡片阴影 */
```
