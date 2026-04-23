@echo off
REM TeamMateAI 后端启动脚本 (Windows)

echo ================================
echo TeamMateAI 后端开发服务器
echo ================================

REM 设置环境变量
set DATABASE_URL=sqlite+aiosqlite:///./teammateai.db
set DEFAULT_MODEL=deepseek-chat
set DEV_MODE=true

REM 启动服务
echo 启动中...
echo 后端地址: http://localhost:8000
echo API 文档: http://localhost:8000/docs
echo.
uvicorn app.main:app --reload --port 8000

pause
