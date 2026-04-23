from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
from datetime import datetime

from app.core.database import get_db
from app.models.models import Workspace, WorkspaceMember, User, Agent, KnowledgeBase, ProjectGroup
from app.schemas.schemas import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse,
    WorkspaceMemberAdd, WorkspaceMemberResponse, WorkspaceMemberUpdate
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def check_workspace_admin(workspace_id: str, user_id: str, db: AsyncSession) -> bool:
    """Check if user is workspace admin or owner"""
    workspace = db.get(Workspace, uuid.UUID(workspace_id))
    if not workspace:
        return False
    if str(workspace.owner_id) == user_id:
        return True
    member_query = select(WorkspaceMember).where(
        and_(
            WorkspaceMember.workspace_id == uuid.UUID(workspace_id),
            WorkspaceMember.user_id == uuid.UUID(user_id),
            WorkspaceMember.role == "admin"
        )
    )
    return db.execute(member_query).scalar_one_or_none() is not None


def get_user_workspace_role(workspace_id: str, user_id: str, db: AsyncSession) -> Optional[str]:
    """Get user's role in workspace"""
    workspace = db.get(Workspace, uuid.UUID(workspace_id))
    if not workspace:
        return None
    if str(workspace.owner_id) == user_id:
        return "owner"
    member_query = select(WorkspaceMember.role).where(
        and_(
            WorkspaceMember.workspace_id == uuid.UUID(workspace_id),
            WorkspaceMember.user_id == uuid.UUID(user_id)
        )
    )
    result = db.execute(member_query).scalar_one_or_none()
    return result


@router.post("/", response_model=WorkspaceResponse)
async def create_workspace(
    workspace_data: WorkspaceCreate,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Create a new workspace"""
    workspace = Workspace(
        name=workspace_data.name,
        description=workspace_data.description,
        owner_id=uuid.UUID(user_id),
        is_active=True,
    )
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        owner_id=workspace.owner_id,
        is_active=workspace.is_active,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
    )


@router.get("/", response_model=List[WorkspaceResponse])
async def list_user_workspaces(
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """List all workspaces for a user"""
    try:
        user_uuid = uuid.UUID(user_id)
        query = select(Workspace).where(
            (Workspace.owner_id == user_uuid) |
            (Workspace.id.in_(
                select(WorkspaceMember.workspace_id).where(
                    WorkspaceMember.user_id == user_uuid
                )
            ))
        )
    except (ValueError, Exception):
        query = select(Workspace)

    result = await db.execute(query)
    workspaces = result.scalars().all()

    return [
        WorkspaceResponse(
            id=w.id,
            name=w.name,
            description=w.description,
            owner_id=w.owner_id,
            is_active=w.is_active,
            created_at=w.created_at,
            updated_at=w.updated_at,
        )
        for w in workspaces
    ]


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get workspace details"""
    role = get_user_workspace_role(workspace_id, user_id, db)
    if not role:
        raise HTTPException(status_code=403, detail="Access denied")

    workspace = db.get(Workspace, uuid.UUID(workspace_id))
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        owner_id=workspace.owner_id,
        is_active=workspace.is_active,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
    )


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    workspace_data: WorkspaceUpdate,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Update workspace"""
    if not check_workspace_admin(workspace_id, user_id, db):
        raise HTTPException(status_code=403, detail="Admin access required")

    workspace = db.get(Workspace, uuid.UUID(workspace_id))
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    update_data = workspace_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(workspace, key, value)

    await db.commit()
    await db.refresh(workspace)

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        owner_id=workspace.owner_id,
        is_active=workspace.is_active,
        created_at=workspace.created_at,
        updated_at=workspace.updated_at,
    )


@router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete workspace (owner only)"""
    workspace = db.get(Workspace, uuid.UUID(workspace_id))
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if str(workspace.owner_id) != user_id:
        raise HTTPException(status_code=403, detail="Only owner can delete workspace")

    await db.delete(workspace)
    await db.commit()

    return {"success": True, "message": "Workspace deleted"}


@router.get("/{workspace_id}/members", response_model=List[WorkspaceMemberResponse])
async def list_workspace_members(
    workspace_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """List workspace members"""
    role = get_user_workspace_role(workspace_id, user_id, db)
    if not role:
        raise HTTPException(status_code=403, detail="Access denied")

    query = select(WorkspaceMember).where(
        WorkspaceMember.workspace_id == uuid.UUID(workspace_id)
    ).options(selectinload(WorkspaceMember.user))

    result = await db.execute(query)
    members = result.scalars().all()

    return [
        WorkspaceMemberResponse(
            id=m.id,
            workspace_id=m.workspace_id,
            user_id=m.user_id,
            role=m.role,
            joined_at=m.joined_at,
            user_email=m.user.email if m.user else None,
            user_name=m.user.full_name if m.user else None,
        )
        for m in members
    ]


@router.post("/{workspace_id}/members")
async def add_workspace_member(
    workspace_id: str,
    member_data: WorkspaceMemberAdd,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Add member to workspace"""
    if not check_workspace_admin(workspace_id, user_id, db):
        raise HTTPException(status_code=403, detail="Admin access required")

    workspace = db.get(Workspace, uuid.UUID(workspace_id))
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    user = db.get(User, uuid.UUID(member_data.user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing_query = select(WorkspaceMember).where(
        and_(
            WorkspaceMember.workspace_id == uuid.UUID(workspace_id),
            WorkspaceMember.user_id == uuid.UUID(member_data.user_id)
        )
    )
    if await db.execute(existing_query).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already a member")

    member = WorkspaceMember(
        workspace_id=uuid.UUID(workspace_id),
        user_id=uuid.UUID(member_data.user_id),
        role=member_data.role,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return WorkspaceMemberResponse(
        id=member.id,
        workspace_id=member.workspace_id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
        user_email=user.email,
        user_name=user.full_name,
    )


@router.put("/{workspace_id}/members/{member_id}")
async def update_workspace_member(
    workspace_id: str,
    member_id: str,
    member_data: WorkspaceMemberUpdate,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Update workspace member role"""
    if not check_workspace_admin(workspace_id, user_id, db):
        raise HTTPException(status_code=403, detail="Admin access required")

    member = db.get(WorkspaceMember, uuid.UUID(member_id))
    if not member or str(member.workspace_id) != workspace_id:
        raise HTTPException(status_code=404, detail="Member not found")

    workspace = db.get(Workspace, uuid.UUID(workspace_id))
    if str(workspace.owner_id) == str(member.user_id) and member_data.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot change owner's role")

    member.role = member_data.role
    await db.commit()
    await db.refresh(member)

    return WorkspaceMemberResponse(
        id=member.id,
        workspace_id=member.workspace_id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.joined_at,
    )


@router.delete("/{workspace_id}/members/{member_id}")
async def remove_workspace_member(
    workspace_id: str,
    member_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Remove member from workspace"""
    if not check_workspace_admin(workspace_id, user_id, db):
        raise HTTPException(status_code=403, detail="Admin access required")

    member = db.get(WorkspaceMember, uuid.UUID(member_id))
    if not member or str(member.workspace_id) != workspace_id:
        raise HTTPException(status_code=404, detail="Member not found")

    workspace = db.get(Workspace, uuid.UUID(workspace_id))
    if str(workspace.owner_id) == str(member.user_id):
        raise HTTPException(status_code=400, detail="Cannot remove workspace owner")

    await db.delete(member)
    await db.commit()

    return {"success": True, "message": "Member removed"}


@router.get("/{workspace_id}/stats")
async def get_workspace_stats(
    workspace_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get workspace statistics"""
    role = get_user_workspace_role(workspace_id, user_id, db)
    if not role:
        raise HTTPException(status_code=403, detail="Access denied")

    workspace = db.get(Workspace, uuid.UUID(workspace_id))
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    agent_count_query = select(Agent).where(Agent.workspace_id == uuid.UUID(workspace_id))
    agent_count = len((await db.execute(agent_count_query)).scalars().all())

    member_count_query = select(WorkspaceMember).where(
        WorkspaceMember.workspace_id == uuid.UUID(workspace_id)
    )
    member_count = len((await db.execute(member_count_query)).scalars().all()) + 1

    kb_count_query = select(KnowledgeBase).where(
        KnowledgeBase.workspace_id == uuid.UUID(workspace_id)
    )
    kb_count = len((await db.execute(kb_count_query)).scalars().all())

    group_count_query = select(ProjectGroup).where(
        ProjectGroup.workspace_id == uuid.UUID(workspace_id)
    )
    group_count = len((await db.execute(group_count_query)).scalars().all())

    return {
        "workspace_id": workspace_id,
        "agent_count": agent_count,
        "member_count": member_count,
        "knowledge_base_count": kb_count,
        "project_group_count": group_count,
    }
