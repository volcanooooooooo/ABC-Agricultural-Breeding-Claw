from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from app.config import settings
from app.services.llm_service import llm_service

router = APIRouter()


class ConfigUpdate(BaseModel):
    """配置更新请求"""
    llm_provider: Optional[str] = None
    qwen_api_key: Optional[str] = None
    qwen_model: Optional[str] = None
    llm_temperature: Optional[float] = None
    llm_max_tokens: Optional[int] = None


@router.get("/")
async def get_config():
    """获取所有配置"""
    return {
        "api_host": settings.api_host,
        "api_port": settings.api_port,
        "llm_provider": settings.llm_provider,
        "qwen_model": settings.qwen_model,
        "llm_temperature": settings.llm_temperature,
        "llm_max_tokens": settings.llm_max_tokens,
        "data_dir": settings.data_dir,
        "cors_origins": settings.cors_origins
    }


@router.get("/llm")
async def get_llm_config():
    """获取 LLM 配置"""
    return llm_service.get_config()


@router.patch("/llm")
async def update_llm_config(config: ConfigUpdate):
    """更新 LLM 配置"""
    # 注意：这里只更新运行时配置，不持久化到文件
    if config.llm_provider:
        settings.llm_provider = config.llm_provider
    if config.qwen_model:
        settings.qwen_model = config.qwen_model
    if config.llm_temperature:
        settings.llm_temperature = config.llm_temperature
    if config.llm_max_tokens:
        settings.llm_max_tokens = config.llm_max_tokens

    return {"message": "Config updated", "config": llm_service.get_config()}


@router.get("/cors")
async def get_cors_origins():
    """获取 CORS 配置"""
    return {"origins": settings.cors_origins}
