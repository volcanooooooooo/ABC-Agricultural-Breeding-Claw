from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from typing_extensions import Literal

# 安全配置
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_FILE_TYPES = [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]


class Dataset(BaseModel):
    id: str
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    data_type: str = "expression_matrix"
    file_path: str
    file_size: Optional[int] = Field(None, ge=0, le=MAX_FILE_SIZE)
    gene_count: int = Field(..., gt=0)
    sample_count: int = Field(..., ge=4)  # 至少4个样本
    groups: Dict[str, List[str]]
    owner: Optional[str] = None
    created_at: str
    updated_at: str


class DatasetUploadRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    group_control: str = Field(..., min_length=1)
    group_treatment: str = Field(..., min_length=1)
    control_samples: List[str] = Field(..., min_length=2)
    treatment_samples: List[str] = Field(..., min_length=2)
