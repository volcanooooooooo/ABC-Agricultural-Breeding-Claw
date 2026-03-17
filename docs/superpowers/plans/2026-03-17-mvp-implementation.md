# 育种 AI 科学家系统 MVP 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于本体的育种 AI 科学家系统 MVP，支持自然语言对话、本体可视化与编辑、自动化数据分析

**Architecture:** 前后端分离架构 - 后端 FastAPI + LangChain，前端 React + 可视化库。本体存储使用 JSON 文件（MVP），LLM 使用千问在线 API

**Tech Stack:** Python 3.10+, FastAPI, LangChain, React 18, Vite, React Flow, Recharts

---

## Chunk 1: 项目初始化与后端基础

### Task 1: 创建后端项目结构

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/ontology.py`
- Create: `backend/app/models/analysis.py`
- Create: `backend/app/models/chat.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/utils/__init__.py`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p backend/app/models backend/app/routers backend/app/services backend/app/utils backend/data
```

- [ ] **Step 2: 创建 __init__.py 文件**

```bash
touch backend/app/__init__.py backend/app/models/__init__.py backend/app/routers/__init__.py backend/app/services/__init__.py backend/app/utils/__init__.py
```

- [ ] **Step 3: Commit**

```bash
git add backend/
git commit -m "chore: create backend directory structure"
```

---

### Task 2: 后端依赖与配置

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/config.py`
- Modify: `backend/app/__init__.py`

- [ ] **Step 1: 创建 requirements.txt**

```txt
fastapi==0.109.0
uvicorn==0.27.0
pydantic==2.5.3
pydantic-settings==2.1.0
langchain==0.1.4
langchain-community==0.0.17
httpx==0.26.0
python-multipart==0.0.6
pandas==2.2.0
numpy==1.26.3
scipy==1.12.0
python-dotenv==1.0.0
```

- [ ] **Step 2: 创建 config.py**

```python
from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # API 配置
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # LLM 配置
    llm_provider: str = "qwen"  # qwen, openai, etc.
    qwen_api_key: Optional[str] = None
    qwen_api_url: str = "https://dashscope.aliyuncs.com/api/v1"
    qwen_model: str = "qwen-turbo"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 2000

    # 数据目录
    data_dir: str = "backend/data"
    ontology_file: str = "ontology.json"

    # CORS
    cors_origins: list = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 3: 更新 app __init__.py**

```python
from .config import settings

__all__ = ["settings"]
```

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt backend/app/config.py backend/app/__init__.py
git commit -m "feat: add backend dependencies and config"
```

---

### Task 3: 创建 FastAPI 主应用

**Files:**
- Create: `backend/app/main.py`

- [ ] **Step 1: 创建 main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import chat, ontology, analysis, config

app = FastAPI(
    title="育种 AI 科学家系统 API",
    description="基于本体的育种研究辅助系统",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(chat.router, prefix="/api/chat", tags=["对话"])
app.include_router(ontology.router, prefix="/api/ontology", tags=["本体"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["分析"])
app.include_router(config.router, prefix="/api/config", tags=["配置"])

@app.get("/")
async def root():
    return {"message": "育种 AI 科学家系统 API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
```

- [ ] **Step 2: 创建基础路由占位文件**

```python
# backend/app/routers/chat.py
from fastapi import APIRouter

router = APIRouter()

@router.post("/")
async def chat():
    return {"message": "chat endpoint"}
```

```python
# backend/app/routers/ontology.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def ontology():
    return {"message": "ontology endpoint"}
```

```python
# backend/app/routers/analysis.py
from fastapi import APIRouter

router = APIRouter()

@router.post("/run")
async def run_analysis():
    return {"message": "analysis endpoint"}
```

```python
# backend/app/routers/config.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/llm")
async def get_llm_config():
    return {"message": "config endpoint"}
```

- [ ] **Step 3: 测试应用启动**

```bash
cd backend
pip install -r requirements.txt
python -c "from app.main import app; print('App loaded successfully')"
```

Expected: App loaded successfully

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py backend/app/routers/
git commit -m "feat: create FastAPI main application with routes"
```

---

## Chunk 2: 本体服务与 API

### Task 4: 本体数据模型

**Files:**
- Modify: `backend/app/models/ontology.py`

- [ ] **Step 1: 创建本体 Pydantic 模型**

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class OntologyType(str, Enum):
    GENOTYPE = "genotype"
    TRAIT = "trait"
    METABOLOME = "metabolome"
    ENVIRONMENT = "environment"
    METHOD = "method"

class OntologyNode(BaseModel):
    id: str = Field(..., description="节点唯一标识")
    type: OntologyType = Field(..., description="节点类型")
    name: str = Field(..., description="节点名称")
    properties: Dict[str, Any] = Field(default_factory=dict, description="节点属性")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

class OntologyEdge(BaseModel):
    source: str = Field(..., description="源节点 ID")
    target: str = Field(..., description="目标节点 ID")
    relation: str = Field(..., description="关系类型")

class OntologyGraph(BaseModel):
    nodes: List[OntologyNode] = Field(default_factory=list)
    edges: List[OntologyEdge] = Field(default_factory=list)

class OntologyCreate(BaseModel):
    type: OntologyType
    name: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class OntologyUpdate(BaseModel):
    name: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None

class OntologyListResponse(BaseModel):
    total: int
    items: List[OntologyNode]
```

- [ ] **Step 2: 运行测试验证模型**

```bash
cd backend
python -c "
from app.models.ontology import OntologyNode, OntologyType, OntologyGraph
node = OntologyNode(id='test', type=OntologyType.GENOTYPE, name='IR8')
print(f'Node: {node.dict()}')
print('Models work correctly')
"
```

Expected: Node created successfully

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/ontology.py
git commit -m "feat: add ontology data models"
```

---

### Task 5: 本体服务层

**Files:**
- Create: `backend/app/services/ontology_service.py`

- [ ] **Step 1: 创建本体服务**

```python
import json
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.models.ontology import (
    OntologyNode, OntologyEdge, OntologyGraph,
    OntologyCreate, OntologyUpdate, OntologyType
)
from app.config import settings

class OntologyService:
    def __init__(self):
        self.file_path = os.path.join(settings.data_dir, settings.ontology_file)
        self._ensure_file()

    def _ensure_file(self):
        if not os.path.exists(self.file_path):
            os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
            self._save_default()

    def _save_default(self):
        default_data = {
            "nodes": [
                {"id": "g1", "type": "genotype", "name": "IR8", "properties": {"description": "水稻品种IR8", "source": "IRRI"}}],
                {"id": "g2", "type": "genotype", "name": "IR64", "properties": {"description": "水稻品种IR64", "source": "IRRI"}},
                {"id": "t1", "type": "trait", "name": "株高", "properties": {"description": "植株高度", "unit": "cm"}},
                {"id": "t2", "type": "trait", "name": "穗长", "properties": {"description": "穗子长度", "unit": "cm"}},
                {"id": "t3", "type": "trait", "name": "产量", "properties": {"description": "单产", "unit": "kg/ha"}},
                {"id": "e1", "type": "environment", "name": "热带", "properties": {"description": "热带气候条件", "temperature": "25-35C"}},
                {"id": "e2", "type": "environment", "name": "亚热带", "properties": {"description": "亚热带气候条件", "temperature": "20-30C"}},
                {"id": "m1", "type": "method", "name": "杂交", "properties": {"description": "传统杂交方法"}},
                {"id": "m2", "type": "method", "name": "基因组选择", "properties": {"description": "基于基因组的选育方法"}}
            ],
            "edges": [
                {"source": "g1", "target": "t1", "relation": "has_trait"},
                {"source": "g1", "target": "t2", "relation": "has_trait"},
                {"source": "g1", "target": "t3", "relation": "has_trait"},
                {"source": "g2", "target": "t1", "relation": "has_trait"},
                {"source": "g2", "target": "t3", "relation": "has_trait"},
                {"source": "g1", "target": "e1", "relation": "grown_in"},
                {"source": "g2", "target": "e2", "relation": "grown_in"},
                {"source": "g1", "target": "m1", "relation": "uses_method"},
                {"source": "g2", "target": "m2", "relation": "uses_method"}
            ]
        }
        with open(self.file_path, 'w', encoding='utf-8') as f:
            json.dump(default_data, f, ensure_ascii=False, indent=2)

    def _load(self) -> Dict[str, Any]:
        with open(self.file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save(self, data: Dict[str, Any]):
        with open(self.file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_graph(self) -> OntologyGraph:
        data = self._load()
        nodes = [OntologyNode(**n) for n in data['nodes']]
        edges = [OntologyEdge(**e) for e in data['edges']]
        return OntologyGraph(nodes=nodes, edges=edges)

    def get_nodes(self, node_type: Optional[OntologyType] = None) -> List[OntologyNode]:
        data = self._load()
        nodes = [OntologyNode(**n) for n in data['nodes']]
        if node_type:
            nodes = [n for n in nodes if n.type == node_type]
        return nodes

    def get_node(self, node_id: str) -> Optional[OntologyNode]:
        data = self._load()
        for n in data['nodes']:
            if n['id'] == node_id:
                return OntologyNode(**n)
        return None

    def create_node(self, node_data: OntologyCreate) -> OntologyNode:
        data = self._load()
        node_id = f"{node_data.type.value}_{len(data['nodes']) + 1}"
        now = datetime.now().isoformat()
        new_node = {
            "id": node_id,
            "type": node_data.type.value,
            "name": node_data.name,
            "properties": node_data.properties,
            "created_at": now,
            "updated_at": now
        }
        data['nodes'].append(new_node)
        self._save(data)
        return OntologyNode(**new_node)

    def update_node(self, node_id: str, node_data: OntologyUpdate) -> Optional[OntologyNode]:
        data = self._load()
        for n in data['nodes']:
            if n['id'] == node_id:
                if node_data.name:
                    n['name'] = node_data.name
                if node_data.properties:
                    n['properties'].update(node_data.properties)
                n['updated_at'] = datetime.now().isoformat()
                self._save(data)
                return OntologyNode(**n)
        return None

    def delete_node(self, node_id: str) -> bool:
        data = self._load()
        original_len = len(data['nodes'])
        data['nodes'] = [n for n in data['nodes'] if n['id'] != node_id]
        data['edges'] = [e for e in data['edges'] if e['source'] != node_id and e['target'] != node_id]
        if len(data['nodes']) < original_len:
            self._save(data)
            return True
        return False

    def add_edge(self, edge: OntologyEdge) -> Optional[OntologyEdge]:
        data = self._load()
        # 验证节点存在
        node_ids = [n['id'] for n in data['nodes']]
        if edge.source not in node_ids or edge.target not in node_ids:
            return None
        new_edge = edge.dict()
        data['edges'].append(new_edge)
        self._save(data)
        return OntologyEdge(**new_edge)

    def delete_edge(self, source: str, target: str) -> bool:
        data = self._load()
        original_len = len(data['edges'])
        data['edges'] = [e for e in data['edges'] if not (e['source'] == source and e['target'] == target)]
        if len(data['edges']) < original_len:
            self._save(data)
            return True
        return False

ontology_service = OntologyService()
```

- [ ] **Step 2: 测试本体服务**

```bash
cd backend
python -c "
from app.services.ontology_service import ontology_service
graph = ontology_service.get_graph()
print(f'Nodes: {len(graph.nodes)}, Edges: {len(graph.edges)}')
"
```

Expected: Nodes: 9, Edges: 9

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/ontology_service.py
git commit -m "feat: add ontology service with CRUD operations"
```

---

### Task 6: 本体 API 路由

**Files:**
- Modify: `backend/app/routers/ontology.py`

- [ ] **Step 1: 更新 ontology 路由**

```python
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from app.models.ontology import (
    OntologyNode, OntologyEdge, OntologyGraph,
    OntologyCreate, OntologyUpdate, OntologyListResponse, OntologyType
)
from app.services.ontology_service import ontology_service

router = APIRouter()

@router.get("", response_model=OntologyListResponse)
async def list_ontology(
    node_type: Optional[OntologyType] = Query(None, description="过滤节点类型")
):
    nodes = ontology_service.get_nodes(node_type)
    return OntologyListResponse(total=len(nodes), items=nodes)

@router.get("/graph", response_model=OntologyGraph)
async def get_ontology_graph():
    return ontology_service.get_graph()

@router.get("/{node_id}", response_model=OntologyNode)
async def get_node(node_id: str):
    node = ontology_service.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@router.post("/nodes", response_model=OntologyNode)
async def create_node(node_data: OntologyCreate):
    return ontology_service.create_node(node_data)

@router.put("/nodes/{node_id}", response_model=OntologyNode)
async def update_node(node_id: str, node_data: OntologyUpdate):
    node = ontology_service.update_node(node_id, node_data)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@router.delete("/nodes/{node_id}")
async def delete_node(node_id: str):
    if not ontology_service.delete_node(node_id):
        raise HTTPException(status_code=404, detail="Node not found")
    return {"message": "Node deleted"}

@router.post("/edges", response_model=OntologyEdge)
async def create_edge(edge: OntologyEdge):
    result = ontology_service.add_edge(edge)
    if not result:
        raise HTTPException(status_code=400, detail="Invalid edge - nodes may not exist")
    return result

@router.delete("/edges")
async def delete_edge(source: str = Query(...), target: str = Query(...)):
    if not ontology_service.delete_edge(source, target):
        raise HTTPException(status_code=404, detail="Edge not found")
    return {"message": "Edge deleted"}
```

- [ ] **Step 2: 测试 API**

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 3
curl -s http://localhost:8000/api/ontology/graph | python -m json.tool | head -20
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/ontology.py
git commit -m "feat: add ontology API routes"
```

---

## Chunk 3: LLM 网关与分析服务

### Task 7: LLM 网关服务

**Files:**
- Create: `backend/app/services/llm_gateway.py`

- [ ] **Step 1: 创建 LLM 网关服务**

```python
import httpx
import json
from typing import Optional, Dict, Any, List
from app.config import settings

class LLMGateway:
    def __init__(self):
        self.provider = settings.llm_provider
        self.api_key = settings.qwen_api_key
        self.api_url = settings.qwen_api_url
        self.model = settings.qwen_model
        self.temperature = settings.llm_temperature
        self.max_tokens = settings.llm_max_tokens

    def update_config(self, api_key: str, model: str, temperature: float = 0.7, max_tokens: int = 2000):
        self.api_key = api_key
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    def get_config(self) -> Dict[str, Any]:
        return {
            "provider": self.provider,
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "has_api_key": bool(self.api_key)
        }

    async def chat(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None) -> str:
        """发送聊天请求"""
        if not self.api_key:
            return "错误：未配置 LLM API Key，请在设置页面配置"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        payload = {
            "model": self.model,
            "input": {"messages": full_messages},
            "parameters": {
                "temperature": self.temperature,
                "max_tokens": self.max_tokens
            }
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.api_url}/services/aigc/text-generation/generation",
                    headers=headers,
                    json=payload,
                    timeout=60.0
                )
                if response.status_code == 200:
                    result = response.json()
                    return result['output']['text']
                else:
                    return f"API 错误: {response.status_code} - {response.text}"
            except Exception as e:
                return f"请求错误: {str(e)}"

    async def analyze_result(self, analysis_type: str, data_summary: str) -> str:
        """分析结果解读"""
        system_prompt = """你是一个专业的育种科学家助手。请用中文分析以下数据结果，给出专业的解读和建议。"""

        user_message = f"""分析类型: {analysis_type}
数据摘要: {data_summary}

请给出分析结果的解读。"""

        messages = [{"role": "user", "content": user_message}]
        return await self.chat(messages, system_prompt)

    async def parse_intent(self, user_input: str) -> Dict[str, Any]:
        """解析用户意图"""
        system_prompt = """你是一个任务解析器。请分析用户的输入，识别用户的意图。

支持的意图类型：
- analysis: 数据分析任务
- ontology_query: 本体查询
- paper_summary: 论文研读
- system: 系统操作

请以 JSON 格式返回：
{"intent": "意图类型", "entities": {"key": "value"}, "confidence": 0.0-1.0}

只返回 JSON，不要其他内容。"""

        messages = [{"role": "user", "content": user_input}]
        result = await self.chat(messages, system_prompt)

        try:
            return json.loads(result)
        except:
            return {"intent": "analysis", "entities": {"raw": user_input}, "confidence": 0.5}

llm_gateway = LLMGateway()
```

- [ ] **Step 2: 测试 LLM 配置获取**

```bash
cd backend
python -c "
from app.services.llm_gateway import llm_gateway
config = llm_gateway.get_config()
print(f'Config: {config}')
"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/llm_gateway.py
git commit -m "feat: add LLM gateway service"
```

---

### Task 8: 分析服务

**Files:**
- Create: `backend/app/services/analysis_service.py`

- [ ] **Step 1: 创建分析服务**

```python
import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, Optional, List
from datetime import datetime
import json
import os

class AnalysisService:
    def __init__(self):
        self.data_dir = "backend/data"

    def load_csv(self, file_path: str) -> pd.DataFrame:
        """加载 CSV 文件"""
        full_path = os.path.join(self.data_dir, file_path) if not os.path.isabs(file_path) else file_path
        return pd.read_csv(full_path)

    def get_data_info(self, file_path: str) -> Dict[str, Any]:
        """获取数据信息"""
        df = self.load_csv(file_path)
        return {
            "columns": list(df.columns),
            "rows": len(df),
            "numeric_columns": list(df.select_dtypes(include=[np.number]).columns),
            "categorical_columns": list(df.select_dtypes(include=['object']).columns),
            "preview": df.head(5).to_dict(orient='records')
        }

    def descriptive_stats(self, file_path: str, columns: Optional[List[str]] = None) -> Dict[str, Any]:
        """描述性统计"""
        df = self.load_csv(file_path)

        if columns:
            df = df[columns]

        numeric_df = df.select_dtypes(include=[np.number])

        result = {}
        for col in numeric_df.columns:
            result[col] = {
                "mean": float(numeric_df[col].mean()),
                "std": float(numeric_df[col].std()),
                "min": float(numeric_df[col].min()),
                "max": float(numeric_df[col].max()),
                "median": float(numeric_df[col].median()),
                "count": int(numeric_df[col].count())
            }

        return result

    def correlation(self, file_path: str, columns: Optional[List[str]] = None) -> Dict[str, Any]:
        """相关性分析"""
        df = self.load_csv(file_path)

        if columns:
            df = df[columns]

        numeric_df = df.select_dtypes(include=[np.number])
        corr_matrix = numeric_df.corr()

        return {
            "correlation_matrix": corr_matrix.to_dict(),
            "strong_correlations": self._find_strong_correlations(corr_matrix)
        }

    def _find_strong_correlations(self, corr_matrix: pd.DataFrame, threshold: float = 0.7) -> List[Dict]:
        """找出强相关关系"""
        strong = []
        for i in range(len(corr_matrix.columns)):
            for j in range(i+1, len(corr_matrix.columns)):
                corr_val = corr_matrix.iloc[i, j]
                if abs(corr_val) >= threshold:
                    strong.append({
                        "var1": corr_matrix.columns[i],
                        "var2": corr_matrix.columns[j],
                        "correlation": float(corr_val)
                    })
        return strong

    def heritability(self, file_path: str, genotype_col: str, trait_col: str) -> Dict[str, Any]:
        """遗传力估计"""
        df = self.load_csv(file_path)

        # 简化版本：使用方差组分估计
        genotypes = df[genotype_col].unique()

        # 计算基因型均值和总体均值
        genotype_means = df.groupby(genotype_col)[trait_col].mean()
        overall_mean = df[trait_col].mean()

        # 计算表型方差
        phenotype_var = df[trait_col].var()

        # 计算基因型方差（简化）
        genotype_var = genotype_means.var()

        # 广义遗传力 H² = VG / VP
        broad_heritability = genotype_var / phenotype_var if phenotype_var > 0 else 0

        return {
            "trait": trait_col,
            "genotype_count": len(genotypes),
            "overall_mean": float(overall_mean),
            "phenotype_variance": float(phenotype_var),
            "genotype_variance": float(genotype_var),
            "broad_heritability": float(broad_heritability),
            "interpretation": "高" if broad_heritability > 0.5 else "中" if broad_heritability > 0.3 else "低"
        }

    def pca(self, file_path: str, columns: Optional[List[str]] = None, n_components: int = 2) -> Dict[str, Any]:
        """主成分分析"""
        from sklearn.preprocessing import StandardScaler
        from sklearn.decomposition import PCA

        df = self.load_csv(file_path)

        if columns:
            df = df[columns]

        numeric_df = df.select_dtypes(include=[np.number])

        # 标准化
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(numeric_df)

        # PCA
        pca = PCA(n_components=min(n_components, len(numeric_df.columns)))
        principal_components = pca.fit_transform(scaled_data)

        return {
            "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
            "cumulative_variance": float(sum(pca.explained_variance_ratio_)),
            "loadings": dict(zip(numeric_df.columns, pca.components_.tolist())),
            "scores": principal_components.tolist()
        }

analysis_service = AnalysisService()
```

- [ ] **Step 2: 创建示例数据**

```python
# backend/data/sample_data.csv
import pandas as pd
import numpy as np

np.random.seed(42)

data = {
    'genotype': [f'G{i}' for i in range(1, 21)] * 5,
    'environment': ['E1'] * 20 + ['E2'] * 20 + ['E3'] * 20 + ['E4'] * 20 + ['E5'] * 20,
    'plant_height': np.random.normal(120, 15, 100),
    'panicle_length': np.random.normal(25, 5, 100),
    'yield_kg_ha': np.random.normal(5000, 1000, 100),
    'protein_content': np.random.normal(10, 2, 100),
    'amylose_content': np.random.normal(20, 5, 100)
}

df = pd.DataFrame(data)
df.to_csv('backend/data/sample_data.csv', index=False)
print("Sample data created")
```

- [ ] **Step 3: 测试分析服务**

```bash
cd backend
python -c "
from app.services.analysis_service import analysis_service
info = analysis_service.get_data_info('sample_data.csv')
print(f'Columns: {info[\"columns\"]}')
print(f'Rows: {info[\"rows\"]}')
stats = analysis_service.descriptive_stats('sample_data.csv')
print(f'Stats keys: {list(stats.keys())[:3]}')
"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/analysis_service.py backend/data/
git commit -m "feat: add analysis service with statistical methods"
```

---

### Task 9: 分析 API 路由

**Files:**
- Modify: `backend/app/routers/analysis.py`

- [ ] **Step 1: 更新 analysis 路由**

```python
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, List
from pydantic import BaseModel
from app.services.analysis_service import analysis_service

router = APIRouter()

class AnalysisRequest(BaseModel):
    analysis_type: str
    file_path: Optional[str] = None
    columns: Optional[List[str]] = None
    params: Optional[dict] = None

@router.get("/files")
async def list_data_files():
    import os
    data_dir = "backend/data"
    files = [f for f in os.listdir(data_dir) if f.endswith(('.csv', '.xlsx'))]
    return {"files": files}

@router.get("/info")
async def get_data_info(file_path: str):
    try:
        return analysis_service.get_data_info(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/run")
async def run_analysis(request: AnalysisRequest):
    try:
        if not request.file_path:
            raise HTTPException(status_code=400, detail="file_path is required")

        result = {}

        if request.analysis_type == "descriptive":
            result = analysis_service.descriptive_stats(request.file_path, request.columns)
        elif request.analysis_type == "correlation":
            result = analysis_service.correlation(request.file_path, request.columns)
        elif request.analysis_type == "heritability":
            params = request.params or {}
            result = analysis_service.heritability(
                request.file_path,
                params.get('genotype_col', 'genotype'),
                params.get('trait_col', 'yield_kg_ha')
            )
        elif request.analysis_type == "pca":
            result = analysis_service.pca(request.file_path, request.columns)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown analysis type: {request.analysis_type}")

        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    import os
    data_dir = "backend/data"
    os.makedirs(data_dir, exist_ok=True)

    file_path = os.path.join(data_dir, file.filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    return {"message": "File uploaded", "file_path": file.filename}
```

- [ ] **Step 2: 添加 sklearn 依赖**

```bash
echo "scikit-learn==1.4.0" >> backend/requirements.txt
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/analysis.py backend/requirements.txt
git commit -m "feat: add analysis API routes"
```

---

### Task 10: 配置 API 与对话服务

**Files:**
- Modify: `backend/app/routers/config.py`
- Modify: `backend/app/routers/chat.py`

- [ ] **Step 1: 更新配置路由**

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.llm_gateway import llm_gateway

router = APIRouter()

class LLMConfig(BaseModel):
    api_key: Optional[str] = None
    model: str = "qwen-turbo"
    temperature: float = 0.7
    max_tokens: int = 2000

@router.get("/llm")
async def get_llm_config():
    return llm_gateway.get_config()

@router.put("/llm")
async def update_llm_config(config: LLMConfig):
    if config.api_key:
        llm_gateway.update_config(
            api_key=config.api_key,
            model=config.model,
            temperature=config.temperature,
            max_tokens=config.max_tokens
        )
    return {"message": "Config updated", "config": llm_gateway.get_config()}

@router.post("/llm/test")
async def test_llm_connection():
    result = await llm_gateway.chat([{"role": "user", "content": "Hello"}])
    return {"result": result}
```

- [ ] **Step 2: 更新对话路由**

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.services.llm_gateway import llm_gateway
from app.services.ontology_service import ontology_service
from app.services.analysis_service import analysis_service

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[Dict[str, Any]] = None

@router.post("/")
async def chat(request: ChatRequest):
    # 获取最后一条用户消息
    user_message = None
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_message = msg.content
            break

    if not user_message:
        raise HTTPException(status_code=400, detail="No user message found")

    # 解析意图
    intent_data = await llm_gateway.parse_intent(user_message)

    # 根据意图处理
    if intent_data.get("intent") == "ontology_query":
        # 查询本体
        graph = ontology_service.get_graph()
        nodes = [n for n in graph.nodes if intent_data.get("entities", {}).get("keyword", "").lower() in n.name.lower()]
        return {
            "intent": "ontology_query",
            "message": f"找到 {len(nodes)} 个相关本体节点",
            "nodes": [n.dict() for n in nodes]
        }

    elif intent_data.get("intent") == "analysis":
        # 简单分析任务
        entities = intent_data.get("entities", {})
        file_path = entities.get("file", "sample_data.csv")

        # 获取数据信息
        data_info = analysis_service.get_data_info(file_path)

        return {
            "intent": "analysis",
            "message": f"数据文件 {file_path} 包含 {data_info['rows']} 行数据",
            "data_info": data_info
        }

    else:
        # 默认使用 LLM 处理
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        response = await llm_gateway.chat(messages)

        return {
            "intent": "chat",
            "message": response
        }
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/config.py backend/app/routers/chat.py
git commit -m "feat: add config and chat API routes"
```

---

## Chunk 4: 前端项目初始化

### Task 11: 创建前端项目

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "breeding-ai-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "@xyflow/react": "^12.0.0",
    "recharts": "^2.12.0",
    "axios": "^1.6.7",
    "antd": "^5.14.0",
    "@ant-design/icons": "^5.2.6"
  },
  "devDependencies": {
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.1.0"
  }
}
```

- [ ] **Step 2: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
```

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>育种 AI 科学家系统</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: 创建 main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 6: 创建 App.tsx**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import { MessageOutlined, ApiOutlined, LineChartOutlined, SettingOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import OntologyPage from './pages/OntologyPage'
import AnalysisPage from './pages/AnalysisPage'
import SettingsPage from './pages/SettingsPage'

const { Header, Content, Sider } = Layout

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    { key: '/', icon: <MessageOutlined />, label: '对话' },
    { key: '/ontology', icon: <ApiOutlined />, label: '本体管理' },
    { key: '/analysis', icon: <LineChartOutlined />, label: '数据分析' },
    { key: '/settings', icon: <SettingOutlined />, label: '设置' },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ color: '#fff', fontSize: 20, padding: '0 24px' }}>
        育种 AI 科学家系统
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content style={{ background: '#fff', padding: 24, margin: 0, minHeight: 280 }}>
            <Routes>
              <Route path="/" element={<ChatPage />} />
              <Route path="/ontology" element={<OntologyPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}

export default function Root() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}
```

- [ ] **Step 7: 创建基础样式**

```css
/* frontend/src/index.css */
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
```

- [ ] **Step 8: 创建页面占位文件**

```tsx
// frontend/src/pages/ChatPage.tsx
export default function ChatPage() {
  return <div>对话页面</div>
}
```

```tsx
// frontend/src/pages/OntologyPage.tsx
export default function OntologyPage() {
  return <div>本体管理页面</div>
}
```

```tsx
// frontend/src/pages/AnalysisPage.tsx
export default function AnalysisPage() {
  return <div>数据分析页面</div>
}
```

```tsx
// frontend/src/pages/SettingsPage.tsx
export default function SettingsPage() {
  return <div>设置页面</div>
}
```

- [ ] **Step 9: 安装依赖并测试**

```bash
cd frontend
npm install
npm run build
```

Expected: Build successful

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "feat: create frontend project with React and Vite"
```

---

## Chunk 5: 前端核心功能

### Task 12: API 客户端

**Files:**
- Create: `frontend/src/api/index.ts`

- [ ] **Step 1: 创建 API 客户端**

```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000
})

// 对话 API
export const chatApi = {
  send: (messages: { role: string; content: string }[], context?: any) =>
    api.post('/chat/', { messages, context })
}

// 本体 API
export const ontologyApi = {
  getGraph: () => api.get('/ontology/graph'),
  getList: (nodeType?: string) => api.get('/ontology', { params: { node_type: nodeType } }),
  getNode: (id: string) => api.get(`/ontology/${id}`),
  createNode: (data: any) => api.post('/ontology/nodes', data),
  updateNode: (id: string, data: any) => api.put(`/ontology/nodes/${id}`, data),
  deleteNode: (id: string) => api.delete(`/ontology/nodes/${id}`),
  createEdge: (source: string, target: string, relation: string) =>
    api.post('/ontology/edges', { source, target, relation }),
  deleteEdge: (source: string, target: string) =>
    api.delete('/ontology/edges', { params: { source, target } })
}

// 分析 API
export const analysisApi = {
  listFiles: () => api.get('/analysis/files'),
  getDataInfo: (filePath: string) => api.get('/analysis/info', { params: { file_path: filePath } }),
  run: (analysisType: string, filePath: string, columns?: string[], params?: any) =>
    api.post('/analysis/run', { analysis_type: analysisType, file_path: filePath, columns, params }),
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/analysis/upload', formData)
  }
}

// 配置 API
export const configApi = {
  getLlmConfig: () => api.get('/config/llm'),
  updateLlmConfig: (config: any) => api.put('/config/llm', config),
  testLlm: () => api.post('/config/llm/test')
}

export default api
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/index.ts
git commit -m "feat: add API client"
```

---

### Task 13: 对话页面

**Files:**
- Modify: `frontend/src/pages/ChatPage.tsx`

- [ ] **Step 1: 创建对话页面**

```tsx
import { useState, useRef, useEffect } from 'react'
import { Input, Button, List, Card, Spin, Empty, Select } from 'antd'
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons'
import { chatApi } from '../api'

const { TextArea } = Input

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '您好！我是育种 AI 科学家助手。请告诉我您想要做什么？比如：\n- 分析水稻的遗传力\n- 查询本体中的基因型信息\n- 查找某个性状的定义' }
  ])
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

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await chatApi.send([...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content
      })))

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.data.message || response.data.result?.message || JSON.stringify(response.data, null, 2)
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `错误: ${error.message}`
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <List
          dataSource={messages}
          renderItem={(item) => (
            <List.Item style={{ border: 'none', justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <Card
                size="small"
                style={{
                  maxWidth: '70%',
                  background: item.role === 'user' ? '#1890ff' : '#f5f5f5',
                  color: item.role === 'user' ? '#fff' : '#000'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  {item.role === 'assistant' ? <RobotOutlined /> : <UserOutlined />}
                  <div style={{ whiteSpace: 'pre-wrap' }}>{item.content}</div>
                </div>
              </Card>
            </List.Item>
          )}
        />
        {loading && <div style={{ textAlign: 'center', padding: 16 }}><Spin tip="AI 思考中..." /></div>}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '16px', borderTop: '1px solid #eee' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的需求，比如：分析水稻品种的遗传力"
            autoSize={{ minRows: 2, maxRows: 6 }}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            style={{ height: 'auto' }}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/ChatPage.tsx
git commit -m "feat: add chat page UI"
```

---

### Task 14: 本体可视化页面

**Files:**
- Modify: `frontend/src/pages/OntologyPage.tsx`

- [ ] **Step 1: 创建本体可视化页面**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { ReactFlow, Node, Edge, Controls, Background, MiniMap, useNodesState, useEdgesState, addEdge, Connection, NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, Select, Button, Input, Modal, Form, message, Tag, Space, Drawer, Descriptions } from 'antd'
import { SearchOutlined, PlusOutlined, ZoomInOutlined, ZoomOutOutlined, ReloadOutlined } from '@ant-design/icons'
import { ontologyApi } from '../api'

const nodeTypeColors: Record<string, string> = {
  genotype: '#52c41a',
  trait: '#1890ff',
  metabolome: '#722ed1',
  environment: '#fa8c16',
  method: '#eb2f96'
}

interface OntologyNode {
  id: string
  type: string
  name: string
  properties: Record<string, any>
}

interface OntologyEdge {
  source: string
  target: string
  relation: string
}

function OntologyNodeComponent({ data }: { data: any }) {
  return (
    <Card
      size="small"
      style={{
        borderColor: nodeTypeColors[data.nodeType] || '#ccc',
        minWidth: 120
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Tag color={nodeTypeColors[data.nodeType]}>{data.nodeType}</Tag>
        <span>{data.label}</span>
      </div>
    </Card>
  )
}

const nodeTypes: NodeTypes = {
  ontology: OntologyNodeComponent
}

export default function OntologyPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()

  const loadGraph = useCallback(async () => {
    try {
      const response = await ontologyApi.getGraph()
      const { nodes: ontologyNodes, edges: ontologyEdges } = response.data

      const flowNodes: Node[] = ontologyNodes
        .filter((n: OntologyNode) => filterType === 'all' || n.type === filterType)
        .filter((n: OntologyNode) => !searchText || n.name.toLowerCase().includes(searchText.toLowerCase()))
        .map((n: OntologyNode, index: number) => ({
          id: n.id,
          type: 'ontology',
          position: {
            x: (index % 4) * 200 + 100,
            y: Math.floor(index / 4) * 150 + 100
          },
          data: { label: n.name, nodeType: n.type }
        }))

      const flowEdges: Edge[] = ontologyEdges
        .filter((e: OntologyEdge) =>
          flowNodes.some((n: Node) => n.id === e.source) &&
          flowNodes.some((n: Node) => n.id === e.target)
        )
        .map((e: OntologyEdge) => ({
          id: `${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          label: e.relation,
          type: 'smoothstep'
        }))

      setNodes(flowNodes)
      setEdges(flowEdges)
    } catch (error) {
      message.error('加载本体数据失败')
    }
  }, [filterType, searchText, setNodes, setEdges])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onNodeClick = async (_: any, node: Node) => {
    try {
      const response = await ontologyApi.getNode(node.id)
      setSelectedNode(response.data)
      setDrawerOpen(true)
    } catch (error) {
      message.error('获取节点详情失败')
    }
  }

  const handleAddNode = async (values: any) => {
    try {
      await ontologyApi.createNode(values)
      message.success('节点创建成功')
      form.resetFields()
      loadGraph()
    } catch (error) {
      message.error('创建失败')
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input
          placeholder="搜索节点"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 200 }}
        />
        <Select
          value={filterType}
          onChange={setFilterType}
          style={{ width: 150 }}
          options={[
            { value: 'all', label: '全部类型' },
            { value: 'genotype', label: '基因型' },
            { value: 'trait', label: '性状' },
            { value: 'metabolome', label: '代谢组' },
            { value: 'environment', label: '环境' },
            { value: 'method', label: '实验方法' }
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={loadGraph}>刷新</Button>
        <Modal
          title="添加节点"
          open={false}
          footer={null}
        >
          <Form form={form} onFinish={handleAddNode}>
            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
              <Select options={[
                { value: 'genotype', label: '基因型' },
                { value: 'trait', label: '性状' },
                { value: 'metabolome', label: '代谢组' },
                { value: 'environment', label: '环境' },
                { value: 'method', label: '实验方法' }
              ]} />
            </Form.Item>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="submit">
              <Button type="primary" htmlType="submit">创建</Button>
            </Form.Item>
          </Form>
        </Modal>
      </div>

      <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background />
        </ReactFlow>
      </div>

      <Drawer
        title="节点详情"
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={400}
      >
        {selectedNode && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="ID">{selectedNode.id}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={nodeTypeColors[selectedNode.type]}>{selectedNode.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="名称">{selectedNode.name}</Descriptions.Item>
            <Descriptions.Item label="属性">
              <pre>{JSON.stringify(selectedNode.properties, null, 2)}</pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/OntologyPage.tsx
git commit -m "feat: add ontology visualization page"
```

---

### Task 15: 数据分析页面

**Files:**
- Modify: `frontend/src/pages/AnalysisPage.tsx`

- [ ] **Step 1: 创建数据分析页面**

```tsx
import { useState, useEffect } from 'react'
import { Card, Select, Button, Table, Upload, message, Tabs, Spin, Row, Col } from 'antd'
import { UploadOutlined, PlayCircleOutlined, FileExcelOutlined } from '@ant-design/icons'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter } from 'recharts'
import { analysisApi } from '../api'

const { Dragger } = Upload

interface DataInfo {
  columns: string[]
  rows: number
  numeric_columns: string[]
  categorical_columns: string[]
  preview: any[]
}

export default function AnalysisPage() {
  const [files, setFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [dataInfo, setDataInfo] = useState<DataInfo | null>(null)
  const [analysisType, setAnalysisType] = useState<string>('descriptive')
  const [columns, setColumns] = useState<string[]>([])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('1')

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      const response = await analysisApi.listFiles()
      setFiles(response.data.files)
      if (response.data.files.length > 0) {
        setSelectedFile(response.data.files[0])
      }
    } catch (error) {
      message.error('加载文件列表失败')
    }
  }

  const loadDataInfo = async (filePath: string) => {
    try {
      const response = await analysisApi.getDataInfo(filePath)
      setDataInfo(response.data)
      setColumns(response.data.numeric_columns || [])
    } catch (error) {
      message.error('加载数据信息失败')
    }
  }

  useEffect(() => {
    if (selectedFile) {
      loadDataInfo(selectedFile)
    }
  }, [selectedFile])

  const handleUpload = async (file: File) => {
    try {
      await analysisApi.upload(file)
      message.success('文件上传成功')
      loadFiles()
    } catch (error) {
      message.error('上传失败')
    }
    return false
  }

  const runAnalysis = async () => {
    if (!selectedFile) {
      message.warning('请选择数据文件')
      return
    }

    setLoading(true)
    try {
      const response = await analysisApi.run(analysisType, selectedFile, columns)
      setResult(response.data.result)
      setActiveTab('2')
    } catch (error: any) {
      message.error(error.response?.data?.detail || '分析失败')
    } finally {
      setLoading(false)
    }
  }

  const renderChart = () => {
    if (!result || !dataInfo) return null

    if (analysisType === 'descriptive') {
      const chartData = Object.entries(result).map(([key, value]: [string, any]) => ({
        name: key,
        mean: value.mean,
        std: value.std
      }))

      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="mean" fill="#1890ff" name="均值" />
            <Bar dataKey="std" fill="#52c41a" name="标准差" />
          </BarChart>
        </ResponsiveContainer>
      )
    }

    if (analysisType === 'correlation') {
      const corrData = result.strong_correlations || []
      return (
        <div>
          <h4>强相关关系</h4>
          <Table
            dataSource={corrData}
            columns={[
              { title: '变量1', dataIndex: 'var1' },
              { title: '变量2', dataIndex: 'var2' },
              { title: '相关系数', dataIndex: 'correlation', render: (v: number) => v.toFixed(3) }
            ]}
            rowKey={(r, i) => i || 0}
            size="small"
          />
        </div>
      )
    }

    if (analysisType === 'heritability') {
      return (
        <Card>
          <Row gutter={16}>
            <Col span={8}>
              <Card title="广义遗传力">{result.broad_heritability?.toFixed(3)}</Card>
            </Col>
            <Col span={8}>
              <Card title="解释">{result.interpretation}</Card>
            </Col>
            <Col span={8}>
              <Card title="基因型数量">{result.genotype_count}</Card>
            </Col>
          </Row>
        </Card>
      )
    }

    return <pre>{JSON.stringify(result, null, 2)}</pre>
  }

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <Card title="数据文件" size="small">
            <Dragger beforeUpload={handleUpload} showUploadList={false}>
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p>点击或拖拽上传文件</p>
            </Dragger>
            <Select
              style={{ width: '100%', marginTop: 16 }}
              value={selectedFile}
              onChange={setSelectedFile}
              options={files.map(f => ({ value: f, label: f }))}
            />
          </Card>
        </Col>
        <Col span={18}>
          <Card title="分析配置" size="small">
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <Select
                value={analysisType}
                onChange={setAnalysisType}
                style={{ width: 200 }}
                options={[
                  { value: 'descriptive', label: '描述性统计' },
                  { value: 'correlation', label: '相关性分析' },
                  { value: 'heritability', label: '遗传力估计' },
                  { value: 'pca', label: '主成分分析' }
                ]}
              />
              <Select
                mode="multiple"
                value={columns}
                onChange={setColumns}
                style={{ width: 300 }}
                placeholder="选择分析列"
                options={(dataInfo?.numeric_columns || []).map(c => ({ value: c, label: c }))}
              />
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={runAnalysis}
                loading={loading}
              >
                执行分析
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="结果" style={{ marginTop: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: '1',
              label: '数据预览',
              children: dataInfo && (
                <Table
                  dataSource={dataInfo.preview}
                  columns={dataInfo.columns.map(c => ({ title: c, dataIndex: c }))}
                  rowKey={(_, i) => i || 0}
                  size="small"
                  pagination={false}
                  scroll={{ x: true }}
                />
              )
            },
            {
              key: '2',
              label: '分析结果',
              children: loading ? <Spin /> : renderChart()
            }
          ]}
        />
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/AnalysisPage.tsx
git commit -m "feat: add analysis page with charts"
```

---

### Task 16: 设置页面

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: 创建设置页面**

```tsx
import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, InputNumber, Select, message, Switch, Divider } from 'antd'
import { SaveOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { configApi } from '../api'

interface LLMConfig {
  provider: string
  model: string
  temperature: number
  max_tokens: number
  has_api_key: boolean
}

export default function SettingsPage() {
  const [form] = Form.useForm()
  const [config, setConfig] = useState<LLMConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await configApi.getLlmConfig()
      setConfig(response.data)
      form.setFieldsValue({
        apiKey: '',
        model: response.data.model,
        temperature: response.data.temperature,
        maxTokens: response.data.max_tokens
      })
    } catch (error) {
      message.error('加载配置失败')
    }
  }

  const handleSave = async (values: any) => {
    setLoading(true)
    try {
      await configApi.updateLlmConfig({
        api_key: values.apiKey || undefined,
        model: values.model,
        temperature: values.temperature,
        max_tokens: values.maxTokens
      })
      message.success('配置保存成功')
      loadConfig()
    } catch (error) {
      message.error('保存失败')
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const response = await configApi.testLlm()
      message.success('连接成功')
      console.log('Test result:', response.data)
    } catch (error: any) {
      message.error(error.response?.data?.detail || '连接失败')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <Card title="LLM 模型配置">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="apiKey"
            label="API Key"
            extra={config?.has_api_key ? "已配置" : "尚未配置"}
          >
            <Input.Password placeholder="输入 API Key" />
          </Form.Item>

          <Form.Item
            name="model"
            label="模型"
            rules={[{ required: true, message: '请选择模型' }]}
          >
            <Select
              options={[
                { value: 'qwen-turbo', label: 'Qwen Turbo (快速)' },
                { value: 'qwen-plus', label: 'Qwen Plus (标准)' },
                { value: 'qwen-max', label: 'Qwen Max (最强)' }
              ]}
            />
          </Form.Item>

          <Form.Item
            name="temperature"
            label="Temperature (0-1)"
            extra="控制输出的随机性，越高越随机"
          >
            <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="maxTokens"
            label="最大 Token 数"
            extra="单次响应的最大 token 数量"
          >
            <InputNumber min={100} max={4000} step={100} style={{ width: '100%' }} />
          </Form.Item>

          <Divider />

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={loading}
              >
                保存配置
              </Button>
              <Button
                icon={<CheckCircleOutlined />}
                onClick={handleTest}
                loading={testing}
              >
                测试连接
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "feat: add settings page for LLM configuration"
```

---

## Chunk 6: 集成测试

### Task 17: 前后端集成测试

**Files:**
- Modify: `backend/.env` (示例)
- Test: 全流程测试

- [ ] **Step 1: 创建环境变量示例文件**

```bash
# backend/.env.example
# 复制此文件为 .env 并填入您的配置

# 千问 API Key
QWEN_API_KEY=your_api_key_here

# 其他配置
API_HOST=0.0.0.0
API_PORT=8000
```

- [ ] **Step 2: 启动后端服务测试**

```bash
cd backend
# 安装依赖
pip install -r requirements.txt

# 启动服务（后台运行）
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 3

# 测试健康检查
curl -s http://localhost:8000/health

# 测试本体 API
curl -s http://localhost:8000/api/ontology/graph | head -50
```

Expected: 返回本体图数据

- [ ] **Step 3: 启动前端服务测试**

```bash
cd frontend
npm run dev &
sleep 3

# 验证前端启动
curl -s http://localhost:5173 | head -20
```

- [ ] **Step 4: 测试完整流程**

```bash
# 测试对话 API
curl -s -X POST http://localhost:8000/api/chat/ \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"查询本体中的基因型"}]}'

# 测试分析 API
curl -s "http://localhost:8000/api/analysis/info?file_path=sample_data.csv"
```

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example
git commit -m "test: add integration tests and env example"
```

---

## 实现计划完成

**下一步：**
1. 使用 `superpowers:subagent-driven-development` 执行计划
2. 或使用 `superpowers:executing-plans` 在当前会话执行

请确认是否开始执行？
