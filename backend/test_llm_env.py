import os
import sys
sys.path.insert(0, r"d:\teamily ai\teamily-ai\backend")

from dotenv import load_dotenv
load_dotenv()

print("=== Environment Variables ===")
print(f"DEEPSEEK_API_KEY: {os.getenv('DEEPSEEK_API_KEY', 'NOT SET')[:10]}...")
print(f"ZHIPU_API_KEY: {os.getenv('ZHIPU_API_KEY', 'NOT SET')[:10]}...")
print(f"OPENAI_API_KEY: {os.getenv('OPENAI_API_KEY', 'NOT SET')[:10]}...")

from app.core.config import settings
print("\n=== Settings ===")
print(f"DEEPSEEK_API_KEY from settings: {settings.DEEPSEEK_API_KEY[:10] if settings.DEEPSEEK_API_KEY else 'None'}...")

import asyncio
from langchain_core.messages import HumanMessage, SystemMessage
from app.agents.agent import llm_provider

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

    # Test with glm-4-flash
    print("\nTesting glm-4-flash...")
    try:
        response = await llm_provider.chat(messages, model_name='glm-4-flash')
        print(f'SUCCESS: glm-4-flash - {response.content[:50]}...')
    except Exception as e:
        print(f'FAILED: {str(e)[:100]}')

    # Test with gpt-4o
    print("\nTesting gpt-4o...")
    try:
        response = await llm_provider.chat(messages, model_name='gpt-4o')
        print(f'SUCCESS: gpt-4o - {response.content[:50]}...')
    except Exception as e:
        print(f'FAILED: {str(e)[:100]}')

asyncio.run(test())
