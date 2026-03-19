# Analysis models
from typing import Optional, List, Dict, Any
from typing_extensions import Literal
from pydantic import BaseModel


class GeneInfo(BaseModel):
    gene_id: str
    expression_change: Literal["up", "down", "none"]
    log2fc: Optional[float] = None
    pvalue: Optional[float] = None
    reason: Optional[str] = None


class ToolResult(BaseModel):
    method: str = "ttest_scipy"
    significant_genes: List[GeneInfo]
    all_genes: List[GeneInfo]
    execution_time: float


class LLMResult(BaseModel):
    model: str
    significant_genes: List[GeneInfo]
    reasoning: str
    execution_time: float


class ConsistencyInfo(BaseModel):
    overlap: List[str]
    tool_only: List[str]
    llm_only: List[str]
    overlap_rate: float


class AnalysisResult(BaseModel):
    id: str
    dataset_id: str
    dataset_name: str
    group_control: str
    group_treatment: str
    tool_result: ToolResult
    llm_result: LLMResult
    consistency: ConsistencyInfo
    created_at: str


class CompareRequest(BaseModel):
    dataset_id: str
    group_control: str
    group_treatment: str
    pvalue_threshold: float = 0.05
    log2fc_threshold: float = 1.0


class CompareResponse(BaseModel):
    job_id: str
    status: str = "started"
