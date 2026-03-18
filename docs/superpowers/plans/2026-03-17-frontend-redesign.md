# 前端交互重构 - 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将育种 AI 科学家前端从传统后台管理系统风格重构为极简白玉风格，包含高级交互（打字机效果、骨架屏、丝滑动画）

**Architecture:**
- 全局 Design Tokens + CSS 变量
- 底部 Dock 导航替代侧边栏
- 页面切换动画 + 组件微交互
- Ant Design ConfigProvider 深度定制

**Tech Stack:** React 18, TypeScript, CSS Modules, Ant Design, React Flow

---

## Chunk 1: 全局样式与 Design Tokens

### Task 1: 创建全局 CSS 变量文件

**Files:**
- Create: `.worktrees/frontend/src/styles/tokens.css`
- Modify: `.worktrees/frontend/src/index.css`

- [ ] **Step 1: 创建 tokens.css**

```css
/* Design Tokens */
:root {
  /* Colors */
  --color-bg: #FAFAF9;
  --color-card: #FFFFFF;
  --color-text: #1A1A1A;
  --color-text-secondary: #6B6B6B;
  --color-border: #E5E5E5;
  --color-hover: #F5F5F5;
  --color-input: #F0F0F0;
  --color-disabled: #D4D4D4;
  --color-error: #DC2626;
  --color-success: #16A34A;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --spacing-xxl: 32px;

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Typography */
  --font-h1: 600 24px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-h2: 600 18px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-h3: 600 16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-body: 400 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-small: 400 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  /* Animation */
  --animation-fast: 150ms ease-out;
  --animation-normal: 200ms ease-out;
  --animation-slow: 300ms ease-out;

  /* Shadows */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.04);
  --shadow-hover: 0 4px 12px rgba(0,0,0,0.06);

  /* Layout */
  --dock-height: 64px;
  --page-max-width: 1200px;
}

/* Global Reset */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--color-bg);
  font: var(--font-body);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  min-height: 100vh;
  background: var(--color-bg);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-disabled);
}

/* Animation Classes */
@keyframes page-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-enter {
  animation: page-enter var(--animation-normal) forwards;
}

@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
}

.skeleton {
  background: linear-gradient(90deg, var(--color-input) 25%, var(--color-border) 50%, var(--color-input) 75%);
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.cursor-blink {
  display: inline-block;
  animation: cursor-blink 1s infinite;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 2: 更新 index.css**

```css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  min-height: 100vh;
}

/* Import tokens */
@import './styles/tokens.css';
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/frontend
git add src/styles/tokens.css src/index.css
git commit -m "feat: add global design tokens and CSS variables"
```

---

### Task 2: 创建 Ant Design 定制配置

**Files:**
- Create: `.worktrees/frontend/src/styles/theme.ts`

- [ ] **Step 1: 创建 theme.ts**

```typescript
import { ThemeConfig } from 'antd'

export const antTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1A1A1A',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorBgLayout: '#FAFAF9',
    colorBorder: '#E5E5E5',
    colorText: '#1A1A1A',
    colorTextSecondary: '#6B6B6B',
    borderRadius: 8,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    fontSize: 14,
    controlHeight: 36,
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 36,
      primaryShadow: 'none',
    },
    Input: {
      borderRadius: 24,
      controlHeight: 48,
    },
    Card: {
      borderRadius: 12,
    },
    Table: {
      borderRadius: 8,
    },
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/theme.ts
git commit -m "feat: add Ant Design theme configuration"
```

---

## Chunk 2: 核心组件开发

### Task 3: 创建 ChatMessage 消息气泡组件

**Files:**
- Create: `.worktrees/frontend/src/components/ChatMessage.tsx`
- Create: `.worktrees/frontend/src/components/ChatMessage.module.css`

- [ ] **Step 1: 创建 ChatMessage.module.css**

```css
.message {
  display: flex;
  margin-bottom: var(--spacing-lg);
}

.message.user {
  justify-content: flex-end;
}

.message.assistant {
  justify-content: flex-start;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message.user .avatar {
  background: var(--color-input);
  border: none;
}

.bubble {
  max-width: 75%;
  padding: var(--spacing-md) var(--spacing-lg);
  font: var(--font-body);
  line-height: 1.6;
}

.message.user .bubble {
  background: var(--color-input);
  border-radius: 16px 16px 4px 16px;
}

.message.assistant .bubble {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 16px 16px 16px 4px;
}
```

- [ ] **Step 2: 创建 ChatMessage.tsx**

```tsx
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import TypewriterText from './TypewriterText'
import { ChatMessageSkeleton } from './Skeleton'
import styles from './ChatMessage.module.css'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isLoading?: boolean
}

export default function ChatMessage({ role, content, isLoading }: ChatMessageProps) {
  return (
    <div className={`${styles.message} ${styles[role]}`}>
      <div className={styles.avatar}>
        {role === 'user' ? <UserOutlined /> : <RobotOutlined />}
      </div>
      <div className={styles.bubble}>
        {isLoading ? (
          <ChatMessageSkeleton />
        ) : role === 'assistant' ? (
          <TypewriterText text={content} />
        ) : (
          content
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatMessage.tsx src/components/ChatMessage.module.css
git commit -m "feat: add ChatMessage component"
```

---

### Task 4: 创建 ResultCard 结果卡片组件

**Files:**
- Create: `.worktrees/frontend/src/components/ResultCard.tsx`
- Create: `.worktrees/frontend/src/components/ResultCard.module.css`

- [ ] **Step 1: 创建 ResultCard.module.css**

```css
.card {
  background: var(--color-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.header {
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.title {
  font: var(--font-h3);
  margin: 0;
}

.content {
  padding: var(--spacing-lg);
}

.progressBar {
  height: 3px;
  background: var(--color-input);
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: var(--color-text);
  transition: width 300ms ease-out;
}
```

- [ ] **Step 2: 创建 ResultCard.tsx**

```tsx
import styles from './ResultCard.module.css'

interface ResultCardProps {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}

interface ProgressCardProps {
  title: string
  progress: number
}

export default function ResultCard({ title, icon, children }: ResultCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {icon && <span>{icon}</span>}
        <h3 className={styles.title}>{title}</h3>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  )
}

export function ProgressCard({ title, progress }: ProgressCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
      </div>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ResultCard.tsx src/components/ResultCard.module.css
git commit -m "feat: add ResultCard component"
```

---

### Task 5: 创建 DockNav 底部导航组件
}

.dockItem {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--animation-normal);
  position: relative;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
}

.dockItem:hover {
  background: var(--color-hover);
  transform: translateY(-2px);
}

.dockItem.active {
  color: var(--color-text);
}

.dockItem.active::after {
  content: '';
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2px;
  background: var(--color-text);
  border-radius: 1px;
}

.dockIcon {
  font-size: 20px;
  margin-bottom: 2px;
}

.dockLabel {
  font-size: 12px;
  line-height: 1;
}
```

- [ ] **Step 2: 创建 DockNav.tsx**

```tsx
import { useNavigate, useLocation } from 'react-router-dom'
import { MessageOutlined, ApiOutlined, LineChartOutlined, SettingOutlined } from '@ant-design/icons'
import styles from './DockNav.module.css'

interface DockNavProps {
  className?: string
}

const navItems = [
  { key: '/', icon: <MessageOutlined />, label: '对话' },
  { key: '/ontology', icon: <ApiOutlined />, label: '本体' },
  { key: '/analysis', icon: <LineChartOutlined />, label: '分析' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
]

export default function DockNav({ className }: DockNavProps) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className={`${styles.dockContainer} ${className || ''}`}>
      <div className={styles.dock}>
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`${styles.dockItem} ${location.pathname === item.key ? styles.active : ''}`}
            onClick={() => navigate(item.key)}
          >
            <span className={styles.dockIcon}>{item.icon}</span>
            <span className={styles.dockLabel}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DockNav.tsx src/components/DockNav.module.css
git commit -m "feat: add DockNav component with frosted glass effect"
```

---

### Task 6: 创建 TypewriterText 打字机效果组件

**Files:**
- Create: `.worktrees/frontend/src/components/TypewriterText.tsx`
- Create: `.worktrees/frontend/src/components/TypewriterText.module.css`

- [ ] **Step 1: 创建 TypewriterText.module.css**

```css
.container {
  display: inline;
}

.cursor {
  display: inline-block;
  animation: cursor-blink 1s infinite;
  color: var(--color-text-secondary);
  font-weight: 300;
}

@keyframes cursor-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
```

- [ ] **Step 2: 创建 TypewriterText.tsx**

```tsx
import { useState, useEffect, useRef } from 'react'
import styles from './TypewriterText.module.css'

interface TypewriterTextProps {
  text: string
  speed?: number
  onComplete?: () => void
}

export default function TypewriterText({ text, speed = 30, onComplete }: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const indexRef = useRef(0)

  useEffect(() => {
    setDisplayedText('')
    setIsComplete(false)
    indexRef.current = 0
  }, [text])

  useEffect(() => {
    if (isComplete || indexRef.current >= text.length) {
      if (!isComplete && onComplete) {
        setIsComplete(true)
        onComplete()
      }
      return
    }

    const timer = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1))
        indexRef.current++
      } else {
        clearInterval(timer)
        setIsComplete(true)
        if (onComplete) onComplete()
      }
    }, speed)

    return () => clearInterval(timer)
  }, [text, speed, isComplete, onComplete])

  return (
    <span className={styles.container}>
      {displayedText}
      {!isComplete && <span className={styles.cursor}>|</span>}
    </span>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TypewriterText.tsx src/components/TypewriterText.module.css
git commit -m "feat: add TypewriterText component with cursor animation"
```

---

### Task 7: 创建 Skeleton 骨架屏组件

**Files:**
- Create: `.worktrees/frontend/src/components/Skeleton.tsx`
- Create: `.worktrees/frontend/src/components/Skeleton.module.css`

- [ ] **Step 1: 创建 Skeleton.module.css**

```css
.skeleton {
  background: linear-gradient(90deg, var(--color-input) 25%, var(--color-border) 50%, var(--color-input) 75%);
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}

.text {
  height: 14px;
  margin-bottom: var(--spacing-sm);
}

.title {
  height: 20px;
  width: 60%;
  margin-bottom: var(--spacing-md);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.card {
  height: 80px;
  width: 100%;
}

.button {
  width: 80px;
  height: 32px;
}
```

- [ ] **Step 2: 创建 Skeleton.tsx**

```tsx
import styles from './Skeleton.module.css'

interface SkeletonProps {
  type?: 'text' | 'title' | 'avatar' | 'card' | 'button'
  width?: string | number
  height?: string | number
  style?: React.CSSProperties
}

export default function Skeleton({ type = 'text', width, height, style }: SkeletonProps) {
  const className = styles[type]

  return (
    <div
      className={className}
      style={{
        width: width || '100%',
        height: height,
        ...style
      }}
    />
  )
}

// Chat message skeleton
export function ChatMessageSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <Skeleton type="avatar" />
      <div style={{ flex: 1 }}>
        <Skeleton type="title" />
        <Skeleton type="text" width="80%" />
        <Skeleton type="text" width="60%" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Skeleton.tsx src/components/Skeleton.module.css
git commit -m "feat: add Skeleton component with shimmer animation"
```

---

### Task 8: 创建 MinimalInput 极简输入框组件

**Files:**
- Create: `.worktrees/frontend/src/components/MinimalInput.tsx`
- Create: `.worktrees/frontend/src/components/MinimalInput.module.css`

- [ ] **Step 1: 创建 MinimalInput.module.css**

```css
.inputWrapper {
  position: relative;
  width: 100%;
}

.input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  background: var(--color-input);
  border: none;
  border-radius: var(--radius-full);
  font-size: 14px;
  color: var(--color-text);
  outline: none;
  transition: all var(--animation-normal);
}

.input::placeholder {
  color: var(--color-text-secondary);
}

.input:focus {
  background: var(--color-border);
  box-shadow: 0 0 0 2px rgba(26, 26, 26, 0.1);
}

.input:disabled {
  background: var(--color-hover);
  color: var(--color-disabled);
  cursor: not-allowed;
}

.sendButton {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-text);
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--animation-fast);
}

.sendButton:hover {
  background: #333333;
}

.sendButton:active {
  transform: translateY(-50%) scale(0.95);
}

.sendButton:disabled {
  background: var(--color-disabled);
  cursor: not-allowed;
}
```

- [ ] **Step 2: 创建 MinimalInput.tsx**

```tsx
import { SendOutlined } from '@ant-design/icons'
import styles from './MinimalInput.module.css'

interface MinimalInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
}

export default function MinimalInput({
  value,
  onChange,
  onSubmit,
  placeholder = '输入你的问题...',
  disabled = false,
  loading = false,
}: MinimalInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.()
    }
  }

  return (
    <div className={styles.inputWrapper}>
      <input
        type="text"
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button
        className={styles.sendButton}
        onClick={onSubmit}
        disabled={disabled || loading || !value.trim()}
      >
        {loading ? (
          <span className="ant-spin ant-spin-sm" />
        ) : (
          <SendOutlined />
        )}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MinimalInput.tsx src/components/MinimalInput.module.css
git commit -m "feat: add MinimalInput component with send button"
```

---

### Task 9: 创建 AutoComplete 智能联想组件

**Files:**
- Create: `.worktrees/frontend/src/components/AutoComplete.tsx`
- Create: `.worktrees/frontend/src/components/AutoComplete.module.css`

- [ ] **Step 1: 创建 AutoComplete.module.css**

```css
.wrapper {
  position: relative;
  width: 100%;
}

.dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 0;
}

.option {
  padding: 10px 16px;
  cursor: pointer;
  transition: background var(--animation-fast);
  font-size: 14px;
}

.option:hover {
  background: var(--color-hover);
}

.option:first-child {
  border-radius: 12px 12px 0 0;
}

.option:last-child {
  border-radius: 0 0 0 0;
}

.highlight {
  color: var(--color-text);
  font-weight: 600;
}
```

- [ ] **Step 2: 创建 AutoComplete.tsx**

```tsx
import { useState, useRef, useEffect } from 'react'
import styles from './AutoComplete.module.css'

interface Suggestion {
  text: string
  icon?: React.ReactNode
}

interface AutoCompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect?: (value: string) => void
  suggestions?: Suggestion[]
  placeholder?: string
  disabled?: boolean
  onSubmit?: () => void
  loading?: boolean
}

export default function AutoComplete({
  value,
  onChange,
  onSelect,
  suggestions = [],
  placeholder = '输入你的问题...',
  disabled = false,
  onSubmit,
  loading = false,
}: AutoCompleteProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const showSuggestions = value.length >= 2 && suggestions.length > 0

  useEffect(() => {
    setShowDropdown(showSuggestions)
  }, [showSuggestions])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.()
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  const handleOptionClick = (text: string) => {
    onChange(text)
    onSelect?.(text)
    setShowDropdown(false)
  }

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className={styles.highlight}>{part}</span>
      ) : (
        part
      )
    )
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      {showDropdown && (
        <div className={styles.dropdown}>
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={styles.option}
              onClick={() => handleOptionClick(suggestion.text)}
            >
              {suggestion.icon} {highlightMatch(suggestion.text, value)}
            </div>
          ))}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          style={{
            width: '100%',
            height: '48px',
            padding: '0 16px',
            paddingRight: '52px',
            background: 'var(--color-input)',
            border: 'none',
            borderRadius: '24px',
            fontSize: '14px',
            color: 'var(--color-text)',
            outline: 'none',
            transition: 'all 200ms ease-out',
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => value.length >= 2 && suggestions.length > 0 && setShowDropdown(true)}
        />
        <button
          style={{
            position: 'absolute',
            right: '4px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--color-text)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 150ms ease-out',
            opacity: disabled || loading || !value.trim() ? 0.5 : 1,
          }}
          onClick={onSubmit}
          disabled={disabled || loading || !value.trim()}
        >
          {loading ? (
            <span className="ant-spin ant-spin-sm" />
          ) : (
            <span style={{ transform: 'rotate(90deg)' }}>➤</span>
          )}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AutoComplete.tsx src/components/AutoComplete.module.css
git commit -m "feat: add AutoComplete component with smart suggestions"
```

---

### Task 10: 创建 PageTransition 页面切换动画组件

**Files:**
- Create: `.worktrees/frontend/src/components/PageTransition.tsx`

- [ ] **Step 1: 创建 PageTransition.tsx**

```tsx
import { ReactNode, useEffect, useState } from 'react'

interface PageTransitionProps {
  children: ReactNode
}

export default function PageTransition({ children }: PageTransitionProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [opacity, setOpacity] = useState(0)
  const [translateY, setTranslateY] = useState(8)

  useEffect(() => {
    setShouldRender(true)
    requestAnimationFrame(() => {
      setOpacity(1)
      setTranslateY(0)
    })
  }, [])

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        transition: 'opacity 200ms ease-out, transform 200ms ease-out',
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PageTransition.tsx
git commit -m "feat: add PageTransition component for smooth page switching"
```

---

## Chunk 3: 页面组件重构

### Task 11: 更新 App.tsx 主布局

**Files:**
- Modify: `.worktrees/frontend/src/App.tsx`

- [ ] **Step 1: 更新 App.tsx**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { antTheme } from './styles/theme'
import DockNav from './components/DockNav'
import PageTransition from './components/PageTransition'
import ChatPage from './pages/ChatPage'
import OntologyPage from './pages/OntologyPage'
import AnalysisPage from './pages/AnalysisPage'
import SettingsPage from './pages/SettingsPage'
import './styles/tokens.css'

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition>
      {children}
    </PageTransition>
  )
}

function App() {
  return (
    <ConfigProvider theme={antTheme}>
      <BrowserRouter>
        <div style={{
          minHeight: '100vh',
          paddingBottom: 'var(--dock-height)',
          background: 'var(--color-bg)'
        }}>
          <Routes>
            <Route path="/" element={<PageWrapper><ChatPage /></PageWrapper>} />
            <Route path="/ontology" element={<PageWrapper><OntologyPage /></PageWrapper>} />
            <Route path="/analysis" element={<PageWrapper><AnalysisPage /></PageWrapper>} />
            <Route path="/settings" element={<PageWrapper><SettingsPage /></PageWrapper>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <DockNav />
        </div>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default function Root() {
  return <App />
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: update App layout with DockNav and transitions"
```

---

### Task 12: 重构 ChatPage 对话页面

**Files:**
- Modify: `.worktrees/frontend/src/pages/ChatPage.tsx`

- [ ] **Step 1: 更新 ChatPage.tsx**

```tsx
import { useState, useRef, useEffect } from 'react'
import { UserOutlined, RobotOutlined, DeleteOutlined } from '@ant-design/icons'
import { chatApi, Message } from '../api/client'
import TypewriterText from '../components/TypewriterText'
import AutoComplete from '../components/AutoComplete'
import { ChatMessageSkeleton } from '../components/Skeleton'

interface ChatMessage extends Message {
  isLoading?: boolean
}

const quickSuggestions = [
  { text: '帮我分析这批水稻的遗传力', icon: '📊' },
  { text: '查找基因型相关的条目', icon: '🔍' },
  { text: '总结这篇论文的方法', icon: '📄' },
  { text: '什么是狭义遗传力？', icon: '❓' },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await chatApi.sendMessage({ message: userMessage.content })
      const assistantContent = response.data.data.response

      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content: assistantContent, isLoading: false }
            : msg
        )
      )
    } catch (error) {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content: '抱歉，发生了一些错误，请稍后重试。', isLoading: false }
            : msg
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setMessages([])
  }

  return (
    <div style={{
      maxWidth: 'var(--page-max-width)',
      margin: '0 auto',
      padding: 'var(--spacing-xl)',
      height: 'calc(100vh - var(--dock-height) - 48px)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--spacing-xl)',
        flexShrink: 0
      }}>
        <h1 style={{
          margin: 0,
          font: 'var(--font-h1)',
          color: 'var(--color-text)'
        }}>
          育种 AI 科学家
        </h1>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '8px 12px',
              borderRadius: '8px',
              transition: 'all var(--animation-fast)',
            }}
          >
            <DeleteOutlined /> 清空对话
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        marginBottom: 'var(--spacing-lg)',
        paddingRight: '8px'
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--color-text-secondary)'
          }}>
            <RobotOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
            <p style={{ margin: 0, font: 'var(--font-body)' }}>
              开始与 AI 育种科学家对话
            </p>
          </div>
        ) : (
          <div>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 'var(--spacing-lg)',
                }}
              >
                <div
                  style={{
                    maxWidth: '75%',
                    display: 'flex',
                    gap: 'var(--spacing-md)',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: msg.role === 'user' ? 'var(--color-input)' : 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                  </div>
                  <div
                    style={{
                      background: msg.role === 'user' ? 'var(--color-input)' : 'var(--color-card)',
                      border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                      borderRadius: msg.role === 'user'
                        ? '16px 16px 4px 16px'
                        : '16px 16px 16px 4px',
                      padding: 'var(--spacing-md) var(--spacing-lg)',
                      font: 'var(--font-body)',
                      lineHeight: 1.6,
                    }}
                  >
                    {msg.isLoading ? (
                      <ChatMessageSkeleton />
                    ) : msg.role === 'assistant' ? (
                      <TypewriterText text={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0 }}>
        <AutoComplete
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          suggestions={quickSuggestions}
          placeholder="输入你的问题..."
          disabled={loading}
          loading={loading}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "refactor: update ChatPage with new design system"
```

---

### Task 13: 重构 OntologyPage 本体页面

**Files:**
- Modify: `.worktrees/frontend/src/pages/OntologyPage.tsx`

- [ ] **Step 1: 更新 OntologyPage.tsx (简化版)**

由于代码较长，核心改动：
1. 移除 Card 边框
2. 使用极简搜索框
3. 按钮改为无边框风格

```tsx
// 关键样式改动:
/*
- Card 样式: 移除 border, 添加 subtle shadow
- 搜索框: 圆角 24px, 背景 var(--color-input)
- 按钮: 移除 type="primary", 使用纯黑样式
- 表格: 移除竖线
*/

// 具体修改:
const cardStyle = {
  background: 'var(--color-card)',
  border: 'none',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
}

const searchStyle = {
  background: 'var(--color-input)',
  border: 'none',
  borderRadius: 'var(--radius-full)',
}

// 搜索框
<Input
  placeholder="搜索节点..."
  prefix={<SearchOutlined style={{ color: 'var(--color-text-secondary)' }} />}
  value={searchText}
  onChange={(e) => setSearchText(e.target.value)}
  style={{ width: 200, ...searchStyle }}
/>

// 按钮
<Button
  style={{
    background: 'var(--color-text)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)'
  }}
>
  新建本体
</Button>
```

- [ ] **Step 2: 完整更新 OntologyPage.tsx**

```tsx
import { useState, useCallback, useEffect } from 'react'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Node, Edge, Connection, NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Button, Modal, Form, Input, Select, Table, message } from 'antd'
import { PlusOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons'
import { ontologyApi, Ontology, OntologyNode } from '../api/client'

// Custom node - minimal style
function CustomNode({ data }: { data: { label: string; nodeType: string } }) {
  return (
    <div style={{
      padding: '8px 16px',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      background: '#fff',
      minWidth: 100,
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{
        fontWeight: 600,
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        marginBottom: 4,
        textTransform: 'uppercase'
      }}>
        {data.nodeType}
      </div>
      <div style={{ font: 'var(--font-body)' }}>{data.label}</div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
}

export default function OntologyPage() {
  const [ontologies, setOntologies] = useState<Ontology[]>([])
  const [selectedOntology, setSelectedOntology] = useState<Ontology | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [nodeModalVisible, setNodeModalVisible] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()
  const [nodeForm] = Form.useForm()

  const fetchOntologies = useCallback(async () => {
    setLoading(true)
    try {
      const response = await ontologyApi.getAll()
      setOntologies(response.data.data)
    } catch (error) {
      message.error('获取本体列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOntologies()
  }, [fetchOntologies])

  const loadOntologyToFlow = (ontology: Ontology) => {
    const flowNodes: Node[] = ontology.nodes.map((node, index) => ({
      id: node.id,
      type: 'custom',
      position: {
        x: (index % 4) * 200 + 50,
        y: Math.floor(index / 4) * 150 + 50,
      },
      data: { label: node.label, nodeType: node.node_type },
    }))

    const flowEdges: Edge[] = ontology.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.relation_type,
      animated: true,
      style: { stroke: '#6B6B6B' },
    }))

    setNodes(flowNodes)
    setEdges(flowEdges)
    setSelectedOntology(ontology)
  }

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, style: { stroke: '#6B6B6B' } }, eds)),
    [setEdges]
  )

  const handleCreateOntology = async (values: { name: string; description: string }) => {
    try {
      const response = await ontologyApi.create({
        name: values.name,
        description: values.description,
        nodes: [],
        edges: [],
      })
      message.success('本体创建成功')
      setModalVisible(false)
      form.resetFields()
      fetchOntologies()
      loadOntologyToFlow(response.data.data)
    } catch (error) {
      message.error('创建失败')
    }
  }

  const handleAddNode = async () => {
    const values = await nodeForm.validateFields()
    if (!selectedOntology) return

    const newNode: OntologyNode = {
      id: `node-${Date.now()}`,
      label: values.label,
      node_type: values.node_type,
      properties: {},
    }

    try {
      const updatedNodes = [...selectedOntology.nodes, newNode]
      await ontologyApi.update(selectedOntology.id, { nodes: updatedNodes })
      message.success('节点添加成功')
      setNodeModalVisible(false)
      nodeForm.resetFields()

      const updatedOntology = { ...selectedOntology, nodes: updatedNodes }
      loadOntologyToFlow(updatedOntology)
    } catch (error) {
      message.error('添加节点失败')
    }
  }

  const handleSave = async () => {
    if (!selectedOntology) return
    try {
      await ontologyApi.update(selectedOntology.id, {
        nodes: selectedOntology.nodes,
        edges: selectedOntology.edges,
      })
      message.success('保存成功')
    } catch (error) {
      message.error('保存失败')
    }
  }

  const filteredNodes = searchText
    ? nodes.filter(node => {
        const label = (node.data as { label?: string }).label || ''
        return label.toLowerCase().includes(searchText.toLowerCase())
      })
    : nodes

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '节点数',
      dataIndex: 'nodes',
      key: 'nodeCount',
      render: (nodes: OntologyNode[]) => nodes?.length || 0
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Ontology) => (
        <Button size="small" onClick={() => handleSelectOntology(record)}>
          查看
        </Button>
      ),
    },
  ]

  return (
    <div style={{
      maxWidth: 'var(--page-max-width)',
      margin: '0 auto',
      padding: 'var(--spacing-xl)',
      height: 'calc(100vh - var(--dock-height) - 48px)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--spacing-xl)',
        flexShrink: 0
      }}>
        <h1 style={{ margin: 0, font: 'var(--font-h1)' }}>本体管理</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          <Input
            placeholder="搜索节点..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              width: 200,
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-input)',
              border: 'none'
            }}
          />
          <Button
            icon={<PlusOutlined />}
            onClick={() => setNodeModalVisible(true)}
            disabled={!selectedOntology}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            添加节点
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSave}
            disabled={!selectedOntology}
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            保存更改
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
            style={{
              background: 'var(--color-text)',
              border: 'none',
              borderRadius: 'var(--radius-md)'
            }}
          >
            新建本体
          </Button>
        </div>
      </div>

      {/* Content */}
      <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flex: 1, overflow: 'hidden' }}>
        {/* Ontology List */}
        <div style={{
          width: 300,
          background: 'var(--color-card)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-lg)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'auto'
        }}>
          <h3 style={{ margin: '0 0 var(--spacing-lg) 0', font: 'var(--font-h3)' }}>本体列表</h3>
          <Table
            dataSource={ontologies}
            columns={columns}
            rowKey="id"
            size="small"
            loading={loading}
            pagination={false}
            style={{ background: 'transparent' }}
          />
        </div>

        {/* Graph */}
        <div style={{
          flex: 1,
          background: 'var(--color-card)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden'
        }}>
          {selectedOntology ? (
            <div style={{ height: '100%' }}>
              <ReactFlow
                nodes={filteredNodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
              >
                <Background color="#E5E5E5" gap={20} />
                <Controls style={{ background: '#fff', borderRadius: 8 }} />
              </ReactFlow>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: 100,
              color: 'var(--color-text-secondary)',
              font: 'var(--font-body)'
            }}>
              请从左侧选择或创建一个本体
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal
        title="新建本体"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        styles={{ body: { padding: 'var(--spacing-lg)' } }}
      >
        <Form form={form} onFinish={handleCreateOntology} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input style={{ borderRadius: 'var(--radius-md)' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} style={{ borderRadius: 'var(--radius-md)' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加节点"
        open={nodeModalVisible}
        onCancel={() => setNodeModalVisible(false)}
        onOk={() => nodeForm.submit()}
      >
        <Form form={nodeForm} onFinish={handleAddNode} layout="vertical">
          <Form.Item name="label" label="节点名称" rules={[{ required: true }]}>
            <Input style={{ borderRadius: 'var(--radius-md)' }} />
          </Form.Item>
          <Form.Item name="node_type" label="节点类型" rules={[{ required: true }]}>
            <Select style={{ borderRadius: 'var(--radius-md)' }}>
              <Select.Option value="genotype">基因型</Select.Option>
              <Select.Option value="phenotype">表型</Select.Option>
              <Select.Option value="environment">环境</Select.Option>
              <Select.Option value="trait">性状</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/OntologyPage.tsx
git commit -m "refactor: update OntologyPage with minimalist design"
```

---

### Task 14: 重构 AnalysisPage 分析页面

**Files:**
- Modify: `.worktrees/frontend/src/pages/AnalysisPage.tsx`

- [ ] **Step 1: 更新 AnalysisPage.tsx**

```tsx
import { useState } from 'react'
import { Card, Select, Button, Table, Space, Empty } from 'antd'
import { PlayOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface DataRecord {
  key: string
  genotype: string
  trait1: number
  trait2: number
  trait3: number
}

const sampleData: DataRecord[] = Array.from({ length: 20 }, (_, i) => ({
  key: `row-${i}`,
  genotype: `G${i + 1}`,
  trait1: Math.round(Math.random() * 100 * 10) / 10,
  trait2: Math.round(Math.random() * 50 * 10) / 10,
  trait3: Math.round(Math.random() * 80 * 10) / 10,
}))

export default function AnalysisPage() {
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
  const [results, setResults] = useState<DataRecord[] | null>(null)

  const columns: ColumnsType<DataRecord> = [
    { title: '基因型', dataIndex: 'genotype', key: 'genotype' },
    { title: '性状1', dataIndex: 'trait1', key: 'trait1' },
    { title: '性状2', dataIndex: 'trait2', key: 'trait2' },
    { title: '性状3', dataIndex: 'trait3', key: 'trait3' },
  ]

  const runAnalysis = () => {
    setResults(sampleData)
  }

  return (
    <div style={{
      maxWidth: 'var(--page-max-width)',
      margin: '0 auto',
      padding: 'var(--spacing-xl)',
      height: 'calc(100vh - var(--dock-height) - 48px)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--spacing-xl)',
        flexShrink: 0
      }}>
        <h1 style={{ margin: 0, font: 'var(--font-h1)' }}>数据分析</h1>
      </div>

      {/* Config */}
      <div style={{
        background: 'var(--color-card)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-xl)',
        boxShadow: 'var(--shadow-card)',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-lg)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              font: 'var(--font-small)',
              color: 'var(--color-text-secondary)'
            }}>
              数据集
            </label>
            <Select
              placeholder="选择数据集"
              value={selectedDataset}
              onChange={setSelectedDataset}
              style={{ width: 200 }}
              options={[
                { value: 'rice', label: '水稻数据集' },
                { value: 'wheat', label: '小麦数据集' },
              ]}
            />
          </div>
          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-sm)',
              font: 'var(--font-small)',
              color: 'var(--color-text-secondary)'
            }}>
              分析方法
            </label>
            <Select
              placeholder="选择方法"
              value={selectedMethod}
              onChange={setSelectedMethod}
              style={{ width: 200 }}
              options={[
                { value: 'heritability', label: '遗传力估计' },
                { value: 'correlation', label: '相关性分析' },
                { value: 'pca', label: '主成分分析' },
              ]}
            />
          </div>
          <Button
            type="primary"
            icon={<PlayOutlined />}
            onClick={runAnalysis}
            disabled={!selectedDataset || !selectedMethod}
            style={{
              background: 'var(--color-text)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              marginTop: 20
            }}
          >
            执行分析
          </Button>
        </div>
      </div>

      {/* Results */}
      <div style={{
        flex: 1,
        background: 'var(--color-card)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-xl)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <h2 style={{ margin: 0, font: 'var(--font-h2)' }}>分析结果</h2>
          {results && (
            <Button
              icon={<DownloadOutlined />}
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              导出
            </Button>
          )}
        </div>

        {results ? (
          <Table
            dataSource={results}
            columns={columns}
            pagination={{ pageSize: 10 }}
            style={{ background: 'transparent' }}
          />
        ) : (
          <Empty
            description="请选择数据集和分析方法后执行"
            style={{ marginTop: 60 }}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/AnalysisPage.tsx
git commit -m "refactor: update AnalysisPage with minimalist design"
```

---

### Task 15: 重构 SettingsPage 设置页面

**Files:**
- Modify: `.worktrees/frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: 更新 SettingsPage.tsx**

```tsx
import { useState } from 'react'
import { Input, Button, message } from 'antd'

interface LLMConfig {
  apiUrl: string
  apiKey: string
  model: string
}

export default function SettingsPage() {
  const [config, setConfig] = useState<LLLConfig>({
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    model: 'qwen-turbo',
  })
  const [loading, setLoading] = useState(false)

  const handleSave = () => {
    setLoading(true)
    setTimeout(() => {
      message.success('配置已保存')
      setLoading(false)
    }, 500)
  }

  const inputStyle = {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--color-border)',
    borderRadius: 0,
    padding: '8px 0',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: 'var(--spacing-sm)',
    font: 'var(--font-small)',
    color: 'var(--color-text-secondary)',
  }

  return (
    <div style={{
      maxWidth: 600,
      margin: '0 auto',
      padding: 'var(--spacing-xl)',
      height: 'calc(100vh - var(--dock-height) - 48px)',
      overflow: 'auto'
    }}>
      <h1 style={{ margin: '0 0 var(--spacing-xxl) 0', font: 'var(--font-h1)' }}>设置</h1>

      <section style={{ marginBottom: 'var(--spacing-xxl)' }}>
        <h2 style={{ margin: '0 0 var(--spacing-xl) 0', font: 'var(--font-h2)' }}>LLM 配置</h2>

        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <label style={labelStyle}>API 地址</label>
          <Input
            value={config.apiUrl}
            onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <label style={labelStyle}>API Key</label>
          <Input.Password
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            style={inputStyle}
            placeholder="请输入 API Key"
          />
        </div>

        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <label style={labelStyle}>模型</label>
          <Input
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            style={inputStyle}
          />
        </div>

        <Button
          type="primary"
          onClick={handleSave}
          loading={loading}
          style={{
            background: 'var(--color-text)',
            border: 'none',
            borderRadius: 'var(--radius-md)'
          }}
        >
          保存配置
        </Button>
      </section>

      <section>
        <h2 style={{ margin: '0 0 var(--spacing-xl) 0', font: 'var(--font-h2)' }}>关于</h2>
        <p style={{ font: 'var(--font-body)', color: 'var(--color-text-secondary)' }}>
          育种 AI 科学家系统 v1.0
        </p>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "refactor: update SettingsPage with minimalist design"
```

---

## Chunk 4: 测试与验证

### Task 16: 本地验证

**Files:**
- Test: 运行开发服务器

- [ ] **Step 1: 启动开发服务器**

```bash
cd .worktrees/frontend
npm run dev
```

- [ ] **Step 2: 验证设计规范**

检查清单:
- [ ] 整体视觉为极简白玉风格，无彩色强调
- [ ] 页面背景为米白色 #FAFAF9
- [ ] 底部 Dock 导航显示，悬停有上浮效果
- [ ] 对话页面消息气泡样式正确（用户右、AI左）
- [ ] AI 回复有打字机效果 + 光标
- [ ] 输入框有智能联想下拉
- [ ] 加载显示骨架屏（shimmer 动画）
- [ ] 页面切换有淡入淡出动画
- [ ] 按钮点击有缩放反馈
- [ ] 表单错误有红色边框 + 提示文字
- [ ] 空状态有居中占位显示
- [ ] 所有页面保持一致风格

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: complete frontend redesign with minimalist styling"
```

---

## 总结

完成所有任务后，前端将具备:
1. **极简白玉风格** — 统一的设计语言
2. **高级交互** — 打字机效果、骨架屏、丝滑动画
3. **底部 Dock 导航** — 创新的导航方式
4. **智能联想** — 提升输入体验
5. **一致的设计系统** — 所有页面遵循同一规范
