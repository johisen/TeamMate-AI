from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import uuid
import os
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db
from app.models.models import User
from app.schemas.schemas import (
    LLMProviderCreate, LLMProviderUpdate, LLMProviderResponse,
    LLMModelCreate, LLMModelUpdate, LLMModelResponse
)

router = APIRouter(prefix="/llm", tags=["llm"])


class LLMConfig:
    """LLM Configuration Manager"""

    PROVIDERS = {
        "openai": {
            "name": "OpenAI",
            "default_model": "gpt-4o",
            "api_key_env": "OPENAI_API_KEY",
            "supports_functions": True,
        },
        "anthropic": {
            "name": "Anthropic Claude",
            "default_model": "claude-sonnet-4-20250514",
            "api_key_env": "ANTHROPIC_API_KEY",
            "supports_functions": True,
        },
        "deepseek": {
            "name": "DeepSeek",
            "default_model": "deepseek-chat",
            "api_key_env": "DEEPSEEK_API_KEY",
            "supports_functions": True,
        },
        "qwen": {
            "name": "Qwen (阿里云)",
            "default_model": "qwen-plus",
            "api_key_env": "DASHSCOPE_API_KEY",
            "supports_functions": True,
        },
        "kimi": {
            "name": "Kimi (月之暗面)",
            "default_model": "moonshot-v1-8k",
            "api_key_env": "KIMI_API_KEY",
            "supports_functions": True,
        },
        "glm": {
            "name": "GLM (智谱AI)",
            "default_model": "glm-4.7-flash",
            "api_key_env": "ZHIPU_API_KEY",
            "supports_functions": True,
        },
        "ollama": {
            "name": "Ollama (本地)",
            "default_model": "llama2",
            "base_url": "http://localhost:11434",
            "supports_functions": False,
        },
    }

    @classmethod
    def get_provider(cls, provider_name: str) -> Optional[dict]:
        return cls.PROVIDERS.get(provider_name)

    @classmethod
    def list_providers(cls) -> List[dict]:
        return [
            {
                "id": name,
                **info,
                "configured": bool(os.getenv(info.get("api_key_env", ""))),
            }
            for name, info in cls.PROVIDERS.items()
        ]

    @classmethod
    def get_available_models(cls, provider_name: str) -> List[str]:
        models = {
            "openai": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
            "anthropic": ["claude-sonnet-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
            "deepseek": ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
            "qwen": ["qwen-max", "qwen-plus", "qwen-turbo", "qwen-max-long", "qwen-coder-turbo"],
            "kimi": ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
            "glm": ["glm-4-0520", "glm-4-0417", "glm-4-plus", "glm-4-flash", "glm-4.7-flash", "glm-3-turbo"],
            "ollama": ["llama2", "mistral", "codellama"],
        }
        return models.get(provider_name, [])


@router.get("/providers")
async def list_providers():
    """List all available LLM providers"""
    return {
        "providers": LLMConfig.list_providers()
    }


@router.get("/providers/{provider_name}")
async def get_provider(provider_name: str):
    """Get provider details"""
    provider = LLMConfig.get_provider(provider_name)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    return {
        "id": provider_name,
        **provider,
        "configured": bool(os.getenv(provider.get("api_key_env", ""))),
        "available_models": LLMConfig.get_available_models(provider_name),
    }


@router.get("/models")
async def list_models(provider: Optional[str] = None):
    """List available models"""
    if provider:
        return {
            "provider": provider,
            "models": LLMConfig.get_available_models(provider)
        }

    all_models = {}
    for p in LLMConfig.PROVIDERS.keys():
        all_models[p] = LLMConfig.get_available_models(p)

    return {"models": all_models}


@router.get("/models/{provider}")
async def get_provider_models(provider: str):
    """Get models for a specific provider"""
    if provider not in LLMConfig.PROVIDERS:
        raise HTTPException(status_code=404, detail="Provider not found")

    return {
        "provider": provider,
        "provider_name": LLMConfig.PROVIDERS[provider]["name"],
        "models": LLMConfig.get_available_models(provider),
    }


@router.post("/test-connection")
async def test_connection(
    provider: str,
    model: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None
):
    """Test LLM connection"""
    if provider not in LLMConfig.PROVIDERS:
        raise HTTPException(status_code=404, detail="Provider not found")

    provider_config = LLMConfig.PROVIDERS[provider]

    if provider == "ollama":
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{base_url or 'http://localhost:11434'}/api/tags")
                if response.status_code == 200:
                    return {
                        "success": True,
                        "message": "Ollama 连接成功",
                        "available_models": response.json().get("models", [])
                    }
                else:
                    return {
                        "success": False,
                        "message": f"连接失败: {response.status_code}"
                    }
        except Exception as e:
            return {
                "success": False,
                "message": f"连接失败: {str(e)}"
            }
    else:
        key = api_key or os.getenv(provider_config.get("api_key_env", ""))
        if not key:
            return {
                "success": False,
                "message": f"未配置 API Key，请设置 {provider_config.get('api_key_env', '')} 环境变量"
            }

        return {
            "success": True,
            "message": f"{provider_config['name']} API Key 验证通过",
            "model": model
        }


@router.get("/keys")
async def get_api_keys():
    """获取所有API密钥（已配置的返回***掩码）"""
    keys = {}
    try:
        print("DEBUG: LLMConfig.PROVIDERS keys:", list(LLMConfig.PROVIDERS.keys()))
        for name, info in LLMConfig.PROVIDERS.items():
            env_key = info.get("api_key_env", "")
            print(f"DEBUG: Processing {name}, env_key: {env_key}")
            if env_key:
                value = getattr(settings, env_key, "")
                print(f"DEBUG: {env_key} value: {value}")
                print(f"DEBUG: value.startswith('your-'): {value.startswith('your-')}")
                if value and isinstance(value, str) and not value.startswith("your-"):
                    keys[name] = f"{value[:8]}************{value[-4:]}" if len(value) > 12 else "***"
                else:
                    keys[name] = ""
            else:
                keys[name] = None
        print("DEBUG: Final keys:", keys)
        return {"keys": keys}
    except Exception as e:
        import traceback
        error_msg = f"Error in get_api_keys: {str(e)}, traceback: {traceback.format_exc()}"
        print(error_msg)
        return {"keys": {}, "error": error_msg}



class APIKeysRequest(BaseModel):
    openai: Optional[str] = None
    anthropic: Optional[str] = None
    deepseek: Optional[str] = None
    qwen: Optional[str] = None
    kimi: Optional[str] = None
    glm: Optional[str] = None

@router.post("/keys")
async def save_api_keys(
    request: APIKeysRequest
):
    """保存API密钥（实际写入.env文件）"""
    from pathlib import Path

    env_path = Path(__file__).parent.parent.parent / ".env"

    # 读取现有.env内容
    env_content = {}
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_content[key] = value

    # 更新API密钥
    key_mapping = {
        "openai": ("OPENAI_API_KEY", request.openai),
        "anthropic": ("ANTHROPIC_API_KEY", request.anthropic),
        "deepseek": ("DEEPSEEK_API_KEY", request.deepseek),
        "qwen": ("DASHSCOPE_API_KEY", request.qwen),
        "kimi": ("KIMI_API_KEY", request.kimi),
        "glm": ("ZHIPU_API_KEY", request.glm),
    }

    for key_name, (env_var, value) in key_mapping.items():
        if value is not None and value != "":
            # 验证是否为有效的API Key格式
            if value.startswith("***"):
                # 掩码形式不更新
                continue
            env_content[env_var] = value

    # 写回.env文件
    with open(env_path, 'w') as f:
        f.write("# Environment variables\n")
        for key, value in env_content.items():
            f.write(f"{key}={value}\n")

    return {
        "success": True,
        "message": "API密钥已保存，需要重启后端服务才能生效"
    }


class DefaultModelRequest(BaseModel):
    model: str

@router.get("/default-model")
async def get_default_model():
    """获取当前默认模型"""
    return {
        "default_model": settings.DEFAULT_MODEL
    }

@router.post("/default-model")
async def set_default_model(
    request: DefaultModelRequest
):
    """设置默认模型"""
    from pathlib import Path

    env_path = Path(__file__).parent.parent.parent / ".env"

    # 读取现有.env内容
    env_content = {}
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_content[key] = value

    # 更新默认模型
    env_content["DEFAULT_MODEL"] = request.model

    # 写回.env文件
    with open(env_path, 'w') as f:
        f.write("# Environment variables\n")
        for key, value in env_content.items():
            f.write(f"{key}={value}\n")

    return {
        "success": True,
        "message": "默认模型已设置，需要重启后端服务才能生效",
        "default_model": request.model
    }
