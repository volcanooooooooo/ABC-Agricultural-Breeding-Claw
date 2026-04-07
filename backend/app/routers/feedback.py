from fastapi import APIRouter
from typing import List, Optional
from app.database import SessionLocal
from app.models.db_models import FeedbackHintDB

from app.models.feedback import Feedback, FeedbackCreate
from app.services.feedback_service import feedback_service

router = APIRouter(tags=["feedbacks"])


@router.get("", response_model=List[Feedback])
async def get_feedbacks(gene_id: Optional[str] = None, analysis_id: Optional[str] = None):
    """获取反馈列表，支持按基因或分析ID筛选"""
    if gene_id:
        return feedback_service.get_by_gene(gene_id)
    if analysis_id:
        return feedback_service.get_by_analysis(analysis_id)
    return feedback_service.get_all()


@router.post("", response_model=Feedback)
async def create_feedback(feedback: FeedbackCreate):
    """创建反馈"""
    return feedback_service.create(feedback)


@router.get("/hints", response_model=List[dict])
async def get_feedback_hints(keyword: str, track: str = None, limit: int = 5):
    """获取相关反馈提示"""
    db = SessionLocal()
    try:
        query = db.query(FeedbackHintDB).filter(
            FeedbackHintDB.keyword.like(f"%{keyword}%")
        )
        if track:
            query = query.filter(FeedbackHintDB.track == track)
        hints = query.order_by(FeedbackHintDB.frequency.desc()).limit(limit).all()

        return [
            {
                "id": h.id,
                "keyword": h.keyword,
                "track": h.track,
                "hint_type": h.hint_type,
                "summary": h.summary,
                "frequency": h.frequency
            }
            for h in hints
        ]
    finally:
        db.close()
