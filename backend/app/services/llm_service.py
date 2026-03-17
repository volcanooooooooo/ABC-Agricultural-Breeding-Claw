from typing import Optional, List, Dict, Any
import httpx
from app.config import settings

class LLMService:
    """LLM 网关服务"""

    def __init__(self):
        self.provider = settings.llm_provider
        self.api_key = settings.qwen_api_key
        self.api_url = settings.qwen_api_url
        self.model = settings.qwen_model
        self.temperature = settings.llm_temperature
        self.max_tokens = settings.llm_max_tokens

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """调用 LLM 对话"""
        if not self.api_key:
            return {
                "error": "API key not configured",
                "content": "请在环境变量中配置 QWEN_API_KEY"
            }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "input": {"messages": messages},
            "parameters": {
                "temperature": temperature or self.temperature,
                "max_tokens": max_tokens or self.max_tokens,
                "result_format": "message"
            }
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(
                    f"{self.api_url}/services/aigc/text-generation/generation",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                result = response.json()

                if "output" in result and "choices" in result["output"]:
                    return {
                        "content": result["output"]["choices"][0]["message"]["content"],
                        "usage": result.get("usage", {}),
                        "request_id": result.get("request_id")
                    }
                return {"error": "Invalid response format", "raw": result}
            except httpx.HTTPStatusError as e:
                return {"error": f"HTTP error: {e.response.status_code}", "detail": e.response.text}
            except Exception as e:
                return {"error": str(e)}

    async def chat_with_context(
        self,
        user_message: str,
        system_prompt: Optional[str] = None,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """带上下文的对话"""
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        if context:
            messages.append({
                "role": "system",
                "content": f"参考上下文信息：\n{context}"
            })

        messages.append({"role": "user", "content": user_message})

        return await self.chat(messages)

    def get_config(self) -> Dict[str, Any]:
        """获取 LLM 配置"""
        return {
            "provider": self.provider,
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "api_key_configured": bool(self.api_key)
        }


# 全局单例
llm_service = LLMService()
