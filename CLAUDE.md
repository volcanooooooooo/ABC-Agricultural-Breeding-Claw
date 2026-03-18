# CLAUDE.md - 育种 AI 科学家系统开发规范
## 对话规范
- **称呼规范**: 每次跟我对话的时候请叫我**主人**

## 项目概述

- **项目名称**: 育种 AI 科学家系统
- **类型**: Web 应用（前后端分离）
- **目标**: 通过自然语言交互完成育种研究任务，包括论文研读、自动化数据分析、本体可视化与编辑

## 技术栈

### 后端
- **框架**: FastAPI
- **AI/LLM**: LangChain + 千问 API
- **数据分析**: Pandas, NumPy, SciPy, scikit-learn
- **存储**: JSON 文件（MVP）

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI 组件**: Ant Design
- **可视化**: React Flow, Recharts

## 代码规范

### 通用规范
- 使用 TypeScript（前端）/ Python 类型注解（后端）
- 变量/函数命名使用 camelCase
- 常量使用 UPPER_SNAKE_CASE
- 组件文件使用 PascalCase
- 提交前确保代码格式化

### Python 规范
- 遵循 PEP 8
- 使用 f-string 进行字符串格式化
- 导入顺序：标准库 > 第三方库 > 本地模块
- 异步函数使用 async/await

### TypeScript/React 规范
- 使用函数组件 + Hooks
- 组件 Props 使用接口定义
- 使用 .tsx / .ts 文件扩展名

## 文件结构

```
breeding-scientist/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI 应用入口
│   │   ├── config.py        # 配置管理
│   │   ├── models/          # Pydantic 模型
│   │   ├── routers/         # API 路由
│   │   ├── services/        # 业务逻辑
│   │   └── utils/           # 工具函数
│   ├── data/                # 数据文件
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── api/             # API 客户端
│   │   ├── components/      # 可复用组件
│   │   ├── pages/           # 页面组件
│   │   ├── styles/          # 样式文件
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
└── docs/
    └── superpowers/
        ├── specs/           # 设计文档
        └── plans/           # 实现计划
```

## Git 提交规范

### 提交类型
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构（不影响功能）
- `test`: 测试相关
- `chore`: 构建/工具链更新

### 提交格式
```
<type>: <简短描述>

<详细描述（可选）>
```

### 示例
```
feat: add ontology visualization with React Flow

- 支持树形视图和关系图展示
- 添加节点搜索和过滤功能
- 支持节点详情查看
```

## API 设计规范

### RESTful 原则
- 使用 HTTP 方法语义：GET（查询）, POST（创建）, PUT（更新）, DELETE（删除）
- 资源路径使用复数形式：`/api/ontology/nodes`
- 使用查询参数过滤：`/api/ontology?node_type=genotype`

### 响应格式
```json
{
  "status": "success",
  "data": { },
  "message": "可选的成功/错误信息"
}
```

## 测试规范

### 后端测试
- 使用 pytest
- 单元测试覆盖核心服务逻辑

### 前端测试
- 开发阶段以手动测试为主

## 开发流程

1. **从设计文档开始** - 任何功能开发前先查看 `docs/superpowers/specs/`
2. **按计划执行** - 使用 `docs/superpowers/plans/` 中的实现计划
3. **小步提交** - 每个独立功能完成后立即提交
4. **自测通过** - 提交前运行服务验证功能正常

## 环境配置

### 开发环境
```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# 前端
cd frontend
npm install
npm run dev
```

### 访问地址
- 前端: http://localhost:3003
- 后端 API: http://localhost:8003
- API 文档: http://localhost:8003/docs

## 注意事项

- 不要修改已商定的设计文档，如需变更请先与用户确认
- 保持代码简洁，避免过度工程化
- MVP 阶段优先实现核心功能，非必要功能后续迭代
