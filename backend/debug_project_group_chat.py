import os
import sys
sys.path.insert(0, r"d:\teamily ai\teamily-ai\backend")

from dotenv import load_dotenv
load_dotenv()

print("=" * 60)
print("项目组聊天模型调用排查测试")
print("=" * 60)

print("\n=== 1. 环境变量检查 ===")
print(f"DEEPSEEK_API_KEY: {os.getenv('DEEPSEEK_API_KEY', 'NOT SET')}")
print(f"ZHIPU_API_KEY: {os.getenv('ZHIPU_API_KEY', 'NOT SET')}")
print(f"OPENAI_API_KEY: {os.getenv('OPENAI_API_KEY', 'NOT SET')}")

from app.core.config import settings
print("\n=== 2. Settings配置检查 ===")
print(f"DEFAULT_MODEL: {settings.DEFAULT_MODEL}")
print(f"SIMPLE_MODEL: {settings.SIMPLE_MODEL}")
print(f"MEDIUM_MODEL: {settings.MEDIUM_MODEL}")
print(f"COMPLEX_MODEL: {settings.COMPLEX_MODEL}")
print(f"DEEPSEEK_API_KEY: {settings.DEEPSEEK_API_KEY[:10] if settings.DEEPSEEK_API_KEY else 'None'}...")

from app.services.task_router import task_router
print("\n=== 3. TaskRouter配置检查 ===")
print(f"simple_model: {task_router.simple_model}")
print(f"medium_model: {task_router.medium_model}")
print(f"complex_model: {task_router.complex_model}")

print("\n=== 4. 路由测试 ===")
test_messages = [
    "你好",
    "你好，请做一个自我介绍",
    "分析一下这个项目的架构",
]

for msg in test_messages:
    routing = task_router.get_routing_info(msg)
    print(f"\n消息: {msg}")
    print(f"  复杂度: {routing['complexity']}")
    print(f"  推荐模型: {routing['recommended_model']}")
    print(f"  原因: {routing['reason']}")

from app.agents.agent import llm_provider
print("\n=== 5. LLMProvider配置检查 ===")
print(f"default_model: {llm_provider.default_model}")
print(f"models cache: {list(llm_provider.models.keys())}")

import asyncio
from langchain_core.messages import HumanMessage, SystemMessage

async def test_llm_calls():
    print("\n=== 6. LLM模型调用测试 ===")

    messages = [
        SystemMessage(content='You are a helpful assistant.'),
        HumanMessage(content='Hello')
    ]

    # Test deepseek-chat
    print("\n测试 deepseek-chat:")
    try:
        response = await llm_provider.chat(messages, model_name='deepseek-chat')
        print(f"  ✓ 成功: {response.content[:50]}...")
    except Exception as e:
        print(f"  ✗ 失败: {str(e)[:100]}")

    # Test task_router推荐的模型
    print("\n测试 task_router 推荐的模型 (使用'你好'):")
    routing = task_router.get_routing_info("你好")
    recommended_model = routing['recommended_model']
    print(f"  推荐的模型: {recommended_model}")
    try:
        response = await llm_provider.chat(messages, model_name=recommended_model)
        print(f"  ✓ 成功: {response.content[:50]}...")
    except Exception as e:
        print(f"  ✗ 失败: {str(e)[:100]}")

    # Test 模拟项目组聊天的supervisor调用
    print("\n=== 7. 模拟项目组聊天调用 ===")

    # 模拟supervisor的调用
    supervisor_system_prompt = """You are main, the supervisor of this project group.
Your role is to coordinate team members and provide final answers.
Team members:
- product-manager
- senior-developer

Guidelines:
- Analyze user messages
- Coordinate team members
- Provide final summaries"""

    supervisor_messages = [
        SystemMessage(content=supervisor_system_prompt),
        HumanMessage(content="你好，请做一个自我介绍")
    ]

    model_name = task_router.route("你好，请做一个自我介绍")
    print(f"Supervisor使用模型: {model_name}")
    try:
        response = await llm_provider.chat(supervisor_messages, model_name=model_name)
        print(f"  ✓ Supervisor成功: {response.content[:100]}...")
    except Exception as e:
        print(f"  ✗ Supervisor失败: {str(e)[:100]}")

    # Test invoke_isolated (模拟sub-agent调用)
    print("\n模拟 Sub-Agent 调用:")
    from app.agents.agent import SubAgent

    sub_agent = SubAgent(
        agent_id="test-agent",
        name="product-manager",
        role="Product Manager",
        system_prompt="You are a product manager.",
        model_config={},
        tools=[],
        project_group_id="test-group"
    )

    try:
        result = await sub_agent.invoke_isolated(
            task_instruction="请做一个自我介绍",
            context_from_blackboard=None,
            parent_agent_id="main"
        )
        if result.get("error"):
            print(f"  ✗ Sub-Agent失败: {result['error'][:100]}")
        else:
            print(f"  ✓ Sub-Agent成功: {result['response'][:100] if result.get('response') else 'None'}...")
            print(f"    使用的模型: {result.get('model_used')}")
    except Exception as e:
        print(f"  ✗ Sub-Agent异常: {str(e)[:100]}")

asyncio.run(test_llm_calls())

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)
