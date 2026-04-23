import os
import sys
sys.path.insert(0, r"d:\teamily ai\teamily-ai\backend")

from dotenv import load_dotenv
load_dotenv()

print("=== Environment Variables ===")
print(f"DEEPSEEK_API_KEY: {os.getenv('DEEPSEEK_API_KEY', 'NOT SET')[:10]}...")

from app.core.config import settings
print(f"\nSettings DEFAULT_MODEL: {settings.DEFAULT_MODEL}")
print(f"Settings SIMPLE_MODEL: {settings.SIMPLE_MODEL}")

# Import llm_provider AFTER loading env
from app.agents.agent import llm_provider

print(f"\nllm_provider default_model: {llm_provider.default_model}")
print(f"llm_provider models cache: {list(llm_provider.models.keys())}")

import asyncio
from langchain_core.messages import HumanMessage, SystemMessage

async def test():
    messages = [
        SystemMessage(content='You are a helpful assistant.'),
        HumanMessage(content='Hello')
    ]

    print("\n=== Testing LLM Calls ===")

    # Test with deepseek-chat
    print("\nTesting deepseek-chat...")
    try:
        response = await llm_provider.chat(messages, model_name='deepseek-chat')
        print(f'SUCCESS: deepseek-chat - {response.content[:50]}...')
    except Exception as e:
        print(f'FAILED: {str(e)[:100]}')

    print(f"llm_provider models cache after deepseek-chat: {list(llm_provider.models.keys())}")

    # Test with glm-4-flash
    print("\nTesting glm-4-flash...")
    try:
        response = await llm_provider.chat(messages, model_name='glm-4-flash')
        print(f'SUCCESS: glm-4-flash - {response.content[:50]}...')
    except Exception as e:
        print(f'FAILED: {str(e)[:100]}')

    print(f"llm_provider models cache after glm-4-flash: {list(llm_provider.models.keys())}")

asyncio.run(test())
