from pydantic_settings import BaseSettings
from typing import Optional
import os
from pathlib import Path

# Explicitly load .env file BEFORE any other imports that might use settings
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path, override=True)


class Settings(BaseSettings):
    PROJECT_NAME: str = "TeamMateAI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Database - 支持 SQLite（开发模式）和 PostgreSQL（生产模式）
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./teammateai.db"
    )

    # Redis - 可选，开发模式可以禁用
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    USE_REDIS: bool = os.getenv("USE_REDIS", "false").lower() == "true"

    # LLM Settings
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    DEEPSEEK_API_KEY: Optional[str] = os.getenv("DEEPSEEK_API_KEY")
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    DASHSCOPE_API_KEY: Optional[str] = os.getenv("DASHSCOPE_API_KEY")
    KIMI_API_KEY: Optional[str] = os.getenv("KIMI_API_KEY")
    ZHIPU_API_KEY: Optional[str] = os.getenv("ZHIPU_API_KEY")

    # Default model
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "deepseek-chat")
    DEFAULT_TEMPERATURE: float = 0.7
    DEFAULT_MAX_TOKENS: int = 2000

    # Model routing for task complexity
    SIMPLE_MODEL: str = os.getenv("SIMPLE_MODEL", "deepseek-chat")
    MEDIUM_MODEL: str = os.getenv("MEDIUM_MODEL", "deepseek-chat")
    COMPLEX_MODEL: str = os.getenv("COMPLEX_MODEL", "deepseek-chat")
    
    # Fallback model configuration
    FALLBACK_MODEL: str = os.getenv("FALLBACK_MODEL", "deepseek-chat")

    # Task routing keywords (comma-separated)
    SIMPLE_TASK_KEYWORDS: str = os.getenv("SIMPLE_TASK_KEYWORDS", "hi,hello,你好,翻译,计算,定义")
    COMPLEX_TASK_KEYWORDS: str = os.getenv("COMPLEX_TASK_KEYWORDS", "分析,研究,对比,策略,设计,优化,调试,复杂")

    # Vector Database - 可选，开发模式可以禁用
    QDRANT_HOST: str = os.getenv("QDRANT_HOST", "")
    QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", "6333"))
    QDRANT_COLLECTION: str = "teamilyai_knowledge"
    USE_QDRANT: bool = os.getenv("USE_QDRANT", "false").lower() == "true"

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS
    BACKEND_CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]

    # Dev mode
    DEV_MODE: bool = os.getenv("DEV_MODE", "true").lower() == "true"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
