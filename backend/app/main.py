import sys
import io

# 修复 Windows 命令行中文乱码
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback
from app.config import settings
from app.database import init_db
from app.routers import auth

app = FastAPI(
    title="ABC: Agricultural Breeding Claw API",
    description="基于 AI 的农业育种智能助手系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


from app.routers import chat, ontology, analysis, config, datasets, feedback, conversations, download

app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(chat.router, prefix="/api/chat", tags=["聊天"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["对话管理"])
# 本体路由已禁用
# app.include_router(ontology.router, prefix="/api/ontology", tags=["本体"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["分析"])
app.include_router(config.router, prefix="/api/config", tags=["配置"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["数据集"])
app.include_router(feedback.router, prefix="/api/feedbacks", tags=["反馈"])
app.include_router(download.router, prefix="/api/download", tags=["下载"])

@app.get("/")
async def root():
    return {"message": "ABC:Agricultural Breeding Claw", "version": "1.0.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理器 - 捕获所有未处理的异常"""
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "服务器内部错误，请稍后重试",
            "detail": "An unexpected error occurred. Please try again later."
        }
    )

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
