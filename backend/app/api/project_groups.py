from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List
import uuid
from datetime import datetime

from app.core.database import get_db
from app.models.models import (
    ProjectGroup, ProjectGroupMember, GroupMessage, Agent
)
from app.schemas.schemas import (
    ProjectGroupCreate, ProjectGroupUpdate, ProjectGroupResponse,
    ProjectGroupMemberResponse, GroupMessageResponse, GroupChatRequest,
    GroupChatResponse, AddGroupMemberRequest, RemoveGroupMemberRequest
)
from app.agents.agent import agent_manager, group_agent_manager, MainAgent, SubAgent

router = APIRouter()


# ============ Project Group APIs ============
@router.post("/project-groups", response_model=ProjectGroupResponse)
async def create_project_group(
    group_data: ProjectGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = "default-user"
):
    """Create a new project group"""
    try:
        # Create project group
        group = ProjectGroup(
            name=group_data.name,
            description=group_data.description,
            workspace_id=group_data.workspace_id,
            supervisor_id=group_data.supervisor_id,
            is_active=group_data.is_active,
        )

        db.add(group)
        await db.commit()
        await db.refresh(group)

        # Add members
        supervisor_member = ProjectGroupMember(
            project_group_id=group.id,
            agent_id=group.supervisor_id,
            role_in_group="Supervisor",
        )
        db.add(supervisor_member)

        for agent_id in group_data.member_agent_ids:
            if str(agent_id) != str(group.supervisor_id):
                member = ProjectGroupMember(
                    project_group_id=group.id,
                    agent_id=agent_id,
                )
                db.add(member)

        await db.commit()

        # Create group agent in manager
        supervisor_agent = agent_manager.get_agent(str(group.supervisor_id))
        member_agents = []

        # Create supervisor agent if it doesn't exist
        if not supervisor_agent:
            # Get supervisor from database
            supervisor_db = await db.get(Agent, group.supervisor_id)
            if supervisor_db:
                supervisor_agent = agent_manager.create_agent(
                    agent_id=str(supervisor_db.id),
                    name=supervisor_db.name,
                    role=supervisor_db.role or "Supervisor",
                    system_prompt=supervisor_db.system_prompt or "You are a team supervisor.",
                    model_config=supervisor_db.model_config,
                    tools=supervisor_db.tools or [],
                )

        # Create member agents
        for agent_id in group_data.member_agent_ids:
            agent = agent_manager.get_agent(str(agent_id))
            if not agent:
                # Get agent from database
                agent_db = await db.get(Agent, agent_id)
                if agent_db:
                    agent = agent_manager.create_agent(
                        agent_id=str(agent_db.id),
                        name=agent_db.name,
                        role=agent_db.role or "Team Member",
                        system_prompt=agent_db.system_prompt or "You are a team member.",
                        model_config=agent_db.model_config,
                        tools=agent_db.tools or [],
                    )
            
            if agent and str(agent_id) != str(group.supervisor_id):
                # Convert to SubAgent
                sub_agent = SubAgent(
                    agent_id=agent.agent_id,
                    name=agent.name,
                    role=agent.role,
                    system_prompt=agent.system_prompt,
                    model_config=agent.model_config,
                    tools=agent.tools,
                    project_group_id=str(group.id),
                )
                member_agents.append(sub_agent)
                print(f"[DEBUG] Created sub_agent: {sub_agent.name} ({sub_agent.agent_id})")
        
        print(f"[DEBUG] Total member_agents created: {len(member_agents)}")
        for ma in member_agents:
            print(f"[DEBUG] member_agent: {ma.name} ({ma.agent_id})")

        # Always create group agent in manager
        if supervisor_agent:
            # Convert to MainAgent
            main_agent = MainAgent(
                agent_id=supervisor_agent.agent_id,
                name=supervisor_agent.name,
                role=supervisor_agent.role,
                system_prompt=supervisor_agent.system_prompt,
                model_config=supervisor_agent.model_config,
                tools=supervisor_agent.tools,
                project_group_id=str(group.id),
            )
            group_agent_manager.create_group(
                project_group_id=str(group.id),
                supervisor_agent=main_agent,
                member_agents=member_agents,
            )
        else:
            # Create a default supervisor agent if none exists
            default_supervisor = MainAgent(
                agent_id=str(group.supervisor_id),
                name="Default Supervisor",
                role="Supervisor",
                system_prompt="You are a team supervisor.",
                model_config={},
                tools=[],
                project_group_id=str(group.id),
            )
            group_agent_manager.create_group(
                project_group_id=str(group.id),
                supervisor_agent=default_supervisor,
                member_agents=member_agents,
            )

        return await get_project_group_response(group, db)

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/project-groups", response_model=List[ProjectGroupResponse])
async def list_project_groups(
    workspace_id: str = None,
    db: AsyncSession = Depends(get_db)
):
    """List all project groups"""
    try:
        query = select(ProjectGroup)
        if workspace_id:
            query = query.where(ProjectGroup.workspace_id == uuid.UUID(workspace_id))

        result = await db.execute(query)
        groups = result.scalars().all()

        responses = []
        for group in groups:
            responses.append(await get_project_group_response(group, db))

        return responses

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/project-groups/{group_id}", response_model=ProjectGroupResponse)
async def get_project_group(
    group_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get project group by ID"""
    group = await db.get(ProjectGroup, uuid.UUID(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Project group not found")

    return await get_project_group_response(group, db)


@router.put("/project-groups/{group_id}", response_model=ProjectGroupResponse)
async def update_project_group(
    group_id: str,
    group_data: ProjectGroupUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a project group"""
    group = await db.get(ProjectGroup, uuid.UUID(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Project group not found")

    update_data = group_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(group, key, value)

    await db.commit()
    await db.refresh(group)

    return await get_project_group_response(group, db)


@router.delete("/project-groups/{group_id}")
async def delete_project_group(
    group_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a project group"""
    group = await db.get(ProjectGroup, uuid.UUID(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Project group not found")

    await db.delete(group)
    await db.commit()

    # Remove from manager
    group_agent_manager.remove_group(group_id)

    return {"message": "Project group deleted successfully"}


# ============ Group Member APIs ============
@router.post("/project-groups/{group_id}/members", response_model=ProjectGroupResponse)
async def add_group_member(
    group_id: str,
    member_data: AddGroupMemberRequest,
    db: AsyncSession = Depends(get_db)
):
    """Add a member to a project group"""
    group = await db.get(ProjectGroup, uuid.UUID(group_id))
    if not group:
        raise HTTPException(status_code=404, detail="Project group not found")

    # Check if already a member
    check_query = select(ProjectGroupMember).where(
        and_(
            ProjectGroupMember.project_group_id == uuid.UUID(group_id),
            ProjectGroupMember.agent_id == member_data.agent_id
        )
    )
    result = await db.execute(check_query)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Agent already a member of this group")

    # Add new member
    member = ProjectGroupMember(
        project_group_id=group.id,
        agent_id=member_data.agent_id,
        role_in_group=member_data.role_in_group,
    )
    db.add(member)
    await db.commit()

    # Update group agent manager
    agent = agent_manager.get_agent(str(member_data.agent_id))
    if agent:
        group_agent = group_agent_manager.get_group(group_id)
        if group_agent:
            # Convert to SubAgent
            sub_agent = SubAgent(
                agent_id=agent.agent_id,
                name=agent.name,
                role=agent.role,
                system_prompt=agent.system_prompt,
                model_config=agent.model_config,
                tools=agent.tools,
                project_group_id=group_id,
            )
            group_agent.members[str(member_data.agent_id)] = sub_agent
            group_agent.build_graph()

    return await get_project_group_response(group, db)


@router.delete("/project-groups/{group_id}/members")
async def remove_group_member(
    group_id: str,
    member_data: RemoveGroupMemberRequest,
    db: AsyncSession = Depends(get_db)
):
    """Remove a member from a project group"""
    query = select(ProjectGroupMember).where(
        and_(
            ProjectGroupMember.project_group_id == uuid.UUID(group_id),
            ProjectGroupMember.agent_id == member_data.agent_id
        )
    )
    result = await db.execute(query)
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.delete(member)
    await db.commit()

    # Update group agent manager
    group_agent = group_agent_manager.get_group(group_id)
    if group_agent and str(member_data.agent_id) in group_agent.members:
        del group_agent.members[str(member_data.agent_id)]
        group_agent.build_graph()

    return {"message": "Member removed successfully"}


# ============ Group Chat APIs ============
@router.post("/project-groups/{group_id}/chat", response_model=GroupChatResponse)
async def group_chat(
    group_id: str,
    request: GroupChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Send message to project group with multi-agent collaboration"""
    # 保存用户消息
    user_msg = GroupMessage(
        project_group_id=uuid.UUID(group_id),
        content=request.message,
        message_type="user",
        user_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
    )
    db.add(user_msg)
    await db.commit()
    await db.refresh(user_msg)

    # Get group chat response
    import logging
    from app.core.config import settings
    logger = logging.getLogger(__name__)
    logger.info(f"Calling group chat with model: {settings.DEFAULT_MODEL}")
    logger.info(f"Group ID: {group_id}")
    logger.info(f"Message: {request.message}")
    logger.info(f"Mention agent IDs: {request.mention_agent_ids}")
    
    try:
        # Check if group exists
        group = group_agent_manager.get_group(group_id)
        if not group:
            logger.error(f"Group {group_id} not found in group_agent_manager")
            raise HTTPException(status_code=404, detail="项目组不存在或未初始化")
        
        logger.info(f"Group found: {group.project_group_id}")
        logger.info(f"Members: {list(group.members.keys())}")
        
        # Get group chat response
        result = await group_agent_manager.group_chat(
            project_group_id=group_id,
            message=request.message,
            mention_agent_ids=request.mention_agent_ids,
        )

        # Save agent responses
        token_count = 0
        last_sender_id = None

        for response in result["responses"]:
            sender_id = uuid.UUID(response["sender_agent_id"]) if response["sender_agent_id"] else None
            agent_msg = GroupMessage(
                project_group_id=uuid.UUID(group_id),
                content=response["content"],
                message_type="agent",
                sender_agent_id=sender_id,
                token_count=len(response["content"]) // 4,
            )
            db.add(agent_msg)
            token_count += len(response["content"]) // 4
            last_sender_id = sender_id

        await db.commit()

        from app.api.websocket import manager
        await manager.broadcast_to_group(group_id, {
            "type": "message",
            "timestamp": datetime.utcnow().isoformat()
        })

        return GroupChatResponse(
            message_id=user_msg.id,
            content=result["final_response"],
            sender_agent_id=last_sender_id,
            token_count=token_count,
        )
    except HTTPException:
        raise
    except Exception as llm_error:
        import traceback
        logger.error(f"LLM error: {str(llm_error)}")
        logger.error(f"Error traceback: {traceback.format_exc()}")
        
        # Save a fallback response when LLM fails
        try:
            fallback_msg = GroupMessage(
                project_group_id=uuid.UUID(group_id),
                content="抱歉，大模型服务暂时不可用，请稍后再试。",
                message_type="agent",
                token_count=0,
            )
            db.add(fallback_msg)
            await db.commit()
            
            from app.api.websocket import manager
            await manager.broadcast_to_group(group_id, {
                "type": "message",
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as db_error:
            logger.error(f"Database error while saving fallback: {str(db_error)}")
            
        # Return 200 status with fallback response instead of 500 error
        return GroupChatResponse(
            message_id=user_msg.id,
            content="抱歉，大模型服务暂时不可用，请稍后再试。",
            sender_agent_id=None,
            token_count=0,
        )


@router.get("/project-groups/{group_id}/messages", response_model=List[GroupMessageResponse])
async def get_group_messages(
    group_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get messages for a project group"""
    try:
        query = select(GroupMessage).filter(
            GroupMessage.project_group_id == uuid.UUID(group_id)
        ).order_by(GroupMessage.created_at.desc()).limit(limit)

        result = await db.execute(query)
        messages = result.scalars().all()

        # Convert message_metadata to metadata for each message
        responses = []
        for msg in messages:
            # Convert message_metadata to dict if needed
            metadata_value = None
            if msg.message_metadata is not None:
                if isinstance(msg.message_metadata, dict):
                    metadata_value = msg.message_metadata
                else:
                    # If it's a MetaData object, convert to dict
                    metadata_value = dict(msg.message_metadata) if hasattr(msg.message_metadata, '__iter__') else {}
            
            response_data = {
                "id": msg.id,
                "project_group_id": msg.project_group_id,
                "content": msg.content,
                "message_type": msg.message_type,
                "sender_agent_id": msg.sender_agent_id,
                "user_id": msg.user_id,
                "token_count": msg.token_count,
                "metadata": metadata_value,
                "created_at": msg.created_at,
            }
            responses.append(GroupMessageResponse(**response_data))

        return responses

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============ Helper Functions ============
async def get_project_group_response(group: ProjectGroup, db: AsyncSession) -> ProjectGroupResponse:
    """Get project group response with members"""
    members_query = select(ProjectGroupMember).where(
        ProjectGroupMember.project_group_id == group.id
    )
    result = await db.execute(members_query)
    members = result.scalars().all()

    member_responses = [
        ProjectGroupMemberResponse(
            id=m.id,
            agent_id=m.agent_id,
            joined_at=m.joined_at,
            role_in_group=m.role_in_group,
        )
        for m in members
    ]

    # Convert MetaData to dict if needed
    config_data = None
    if group.config is not None:
        if isinstance(group.config, dict):
            config_data = group.config
        else:
            # If it's a MetaData object, convert to dict
            config_data = dict(group.config) if hasattr(group.config, '__iter__') else {}

    return ProjectGroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        workspace_id=group.workspace_id,
        supervisor_id=group.supervisor_id,
        is_active=group.is_active,
        config=config_data,
        created_at=group.created_at,
        updated_at=group.updated_at,
        members=member_responses,
    )
