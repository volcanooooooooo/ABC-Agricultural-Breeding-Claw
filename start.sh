#!/bin/bash

# ABC: Agricultural Breeding Claw 启动脚本
# 用法: ./start.sh

echo "🚀 启动 ABC: Agricultural Breeding Claw"
echo "======================================"

# 检查是否在项目根目录
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 创建日志目录
mkdir -p logs

# 启动后端服务
echo ""
echo "📦 启动后端服务 (端口 8003)..."
cd backend
PYTHONPATH=backend nohup uvicorn app.main:app --reload --port 8003 --host 0.0.0.0 > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ 后端服务已启动 (PID: $BACKEND_PID)"
cd ..

# 等待后端启动
sleep 3

# 启动前端服务
echo ""
echo "🎨 启动前端服务 (端口 3003)..."
nohup npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ 前端服务已启动 (PID: $FRONTEND_PID)"

# 保存 PID 到文件
echo $BACKEND_PID > logs/backend.pid
echo $FRONTEND_PID > logs/frontend.pid

echo ""
echo "======================================"
echo "✨ 服务启动完成！"
echo ""
echo "📍 访问地址:"
echo "   前端: http://localhost:3003"
echo "   后端 API: http://localhost:8003"
echo "   API 文档: http://localhost:8003/docs"
echo ""
echo "📝 日志文件:"
echo "   后端: logs/backend.log"
echo "   前端: logs/frontend.log"
echo ""
echo "🛑 停止服务: ./stop.sh"
echo "======================================"
