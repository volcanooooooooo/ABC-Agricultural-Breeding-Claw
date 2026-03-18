# 前端交互重构 - 设计文档

**版本**: 1.1
**日期**: 2026-03-17
**状态**: 待审批

---

## 1. 概述

### 1.1 目标

重构育种 AI 科学家系统前端交互，从传统后台管理系统风格转变为极简科技感设计。

### 1.2 设计原则

- **极简白玉** — 浅米白背景，大量留白，无多余边框
- **纯黑白强调** — 无彩色，文字为主，深灰做层次
- **高级交互** — 丝滑过渡、智能联想、打字机效果、骨架屏

### 1.3 技术决策

- **样式策略**: 完全推翻现有样式，使用 CSS + Ant Design ConfigProvider 深度定制
- **动画方案**: 纯 CSS transition + CSS animation（不使用 Framer Motion）
- **响应式**: 仅桌面端（>= 1024px）

---

## 2. 视觉设计

### 2.1 色彩系统

| 用途 | 颜色 | 色值 |
|------|------|------|
| 背景 | 米白 | `#FAFAF9` |
| 卡片背景 | 纯白 | `#FFFFFF` |
| 主要文字 | 深炭黑 | `#1A1A1A` |
| 次要文字 | 中灰 | `#6B6B6B` |
| 边框/分割线 | 浅灰 | `#E5E5E5` |
| 悬停态 | 浅灰背景 | `#F5F5F5` |
| 输入框背景 | 极浅灰 | `#F0F0F0` |
| 禁用态 | 浅灰 | `#D4D4D4` |
| 错误色 | 深红（仅用于错误） | `#DC2626` |
| 成功色 | 深绿（仅用于成功） | `#16A34A` |

### 2.2 Design Tokens

```typescript
const tokens = {
  colors: {
    bg: '#FAFAF9',
    card: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#6B6B6B',
    border: '#E5E5E5',
    hover: '#F5F5F5',
    input: '#F0F0F0',
    disabled: '#D4D4D4',
    error: '#DC2626',
    success: '#16A34A',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  typography: {
    h1: { size: 24, weight: 600 },
    h2: { size: 18, weight: 600 },
    h3: { size: 16, weight: 600 },
    body: { size: 14, weight: 400 },
    small: { size: 12, weight: 400 },
  },
  animation: {
    fast: '150ms ease-out',
    normal: '200ms ease-out',
    slow: '300ms ease-out',
  }
}
```

### 2.3 字体

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
```

字号:
- 页面标题: 24px / 600 weight
- 卡片标题: 16px / 600 weight
- 正文: 14px / 400 weight
- 辅助文字: 12px / 400 weight

### 2.4 视觉效果

- 卡片阴影: `0 1px 3px rgba(0,0,0,0.04)`
- 悬停阴影: `0 4px 12px rgba(0,0,0,0.06)`
- 圆角: 卡片 12px，按钮/输入框 8px，消息气泡 16px
- 过渡动画: 200ms ease-out

---

## 3. 页面布局

### 3.1 整体结构

```
┌─────────────────────────────────────────┐
│              页面内容区                  │
│           (内容自上而下)                 │
│                                         │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐        │
│  │对话│  │本体│  │分析│  │设置│        │
│  └────┘  └────┘  └────┘  └────┘        │
│              底部 Dock 导航              │
└─────────────────────────────────────────┘
```

### 3.2 底部 Dock 栏

- **位置**: 固定底部，z-index: 100，position: fixed
- **尺寸**: 高度 64px，宽度 100% 最大 480px 居中
- **样式**:
  - 毛玻璃效果: `backdrop-filter: blur(12px)`
  - 背景: `rgba(255,255,255,0.85)`
  - 上边框: 1px solid #E5E5E5
  - 圆角顶部: 24px
- **内容**:
  - 4个导航项，水平均匀分布（flex: 1）
  - 图标(20px) + 文字(12px)
  - 选中态: 文字 `#1A1A1A` + 底部1px黑线指示器
  - 未选中: 文字 `#6B6B6B`
  - 悬停: translateY(-2px) + 背景 #F5F5F5

### 3.3 页面容器

- 最大宽度: 1200px（居中）
- 内边距: 32px
- 最小高度: calc(100vh - 64px - 48px)（减去 Dock 和上下边距）

---

## 4. 对话页面

### 4.1 布局

全屏沉浸式对话，无分栏。

```
┌─────────────────────────────────────────┐
│  "育种 AI 科学家"  标题                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🤖 AI 消息                          │   │
│  └─────────────────────────────────┘   │
│                                         │
│           ┌─────────────────┐           │
│           │ 用户消息           │         │
│           └─────────────────┘           │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 📊 结果卡片 (嵌入)                 │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐│
│  │ 输入框...                        [发送]│
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
              底部 Dock
```

### 4.2 消息气泡

| 类型 | 样式 |
|------|------|
| 用户消息 | 右侧对齐，背景 `#F0F0F0`，圆角 16px 16px 4px 16px |
| AI消息 | 左侧对齐，白色背景 `#FFFFFF`，边框 1px #E5E5E5，圆角 16px 16px 16px 4px |
| 时间戳 | 消息下方居中（用户靠右，AI靠左），12px 灰色，每10分钟显示一次 |

### 4.3 AI 打字机效果

- 逐字显示，每字间隔 **30ms**
- 光标: 闪烁的竖线 `|` (颜色 #6B6B6B)
- 完成后光标淡出（200ms）
- 速度可配置

```css
@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
.cursor { animation: cursor-blink 1s infinite; }
```

### 4.4 嵌入结果卡片

对话流中嵌入的组件:

| 组件 | 样式 |
|------|------|
| 数据表格 | 无竖线，表头背景 #F5F5F5，行高 40px |
| 图表 | 无边框，左上角标题 |
| 任务卡片 | 白色背景，顶部进度条（高度 3px） |
| 引用块 | 左侧 2px #1A1A1A 竖线，背景 #F5F5F5，12px 字号 |

### 4.5 输入区域

- **位置**: 页面底部，固定高度 72px
- **样式**:
  - 输入框: 圆角 24px，背景 #F0F0F0，border: none
  - 高度: 48px
  - 内边距: 0 16px
  - 发送按钮: 圆形 40px，背景 #1A1A1A，图标白色
- **交互**:
  - 输入框聚焦: 背景 #E5E5E5 + box-shadow: 0 0 0 2px rgba(26,26,26,0.1)
  - 发送按钮悬停: background #333
  - 发送按钮点击: transform scale(0.95)
  - 发送中: 按钮内旋转 spinner

### 4.6 智能联想

- **触发**: 输入 >= 2 个字符后显示
- **位置**: 输入框下方，向上展开
- **样式**:
  - 背景: #FFFFFF
  - 边框: 1px #E5E5E5
  - 圆角: 0 0 12px 12px
  - 最大高度: 200px，溢出滚动
  - 选项: 高度 36px，悬停背景 #F5F5F5
- **数据**: 预设快捷指令 + 历史输入匹配
- **选中**: 点击或 Enter 填充

---

## 5. 本体管理页面

### 5.1 布局

- 顶部: 搜索栏 + 操作按钮
- 中间: 画布（React Flow）
- 底部: Dock

### 5.2 搜索栏

- 圆角: 24px
- 背景: #F0F0F0
- 边框: none
- 左侧: 搜索图标（#6B6B6B）
- 右侧: 清除按钮（聚焦且有内容时显示）

### 5.3 操作按钮

- 图标按钮（24px）
- 悬停: 背景 #F5F5F5 + 轻微上移
- 工具提示: 悬停 500ms 后显示文字

### 5.4 节点样式

- 背景: #FFFFFF
- 边框: 1px #E5E5E5
- 圆角: 8px
- 选中: border 2px #1A1A1A
- 类型图标区分（无颜色）

---

## 6. 数据分析页面

### 6.1 布局

- 顶部: 数据集选择器
- 中间: 分析配置（可折叠）
- 底部: 结果展示区

### 6.2 数据集选择器

- 下拉框: 圆角 8px，无边框
- 选中显示为 tag（背景 #F5F5F5）

### 6.3 分析配置

- 手风琴折叠面板
- 面板头: 左侧文字 + 右侧展开图标
- 面板内容: 内部 16px 间距

### 6.4 结果展示

- 无边框图表
- 图表切换: 图标按钮组（折线/柱状/散点）

---

## 7. 设置页面

### 7.1 布局

- 纯文字表单，无卡片包装
- 分组标题（18px 粗体）+ 垂直排列表单项

### 7.2 表单项

- 标签: 14px，#6B6B6B，上方显示
- 输入框: 无边框，底部 1px #E5E5E5 划线
- 聚焦: 底部划线变 #1A1A1A
- 错误: 底部划线变 #DC2626 + 下方错误提示（12px 红色）

---

## 8. 交互细节

### 8.1 页面切换

- 淡入淡出: opacity 0→1
- 轻微上移: translateY 8px→0
- 时长: 200ms，ease-out
- 同时进行

```css
@keyframes page-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.page-content { animation: page-enter 200ms ease-out; }
```

### 8.2 加载状态

#### 骨架屏动画

```css
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}
.skeleton {
  background: linear-gradient(90deg, #F0F0F0 25%, #E5E5E5 50%, #F0F0F0 75%);
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
}
```

#### 骨架屏组件

| 类型 | 尺寸 |
|------|------|
| 文本行 | 宽 60-100%，高 14px |
| 头像 | 40px 圆形 |
| 卡片 | 宽 100%，高 80px |
| 按钮 | 宽 80px，高 32px |

### 8.3 按钮反馈

- 点击: `transform: scale(0.95)`，100ms
- 悬停: 背景变深
- 禁用: opacity 0.5，cursor not-allowed

### 8.4 滚动

- 滚动条: 宽度 6px，背景透明，hover 时 #D4D4D4

---

## 9. 错误与空状态

### 9.1 错误状态

- **Toast 提示**:
  - 位置: 顶部居中
  - 背景: #FFFFFF
  - 边框: 1px #DC2626
  - 文字: #DC2626
  - 圆角: 8px
  - 阴影: 0 4px 12px rgba(0,0,0,0.1)
  - 自动消失: 3秒

- **表单错误**:
  - 输入框底部边框变红
  - 下方显示错误文字（12px，#DC2626）

- **页面级错误**:
  - 居中显示错误图标 + 文字 + 重试按钮

### 9.2 空状态

- 居中显示
- 图标（灰色）+ 标题（16px）+ 描述（14px，#6B6B6B）
- 可选操作按钮

---

## 10. 组件清单

| 组件 | 文件 | 描述 |
|------|------|------|
| DockNav | components/DockNav.tsx | 底部导航栏 |
| ChatMessage | components/ChatMessage.tsx | 消息气泡 |
| TypewriterText | components/TypewriterText.tsx | 打字机文字 |
| ResultCard | components/ResultCard.tsx | 结果卡片 |
| DataTable | components/DataTable.tsx | 极简数据表格 |
| Skeleton | components/Skeleton.tsx | 骨架屏 |
| MinimalInput | components/MinimalInput.tsx | 极简输入框 |
| AutoComplete | components/AutoComplete.tsx | 智能联想 |
| MinimalButton | components/MinimalButton.tsx | 极简按钮 |
| PageTransition | components/PageTransition.tsx | 页面切换动画 |

---

## 11. Ant Design 定制

### 11.1 ConfigProvider 配置

```tsx
<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#1A1A1A',
      colorBgContainer: '#FFFFFF',
      colorBgElevated: '#FFFFFF',
      colorBgLayout: '#FAFAF9',
      colorBorder: '#E5E5E5',
      colorText: '#1A1A1A',
      colorTextSecondary: '#6B6B6B',
      borderRadius: 8,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", ...',
    },
    components: {
      Button: {
        borderRadius: 8,
        controlHeight: 36,
      },
      Input: {
        borderRadius: 24,
        controlHeight: 48,
      },
      Card: {
        borderRadius: 12,
      },
    }
  }}
>
```

### 11.2 需要覆盖的组件

| 组件 | 覆盖内容 |
|------|----------|
| Button | 去除边框，圆形按钮特殊处理 |
| Input | 去除边框，圆角调整 |
| Card | 阴影调整，去除多余边框 |
| Menu | 移除，用于 Dock |
| Table | 无竖线，表头样式 |

---

## 12. 验收标准

- [ ] 整体视觉为极简白玉风格，无彩色强调
- [ ] 底部 Dock 导航正常切换，悬停有上浮效果
- [ ] 对话消息正确显示（用户右、AI左）
- [ ] AI 回复有打字机效果 + 闪烁光标
- [ ] 页面切换有淡入淡出+位移动画
- [ ] 加载显示骨架屏（shimmer 动画）
- [ ] 按钮点击有缩放反馈 (scale 0.95)
- [ ] 输入框有智能联想下拉
- [ ] 表单错误有红色边框 + 提示文字
- [ ] 空状态有居中占位显示
- [ ] 所有页面保持视觉一致性


