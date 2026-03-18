from pydantic_settings import BaseSettings
from typing import Optional
import os
import json
from pathlib import Path

# 使用项目根目录的绝对路径
BASE_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_FILE = BASE_DIR / "backend" / "data" / "config.json"

class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8003
    llm_provider: str = "qwen"
    qwen_api_key: Optional[str] = None
    qwen_api_url: str = "https://dashscope.aliyuncs.com/api/v1"
    qwen_model: str = "qwen-turbo"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 2000
    data_dir: str = str(BASE_DIR / "backend" / "data")
    ontology_file: str = "ontology.json"
    cors_origins: list = ["http://localhost:3003", "http://localhost:3000"]

    class Config:
        env_file = ".env"

    def save_to_file(self):
        """保存配置到 JSON 文件"""
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        config_data = {
            "llm_provider": self.llm_provider,
            "qwen_api_key": self.qwen_api_key,
            "qwen_model": self.qwen_model,
            "llm_temperature": self.llm_temperature,
            "llm_max_tokens": self.llm_max_tokens,
        }
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)

    def load_from_file(self):
        """从 JSON 文件加载配置"""
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    config_data = json.load(f)
                for key, value in config_data.items():
                    if value is not None and hasattr(self, key):
                        setattr(self, key, value)
            except Exception:
                pass

# 初始化时加载保存的配置
settings = Settings()
settings.load_from_file()
