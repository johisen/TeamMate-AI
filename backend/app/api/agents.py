from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any
import json
import uuid
from datetime import datetime

from app.core.database import get_db
from app.models.models import Agent, Message, User, ConversationSession, ConfigVersion
from app.schemas.schemas import (
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    AgentCreateResponse,
    MessageCreate,
    MessageResponse,
    ChatRequest,
    ChatResponse,
    ResetContextRequest,
    ResetContextResponse,
)
from app.agents.agent import agent_manager

router = APIRouter()


# ============ Agent APIs ============
@router.post("/agents", response_model=AgentCreateResponse)
async def create_agent(
    agent_data: AgentCreate,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = "default-user"  # TODO: Get from auth
):
    """Create a new AI agent"""
    try:
        # Check if workspace exists, create if not
        from sqlalchemy import select
        from app.models.models import Workspace, User
        
        # Check workspace
        workspace_stmt = select(Workspace).where(Workspace.id == agent_data.workspace_id)
        workspace_result = await db.execute(workspace_stmt)
        workspace = workspace_result.scalar()
        
        if not workspace:
            # Create default workspace
            default_workspace = Workspace(
                id=agent_data.workspace_id,
                name="默认工作区",
                description="系统默认工作区",
                owner_id=uuid.UUID('00000000-0000-0000-0000-000000000000'),
                is_active=True,
            )
            db.add(default_workspace)
            await db.commit()
            await db.refresh(default_workspace)
        
        # Check if default user exists, create if not
        user_stmt = select(User).where(User.id == uuid.UUID('00000000-0000-0000-0000-000000000000'))
        user_result = await db.execute(user_stmt)
        user = user_result.scalar()
        
        if not user:
            # Create default user
            default_user = User(
                id=uuid.UUID('00000000-0000-0000-0000-000000000000'),
                username="default",
                email="default@example.com",
                hashed_password="",
                full_name="Default User",
                is_active=True,
                is_superuser=True,
            )
            db.add(default_user)
            await db.commit()
            await db.refresh(default_user)
        
        # Create agent in database
        agent = Agent(
            name=agent_data.name,
            avatar=agent_data.avatar or "🤖",
            role=agent_data.role,
            department_id=agent_data.department_id or '00000000-0000-0000-0000-000000000002',
            job_id=agent_data.job_id,
            workspace_id=agent_data.workspace_id,
            owner_id=uuid.UUID(current_user_id) if current_user_id != "default-user" else uuid.UUID('00000000-0000-0000-0000-000000000000'),
            system_prompt=agent_data.system_prompt or "You are a helpful AI assistant.",
            model_config=agent_data.model_config_json,
            tools=agent_data.tools or [],
            knowledge_base_ids=[str(kb_id) for kb_id in (agent_data.knowledge_base_ids or [])],
        )

        db.add(agent)
        await db.commit()
        await db.refresh(agent)

        # Create agent in memory manager
        agent_manager.create_agent(
            agent_id=str(agent.id),
            name=agent.name,
            role=agent.role,
            system_prompt=agent.system_prompt,
            model_config=agent.model_config,
            tools=agent.tools,
        )

        return AgentCreateResponse(
            id=agent.id,
            name=agent.name,
            role=agent.role,
            department_id=agent.department_id,
            workspace_id=agent.workspace_id,
            owner_id=agent.owner_id,
            system_prompt=agent.system_prompt,
            status="idle",
            knowledge_base_ids=agent.knowledge_base_ids or [],
        )

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/agents", response_model=List[AgentResponse])
async def list_agents(
    workspace_id: str = None,
    db: AsyncSession = Depends(get_db)
):
    """List all agents"""
    try:
        from sqlalchemy import select
        stmt = select(Agent)
        if workspace_id:
            try:
                stmt = stmt.filter(Agent.workspace_id == uuid.UUID(workspace_id))
            except ValueError:
                # 无效的 UUID 格式，忽略 workspace_id 参数
                pass

        result = await db.execute(stmt)
        agents = result.scalars().all()
        
        # 简化响应，避免复杂的类型转换
        return [
            AgentResponse(
                id=agent.id,
                name=agent.name,
                avatar=agent.avatar,
                role=agent.role,
                department_id=agent.department_id,
                job_id=agent.job_id,
                workspace_id=agent.workspace_id,
                owner_id=agent.owner_id,
                system_prompt=agent.system_prompt,
                model_config_json=agent.model_config,
                tools=agent.tools or [],
                knowledge_base_ids=[],  # 暂时返回空列表，避免 UUID 转换错误
                memory_namespace=uuid.UUID('00000000-0000-0000-0000-000000000000'),  # 暂时使用默认值
                status=agent.status,
                created_at=agent.created_at,
                updated_at=agent.updated_at,
            )
            for agent in agents
        ]
    except Exception as e:
        import traceback
        print(f"Error in list_agents: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get agent by ID"""
    agent = await db.get(Agent, uuid.UUID(agent_id))
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    return AgentResponse(
        id=agent.id,
        name=agent.name,
        avatar=agent.avatar,
        role=agent.role,
        department_id=agent.department_id,
        job_id=agent.job_id,
        workspace_id=agent.workspace_id,
        owner_id=agent.owner_id,
        system_prompt=agent.system_prompt,
        model_config_json=agent.model_config,
        tools=agent.tools or [],
        knowledge_base_ids=agent.knowledge_base_ids or [],
        memory_namespace=agent.memory_namespace,
        status=agent.status,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


@router.put("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    agent_data: AgentUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an agent"""
    agent = await db.get(Agent, uuid.UUID(agent_id))
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    update_data = agent_data.model_dump(exclude_unset=True)

    # Map JSON field names
    if "model_config_json" in update_data:
        update_data["model_config"] = update_data.pop("model_config_json")

    # Track config changes for version control
    config_changes = []

    # Check and track system_prompt change
    if "system_prompt" in update_data and update_data["system_prompt"] != agent.system_prompt:
        config_changes.append({
            "config_type": "system_prompt",
            "old_value": agent.system_prompt,
            "new_value": update_data["system_prompt"],
        })

    # Check and track model_config change
    if "model_config" in update_data and update_data["model_config"] != agent.model_config:
        config_changes.append({
            "config_type": "model_config",
            "old_value": agent.model_config,
            "new_value": update_data["model_config"],
        })

    # Check and track tools change
    if "tools" in update_data and update_data["tools"] != agent.tools:
        config_changes.append({
            "config_type": "tools",
            "old_value": agent.tools,
            "new_value": update_data["tools"],
        })

    # Apply updates
    for key, value in update_data.items():
        if key == "knowledge_base_ids" and value is not None:
            setattr(agent, key, [str(kb_id) for kb_id in value])
        elif key == "department_id" and value is not None:
            setattr(agent, key, str(value))
        elif key == "job_id" and value is not None:
            setattr(agent, key, str(value))
        else:
            setattr(agent, key, value)

    await db.commit()
    await db.refresh(agent)

    # Save config versions
    for change in config_changes:
        config_version = ConfigVersion(
            entity_type="agent",
            entity_id=uuid.UUID(agent_id),
            config_type=change["config_type"],
            old_value=change["old_value"],
            new_value=change["new_value"],
        )
        db.add(config_version)

    await db.commit()

    # Update agent in manager
    existing_agent = agent_manager.get_agent(agent_id)
    if existing_agent:
        agent_manager.remove_agent(agent_id)

    agent_manager.create_agent(
        agent_id=str(agent.id),
        name=agent.name,
        role=agent.role,
        system_prompt=agent.system_prompt,
        model_config=agent.model_config,
        tools=agent.tools,
    )

    return AgentResponse(
        id=agent.id,
        name=agent.name,
        avatar=agent.avatar,
        role=agent.role,
        department_id=agent.department_id,
        job_id=agent.job_id,
        workspace_id=agent.workspace_id,
        owner_id=agent.owner_id,
        system_prompt=agent.system_prompt,
        model_config_json=agent.model_config,
        tools=agent.tools or [],
        knowledge_base_ids=agent.knowledge_base_ids or [],
        memory_namespace=agent.memory_namespace,
        status=agent.status,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


@router.delete("/agents/{agent_id}")
async def delete_agent(
    agent_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete an agent"""
    agent = await db.get(Agent, uuid.UUID(agent_id))
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    await db.delete(agent)
    await db.commit()

    # Remove from manager
    agent_manager.remove_agent(agent_id)

    return {"message": "Agent deleted successfully"}


# ============ Multi-Agent Collaboration APIs ============
@router.post("/collaborate")
async def collaborate_with_agents(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Send a message to trigger multi-agent collaboration"""
    try:
        from app.agents.collaboration import (
            process_collaboration_message,
            collaboration_sessions,
            get_or_create_collaboration_session
        )

        # Get supervisor agent (main agent)
        supervisor_agent = await db.get(Agent, request.agent_id)
        if not supervisor_agent:
            raise HTTPException(status_code=404, detail="Supervisor agent not found")

        # Get all agents as potential members
        from sqlalchemy import select
        stmt = select(Agent).where(Agent.workspace_id == supervisor_agent.workspace_id)
        result = await db.execute(stmt)
        all_agents = result.scalars().all()

        # Create agent manager entries if needed
        member_agents = {}
        for agent in all_agents:
            if str(agent.id) != request.agent_id:
                # Create agent in manager if not exists
                if not agent_manager.get_agent(str(agent.id)):
                    agent_manager.create_agent(
                        agent_id=str(agent.id),
                        name=agent.name,
                        role=agent.role or "AI助手",
                        system_prompt=agent.system_prompt or f"你是一个有帮助的AI助手，名为{agent.name}。",
                        model_config=json.loads(agent.model_config) if agent.model_config else None,
                    )
                member_agents[str(agent.id)] = agent_manager.get_agent(str(agent.id))

        # Create supervisor agent in manager if needed
        if not agent_manager.get_agent(str(supervisor_agent.id)):
            agent_manager.create_agent(
                agent_id=str(supervisor_agent.id),
                name=supervisor_agent.name,
                role=supervisor_agent.role or "协调者",
                system_prompt=supervisor_agent.system_prompt or f"你是一个团队协调者，名为{supervisor_agent.name}。",
                model_config=json.loads(supervisor_agent.model_config) if supervisor_agent.model_config else None,
            )

        supervisor = agent_manager.get_agent(str(supervisor_agent.id))

        # Save user message
        user_message = Message(
            content=request.message,
            message_type="user",
            agent_id=request.agent_id,
            user_id=uuid.uuid4(),
            session_id=request.session_id,
        )
        db.add(user_message)
        await db.commit()

        # Process collaboration
        response = await process_collaboration_message(
            session_id=str(request.session_id),
            user_message=request.message,
            supervisor_agent=supervisor,
            member_agents=member_agents,
            user_id=str(user_message.user_id)
        )

        # Save all agent responses as messages
        for msg_data in response.get("messages", []):
            if msg_data["type"] != "supervisor":
                agent_msg = Message(
                    content=msg_data["content"],
                    message_type="agent",
                    agent_id=msg_data["agent_id"],
                    user_id=uuid.uuid4(),
                    session_id=request.session_id,
                    token_count=len(msg_data["content"]) // 4,
                )
                db.add(agent_msg)

        await db.commit()

        return response

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/collaborate/{session_id}/continue")
async def continue_collaboration(
    session_id: str,
    message: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Continue a collaboration session with human intervention"""
    try:
        from app.agents.collaboration import collaboration_sessions

        if session_id not in collaboration_sessions:
            raise HTTPException(status_code=404, detail="Collaboration session not found")

        session = collaboration_sessions[session_id]

        if message.get("type") == "intervention":
            # Human intervention
            response = session.continue_after_intervention(message.get("content", ""))
        else:
            response = await session.process_message(message.get("content", ""))

        # Save response messages
        for msg_data in response.get("messages", []):
            agent_msg = Message(
                content=msg_data["content"],
                message_type="agent",
                agent_id=msg_data["agent_id"],
                user_id=uuid.uuid4(),
                session_id=uuid.UUID(session_id),
                token_count=len(msg_data["content"]) // 4,
            )
            db.add(agent_msg)

        await db.commit()

        return response

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/collaborate/{session_id}/stop")
async def stop_collaboration(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Stop a collaboration session"""
    try:
        from app.agents.collaboration import collaboration_sessions

        if session_id not in collaboration_sessions:
            raise HTTPException(status_code=404, detail="Collaboration session not found")

        session = collaboration_sessions[session_id]
        result = session.stop()

        # Delete session
        del collaboration_sessions[session_id]

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ Chat APIs ============
@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Send a message to an agent and get response"""
    try:
        # Get agent
        agent = await db.get(Agent, request.agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        # Save user message
        user_message = Message(
            content=request.message,
            message_type="user",
            agent_id=request.agent_id,
            user_id=uuid.uuid4(),  # TODO: Get from auth
            session_id=request.session_id,
        )
        db.add(user_message)
        await db.commit()

        # Chat with agent
        response = await agent_manager.chat(
            agent_id=str(agent.id),
            message=request.message,
            session_id=str(request.session_id),
        )

        # Save agent response
        token_count = len(response["response"]) // 4  # Approximate token count
        agent_message = Message(
            content=response["response"],
            message_type="agent",
            agent_id=request.agent_id,
            user_id=uuid.uuid4(),  # TODO: Get from auth
            session_id=request.session_id,
            token_count=token_count,
        )
        db.add(agent_message)
        await db.commit()

        # Record usage stats
        today = datetime.utcnow().strftime("%Y-%m-%d")
        from sqlalchemy import select, and_
        from app.models.models import UsageStats

        # Check if today's record exists
        query = select(UsageStats).where(
            and_(
                UsageStats.workspace_id == agent.workspace_id,
                UsageStats.date == today,
                UsageStats.agent_id == agent.id,
            )
        )
        result = await db.execute(query)
        existing_stat = result.scalar_one_or_none()

        if existing_stat:
            existing_stat.token_count += token_count
            existing_stat.message_count += 2  # User + Agent messages
        else:
            new_stat = UsageStats(
                workspace_id=agent.workspace_id,
                agent_id=agent.id,
                date=today,
                token_count=token_count,
                message_count=2,  # User + Agent messages
            )
            db.add(new_stat)

        await db.commit()

        return ChatResponse(
            message_id=agent_message.id,
            content=agent_message.content,
            agent_id=request.agent_id,
            token_count=agent_message.token_count,
        )

    except HTTPException:
        raise
    except Exception as e:
        # LLM errors typically contain specific error messages
        error_msg = str(e)
        if "RateLimitError" in error_msg or "429" in error_msg or "rate limit" in error_msg.lower():
            raise HTTPException(status_code=500, detail="大模型服务暂时不可用，请稍后再试。")
        elif "API" in error_msg or "api_key" in error_msg.lower() or "authentication" in error_msg.lower():
            raise HTTPException(status_code=500, detail="大模型API配置错误，请检查API密钥设置。")
        else:
            raise HTTPException(status_code=500, detail=f"聊天服务出错: {error_msg}")


@router.post("/reset-context", response_model=ResetContextResponse)
async def reset_context(
    request: ResetContextRequest
):
    """Reset agent context (clear conversation history)"""
    try:
        await agent_manager.reset_session(str(request.session_id))
        return ResetContextResponse(
            success=True,
            message="Context reset successfully"
        )
    except Exception as e:
        return ResetContextResponse(
            success=False,
            message=str(e)
        )


# ============ Message APIs ============
@router.get("/messages/{session_id}", response_model=List[MessageResponse])
async def get_messages(
    session_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get messages for a session"""
    try:
        from sqlalchemy import select
        stmt = select(Message).where(
            Message.session_id == uuid.UUID(session_id)
        ).order_by(Message.created_at.desc()).limit(limit)
        result = await db.execute(stmt)
        messages = result.scalars().all()

        return [
            MessageResponse(
                id=msg.id,
                content=msg.content,
                message_type=msg.message_type,
                agent_id=msg.agent_id,
                user_id=msg.user_id,
                session_id=msg.session_id,
                token_count=msg.token_count,
                metadata=msg.message_metadata,
                created_at=msg.created_at,
            )
            for msg in reversed(messages)
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ Session APIs ============
@router.post("/sessions")
async def create_session(
    session_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Create a new conversation session"""
    try:
        session = ConversationSession(
            id=uuid.UUID(session_data.get('id')),
            agent_id=session_data.get('agent_id'),
            user_id=uuid.UUID('00000000-0000-0000-0000-000000000000'),  # Default user
            title=session_data.get('title', '新对话'),
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return {
            "id": session.id,
            "agent_id": session.agent_id,
            "title": session.title,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/sessions")
async def get_sessions(
    agent_id: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Get sessions for an agent"""
    try:
        from sqlalchemy import select
        stmt = select(ConversationSession)
        if agent_id:
            stmt = stmt.filter(ConversationSession.agent_id == agent_id)
        
        result = await db.execute(stmt)
        sessions = result.scalars().all()
        
        return [
            {
                "id": session.id,
                "agent_id": session.agent_id,
                "title": session.title,
                "created_at": session.created_at,
                "updated_at": session.updated_at,
                "is_archived": session.is_archived
            }
            for session in sessions
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
