import json
import re
import uuid
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from app.models.feedback import Feedback, FeedbackCreate
from app.models.db_models import FeedbackHintDB

FEEDBACK_FILE = Path("backend/data/feedback.json")


class FeedbackService:
    def _load_feedbacks(self) -> List[dict]:
        if FEEDBACK_FILE.exists():
            with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("feedbacks", [])
        return []

    def _save_feedbacks(self, feedbacks: List[dict]):
        FEEDBACK_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
            json.dump({"feedbacks": feedbacks}, f, ensure_ascii=False, indent=2)

    def get_all(self) -> List[Feedback]:
        data = self._load_feedbacks()
        return [Feedback(**d) for d in data]

    def get_by_gene(self, gene_id: str) -> List[Feedback]:
        """按基因 ID 获取反馈"""
        data = self._load_feedbacks()
        return [
            Feedback(**d) for d in data
            if d.get('gene_ids') and gene_id in d['gene_ids']
        ]

    def create(self, feedback: FeedbackCreate) -> Feedback:
        now = datetime.utcnow().isoformat() + "Z"

        new_feedback = Feedback(
            id=f"fb_{uuid.uuid4().hex[:8]}",
            analysis_id=feedback.analysis_id,
            track=feedback.track,
            rating=feedback.rating,
            comment=feedback.comment,
            gene_ids=feedback.gene_ids,
            created_by=feedback.created_by,
            created_at=now
        )

        feedbacks = self._load_feedbacks()
        feedbacks.append(new_feedback.model_dump())
        self._save_feedbacks(feedbacks)

        return new_feedback


feedback_service = FeedbackService()


def extract_keywords(text: str) -> list[str]:
    """从文本中提取关键词（基因名、基因ID等）"""
    if not text:
        return []

    keywords = []

    # 匹配基因名模式
    gene_pattern = r'(?:gene[_-]?\w+|AT[1-5CG]\w+|LOC_\w+)'
    genes = re.findall(gene_pattern, text, re.IGNORECASE)
    keywords.extend([g.lower() for g in genes])

    # 匹配常见关键词
    manual_keywords = ['漏检', '误检', '重要', '准确', '遗漏', '错误', '好', '差']
    for kw in manual_keywords:
        if kw in text:
            keywords.append(kw)

    return list(set(keywords))


def process_feedback(feedback, db):
    """处理反馈并更新hint表"""
    hint_type = 'warning' if feedback.rating == 'negative' else 'praise'
    keywords = extract_keywords(feedback.comment or '')

    for keyword in keywords:
        existing = db.query(FeedbackHintDB).filter_by(keyword=keyword, track=feedback.track).first()
        if existing:
            existing.frequency += 1
            existing.last_seen = datetime.utcnow()
            existing.summary = (feedback.comment or '')[:100]
        else:
            hint = FeedbackHintDB(
                keyword=keyword,
                track=feedback.track,
                hint_type=hint_type,
                summary=(feedback.comment or '')[:100],
                frequency=1
            )
            db.add(hint)

    db.commit()
