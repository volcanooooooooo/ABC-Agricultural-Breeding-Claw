import json
import uuid
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from app.models.feedback import Feedback, FeedbackCreate

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
