from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List
from app.config import settings
from app.services.llm_service import llm_service

router = APIRouter()


class ConfigUpdate(BaseModel):
    """配置更新请求"""
    llm_provider: Optional[str] = None
    llm_api_key: Optional[str] = None  # 前端使用此字段名
    qwen_api_key: Optional[str] = None  # 兼容旧字段名
    qwen_model: Optional[str] = None
    llm_model: Optional[str] = None  # 前端使用此字段名
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
    # 确定使用的模型名称
    model = config.qwen_model or config.llm_model
    # 确定使用的 API key
    api_key = config.qwen_api_key or config.llm_api_key

    # 更新运行时配置
    if config.llm_provider:
        settings.llm_provider = config.llm_provider
    if model:
        settings.qwen_model = model
    if config.llm_temperature:
        settings.llm_temperature = config.llm_temperature
    if config.llm_max_tokens:
        settings.llm_max_tokens = config.llm_max_tokens
    # 保存 API key 到 settings（用于持久化）
    if api_key:
        settings.qwen_api_key = api_key

    # 更新 llm_service 的运行时配置
    llm_service.update_config(
        api_key=api_key,
        model=model,
        temperature=config.llm_temperature,
        max_tokens=config.llm_max_tokens
    )

    # 持久化保存到文件
    settings.save_to_file()

    return {"message": "Config updated", "config": llm_service.get_config()}


@router.get("/cors")
async def get_cors_origins():
    """获取 CORS 配置"""
    return {"origins": settings.cors_origins}


@router.post("/llm/test")
async def test_llm_connection():
    """测试 LLM 连接"""
    if not llm_service.api_key:
        return {"success": False, "message": "API key 未配置"}

    try:
        result = await llm_service.chat(
            messages=[{"role": "user", "content": "你好"}],
            max_tokens=50
        )

        if "error" in result:
            return {"success": False, "message": result.get("error", "未知错误")}

        return {"success": True, "message": "连接成功", "response": result.get("content", "")[:100]}
    except Exception as e:
        return {"success": False, "message": str(e)}
