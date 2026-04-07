# 知识本体查询弹窗设计

## 概述

将知识本体查询功能从独立页面改为全屏模态框交互，提升用户体验，避免页面路由切换。

## 设计决策

### 核心方案：创建 OntologyModal 组件

- **复用性**：抽取 OntologyPage 核心逻辑为可复用组件
- **交互方式**：全屏覆盖，参考 GeneDetailModal
- **关闭方式**：点击遮罩或关闭按钮

## 实现计划

1. 创建 `src/components/OntologyModal.tsx` 组件
   - 复用 OntologyPage 的 CustomNode、节点样式、颜色映射
   - 包含搜索框、类型过滤、图谱展示、节点详情 Drawer
   - 支持通过 props 控制显隐

2. 修改 `src/pages/ChatPage.tsx`
   - 添加 OntologyModal 状态管理
   - 添加知识本体意图识别（检测"知识本体"、"ontology"等关键词）
   - 意图触发时弹出 Modal

3. 保持 `/ontology` 路由可用（OntologyPage 保留）

## 组件接口

```typescript
interface OntologyModalProps {
  open: boolean
  onClose: () => void
}
```

## 视觉风格

与 GeneDetailModal 保持一致：
- 全屏遮罩覆盖
- 顶部标题栏 + 关闭按钮
- 内部复用 OntologyPage 所有样式
