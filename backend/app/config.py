from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    llm_provider: str = "qwen"
    qwen_api_key: Optional[str] = None
    qwen_api_url: str = "https://dashscope.aliyuncs.com/api/v1"
    qwen_model: str = "qwen-turbo"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 2000
    data_dir: str = "backend/data"
    ontology_file: str = "ontology.json"
    cors_origins: list = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"

settings = Settings()
