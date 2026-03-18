from fastapi import APIRouter
from typing import List

from app.models.feedback import Feedback, FeedbackCreate
from app.services.feedback_service import feedback_service

router = APIRouter(prefix="/api/feedbacks", tags=["feedbacks"])


@router.get("", response_model=List[Feedback])
async def get_feedbacks():
    """获取反馈列表"""
    return feedback_service.get_all()


@router.post("", response_model=Feedback)
async def create_feedback(feedback: FeedbackCreate):
    """创建反馈"""
    return feedback_service.create(feedback)
