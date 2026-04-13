# Unified Agent Loop Design

**Date:** 2026-04-08  
**Status:** Approved

## 背景与问题

当前 `chat.py` 使用关键词匹配（`should_use_agent`）决定是否走 Agent，导致意图识别不准确。`run_analysis()` 只把最后一条消息传给 Agent，丢失了完整的对话历史。

## 目标

将所有用户消息统一走 Agent Loop，由 LLM 自身决定是否调用工具，去掉关键词路由和 ontology 上下文注入。

## 数据流

```
前端 POST /api/chat/
  messages: [{role, content}, ...]
         |
         v
chat.py: prepend SYSTEM_PROMPT → messages
         |
         v  ←──────────────────────────────┐
    _agent_loop                             │
    client.chat.completions.create(...)     │
         |                                  │
    finish_reason == "tool_calls"?          │
    YES → _dispatch_tool → append tool_result ─┘
    NO  → return content
         |
         v
    ChatResponse(content=...)
```

## 文件职责重划

### `chat.py`（router）— 承担 Agent Loop 核心逻辑

- 删除 `should_use_agent`、`ANALYSIS_COMMANDS`、`ANALYSIS_KEYWORDS`
- 删除 ontology 上下文注入分支
- 新增 `SYSTEM_PROMPT` 常量（从 `analysis_agent.py` 迁移）
- 新增 `_get_client()` 函数（从 `analysis_agent.py` 迁移）
- 新增同步函数 `_agent_loop(messages, max_rounds=10) -> str`（从 `analysis_agent.py` 迁移）
- 导入 `TOOL_HANDLERS`、`TOOLS` 从 `analysis_agent.py`
- `POST /` 接口：将完整 `messages` + system prompt 传入 `_agent_loop`，返回最终文本
- 删除 `from app.agent.analysis_agent import run_analysis` 导入

### `analysis_agent.py`— 只保留工具注册和分发

- 保留 `TOOL_HANDLERS`（工具名 → 可调用函数的字典）
- 保留 `TOOLS`（OpenAI function calling 工具描述列表）
- 保留 `_dispatch_tool(name, arguments) -> str`
- 删除 `SYSTEM_PROMPT`、`_get_client()`、`_agent_loop()`、`run_analysis()`
- 删除 `OpenAI` 客户端导入、`asyncio` 导入

### `llm_service.py`— 不修改

保留原有实现，其他路由（`/breeding`）仍使用 `llm_service.chat()`。

## 接口变更

`POST /api/chat/` 请求/响应格式不变：

```json
// 请求
{
  "messages": [{"role": "user", "content": "..."}, ...],
  "system_prompt": null,
  "temperature": null,
  "max_tokens": null
}

// 响应
{
  "content": "...",
  "usage": null,
  "request_id": null
}
```

## 关键实现细节

- `_agent_loop` 在循环开始前，将 `SYSTEM_PROMPT` 作为第一条 `role: system` 消息 prepend 到 messages 副本
- 前端传入的 `messages` 中如有 `role: system` 消息，保留不覆盖（system prompt 仅在没有时才注入）
- `max_rounds=10` 防止死循环
- 工具结果超长时截断逻辑保留在 `_dispatch_tool`

## 不在范围内

- Ontology 上下文注入（后续迭代）
- `/breeding` 接口修改（不动）
- 流式输出（不动）
- 前端改动（不需要）
