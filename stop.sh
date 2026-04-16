#!/bin/bash

# ABC: Agricultural Breeding Claw 停止脚本
# 用法: ./stop.sh

echo "🛑 停止 ABC: Agricultural Breeding Claw"
echo "======================================"

# 停止后端服务
if [ -f "logs/backend.pid" ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        kill $BACKEND_PID
        echo "✅ 后端服务已停止 (PID: $BACKEND_PID)"
    else
        echo "⚠️  后端服务未运行"
    fi
    rm logs/backend.pid
else
    echo "⚠️  未找到后端 PID 文件"
fi

# 停止前端服务
if [ -f "logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        kill $FRONTEND_PID
        echo "✅ 前端服务已停止 (PID: $FRONTEND_PID)"
    else
        echo "⚠️  前端服务未运行"
    fi
    rm logs/frontend.pid
else
    echo "⚠️  未找到前端 PID 文件"
fi

# 清理可能残留的进程
pkill -f "uvicorn app.main:app"
pkill -f "vite"

echo ""
echo "======================================"
echo "✨ 服务已全部停止"
echo "======================================"
