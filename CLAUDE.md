# CLAUDE.md - ABC: Agricultural Breeding Claw 开发规范

## 对话规范
- **称呼规范**: 每次跟我对话的时候请叫我**主人**

## 项目概述

- **项目名称**: ABC: Agricultural Breeding Claw (农业育种智能助手)
- **类型**: Web 应用（前后端分离）
- **目标**: 通过自然语言交互完成育种研究任务，包括自然语言数据分析、本体可视化与编辑

### 核心功能
- **自然语言数据分析**: 用户可通过自然语言或命令调用 LangChain Agent + Tools 进行差异表达分析
- **双轨分析**: 支持传统统计工具和 LLM 大模型双轨分析对比
- **本体管理**: 基因本体可视化、编辑和检索

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
│   │   ├── agent/           # LangChain Agent (分析代理)
│   │   ├── tools/           # LangChain Tools (分析工具)
│   │   └── utils/           # 工具函数
│   ├── data/
│   │   ├── datasets/        # 数据集文件
│   │   └── datasets.json    # 数据集元数据
│   └── requirements.txt
│
├── src/                     # 前端源码（项目根目录）
│   ├── api/                # API 客户端
│   ├── components/          # 可复用组件
│   ├── pages/              # 页面组件
│   └── App.tsx
│
├── package.json
├── vite.config.ts
└── docs/
    └── superpowers/
        ├── specs/           # 设计文档
        └── plans/            # 实现计划
```

### 关键模块

#### Agent 层 (backend/app/agent/)
- `analysis_agent.py`: LangChain ReAct Agent，负责自然语言理解和工具调用

#### Tools 层 (backend/app/tools/)
- `differential.py`: 差异表达分析工具，使用 t-test 统计方法

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
feat: add differential expression analysis tool

- 支持 t-test 统计分析
- 支持 log2FC 和 p-value 阈值筛选
- 返回显著差异基因列表和火山图数据
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

### 核心 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/chat/` | POST | 自然语言对话/分析 |
| `/api/datasets` | GET | 获取数据集列表 |
| `/api/analysis/compare` | POST | 双轨对比分析 |
| `/api/analysis/stream/{job_id}` | GET | SSE 流式分析结果 |
| `/api/ontology/` | GET | 获取本体图谱 |

## 自然语言分析功能

### 使用方式

**命令格式：**
```
/analyze --control WT --treatment osbzip23
/analyze --control WT --treatment osbzip23 --pvalue 0.01 --log2fc 2
```

**自然语言格式：**
```
分析 WT 和 osbzip23 的差异表达基因
帮我比较处理组和对照组的差异
```

### 分析工具参数
- `dataset_path`: 数据集路径，默认 `datasets/GSE242459_Count_matrix.txt`
- `control_group`: 对照组名称（如 "WT"）
- `treatment_group`: 处理组名称（如 "osbzip23"）
- `pvalue_threshold`: P 值阈值，默认 0.05
- `log2fc_threshold`: log2FC 阈值，默认 1.0

### 数据集 GSE242459
- 位置: `backend/data/datasets/GSE242459_Count_matrix.txt`
- 分组:
  - WT (对照): DS_WT_rep1, DS_WT_rep2, N_WT_rep1, N_WT_rep2, RE_WT_rep1, RE_WT_rep2
  - osbzip23 (处理): DS_osbzip23_rep1, DS_osbzip23_rep2

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
PYTHONPATH=backend uvicorn app.main:app --reload --port 8003

# 前端
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
- 使用 /context7 来实现代码
- 多个 datasets.json 文件存在于不同路径，确保编辑正确的文件：
  - `backend/data/datasets.json` - 主配置
  - `backend/backend/data/datasets.json` - 工作树配置
