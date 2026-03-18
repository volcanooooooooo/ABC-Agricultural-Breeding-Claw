from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

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

from app.routers import chat, ontology, analysis, config, datasets

app.include_router(chat.router, prefix="/api/chat", tags=["对话"])
app.include_router(ontology.router, prefix="/api/ontology", tags=["本体"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["分析"])
app.include_router(config.router, prefix="/api/config", tags=["配置"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["数据集"])

@app.get("/")
async def root():
    return {"message": "育种 AI 科学家系统 API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
