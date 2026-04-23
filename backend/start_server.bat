@echo off
cd /d d:\teamily ai\teamily-ai\backend
echo Starting server with environment variables from .env file...
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
pause