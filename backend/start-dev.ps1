# TeamMateAI 本地开发启动脚本
# 使用前请先安装依赖: pip install -r requirements.txt

# 配置环境变量（创建 .env 文件）
$envContent = @"
# Database
DATABASE_URL=sqlite+aiosqlite:///./teammateai.db

# LLM API Keys (请填入您的密钥)
OPENAI_API_KEY=your-openai-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key

# Default Model
DEFAULT_MODEL=deepseek-chat
"@

# 检查 .env 是否存在
$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "创建 .env 配置文件..."
    $envContent | Out-File -FilePath $envFile -Encoding UTF8
    Write-Host ".env 文件已创建，请编辑并填入您的 API 密钥"
} else {
    Write-Host ".env 文件已存在"
}

# 启动后端
Write-Host "`n启动后端服务..."
Write-Host "后端地址: http://localhost:8000"
Write-Host "API 文档: http://localhost:8000/docs"
Write-Host "`n按 Ctrl+C 停止服务`n"

uvicorn app.main:app --reload --port 8000
