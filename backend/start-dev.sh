#!/bin/bash
# TeamMateAI 后端启动脚本 (Linux/Mac)

echo "==============================="
echo "TeamMateAI 后端开发服务器"
echo "==============================="

# 设置环境变量
export DATABASE_URL=sqlite+aiosqlite:///./teammateai.db
export DEFAULT_MODEL=deepseek-chat
export DEV_MODE=true

# 启动服务
echo "启动中..."
echo "后端地址: http://localhost:8000"
echo "API 文档: http://localhost:8000/docs"
echo ""

uvicorn app.main:app --reload --port 8000
