from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Literal
from pydantic import BaseModel
from datetime import datetime

DEFAULT_TITLE = "新对话"

from app.database import get_db
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message
from app.routers.auth import get_current_user

router = APIRouter()


# Pydantic models
class ConversationCreate(BaseModel):
    title: str = DEFAULT_TITLE


class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    timestamp: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[ConversationResponse])
def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Conversation).filter(Conversation.user_id == current_user.id)\
        .order_by(Conversation.updated_at.desc()).all()


@router.post("/", response_model=ConversationResponse)
def create_conversation(
    conversation: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_conv = Conversation(
        user_id=current_user.id,
        title=conversation.title
    )
    db.add(db_conv)
    db.commit()
    db.refresh(db_conv)
    return db_conv


@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"status": "deleted"}


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
def get_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return db.query(Message).filter(Message.conversation_id == conversation_id)\
        .order_by(Message.timestamp.asc()).all()


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
def create_message(
    conversation_id: int,
    message: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db_msg = Message(
        conversation_id=conversation_id,
        role=message.role,
        content=message.content
    )
    db.add(db_msg)

    # Update conversation timestamp and title
    conv.updated_at = datetime.utcnow()
    if conv.title == DEFAULT_TITLE and message.role == "user":
        conv.title = message.content[:25] + ("..." if len(message.content) > 25 else "")

    db.commit()
    db.refresh(db_msg)
    return db_msg
