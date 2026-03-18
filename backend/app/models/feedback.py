from pydantic import BaseModel
from typing import Optional, List
from typing_extensions import Literal


class FeedbackCreate(BaseModel):
    analysis_id: str
    track: Literal["tool", "llm"]
    rating: Literal["positive", "negative"]
    comment: Optional[str] = None
    gene_ids: Optional[List[str]] = None
    created_by: Optional[str] = None


class Feedback(FeedbackCreate):
    id: str
    created_at: str
