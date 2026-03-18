from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class AnalysisDB(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True)
    dataset_id = Column(String, nullable=False)
    dataset_name = Column(String)
    group_control = Column(String)
    group_treatment = Column(String)
    tool_result_json = Column(Text)
    llm_result_json = Column(Text)
    consistency_json = Column(Text)
    created_by = Column(String)
    created_at = Column(DateTime, default=func.now())


class FeedbackHintDB(Base):
    __tablename__ = "feedback_hints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    keyword = Column(String, nullable=False, index=True)
    track = Column(String, nullable=False)
    hint_type = Column(String, nullable=False)
    summary = Column(Text)
    frequency = Column(Integer, default=1)
    last_seen = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
