from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class OntologyType(str, Enum):
    """本体节点类型"""
    # 原有类型（保留兼容）
    GENOTYPE = "genotype"
    TRAIT = "trait"
    METABOLOME = "metabolome"
    ENVIRONMENT = "environment"
    METHOD = "method"
    # ref_doc 数据类型
    DATASET = "Dataset"
    SAMPLE = "Sample"
    GENE = "Gene"
    MEASUREMENT = "Measurement"
    PROCESS_STEP = "ProcessStep"
    TOOL = "Tool"
    RESULT = "Result"
    CONCLUSION = "Conclusion"

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
