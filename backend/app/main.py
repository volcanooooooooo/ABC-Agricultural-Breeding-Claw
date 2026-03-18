from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.routers import auth

app = FastAPI(
    title="育种 AI 科学家系统 API",
    description="基于本体的育种研究辅助系统",
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


from app.routers import chat, ontology, analysis, config, datasets, feedback, conversations

app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(chat.router, prefix="/api/chat", tags=["聊天"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["对话管理"])
app.include_router(ontology.router, prefix="/api/ontology", tags=["本体"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["分析"])
app.include_router(config.router, prefix="/api/config", tags=["配置"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["数据集"])
app.include_router(feedback.router, prefix="/api/feedbacks", tags=["反馈"])

@app.get("/")
async def root():
    return {"message": "育种 AI 科学家系统 API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
