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
