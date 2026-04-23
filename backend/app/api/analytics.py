from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
import uuid
from datetime import datetime

from app.core.database import get_db
from app.models.models import ConfigVersion, UsageStats, Agent, ProjectGroup
from app.schemas.schemas import (
    ConfigVersionResponse, UsageStatsRequest, UsageStatsResponse
)

router = APIRouter()


# ============ Config Version APIs ============
@router.get("/config-versions/{entity_type}/{entity_id}", response_model=List[ConfigVersionResponse])
async def get_config_versions(
    entity_type: str,
    entity_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get config versions for an entity"""
    try:
        query = select(ConfigVersion).where(
            and_(
                ConfigVersion.entity_type == entity_type,
                ConfigVersion.entity_id == uuid.UUID(entity_id)
            )
        ).order_by(ConfigVersion.created_at.desc()).limit(limit)

        result = await db.execute(query)
        versions = result.scalars().all()

        return list(versions)

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/config-versions/{version_id}", response_model=ConfigVersionResponse)
async def get_config_version(
    version_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific config version"""
    version = await db.get(ConfigVersion, uuid.UUID(version_id))
    if not version:
        raise HTTPException(status_code=404, detail="Config version not found")
    return version


@router.post("/config-versions/{version_id}/rollback")
async def rollback_config_version(
    version_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Rollback to a previous config version"""
    version = await db.get(ConfigVersion, uuid.UUID(version_id))
    if not version:
        raise HTTPException(status_code=404, detail="Config version not found")

    try:
        if version.entity_type == "agent":
            agent = await db.get(Agent, version.entity_id)
            if not agent:
                raise HTTPException(status_code=404, detail="Agent not found")

            if version.config_type == "system_prompt":
                agent.system_prompt = version.old_value or ""
            elif version.config_type == "model_config":
                agent.model_config = version.old_value
            elif version.config_type == "tools":
                agent.tools = version.old_value

        elif version.entity_type == "project_group":
            group = await db.get(ProjectGroup, version.entity_id)
            if not group:
                raise HTTPException(status_code=404, detail="Project group not found")
            group.config = version.old_value

        await db.commit()
        return {"success": True, "message": "Config rolled back successfully"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ============ Usage Stats APIs ============
@router.get("/usage-stats", response_model=UsageStatsResponse)
async def get_usage_stats(
    workspace_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    project_group_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get usage statistics"""
    try:
        # Build query filters
        query = select(UsageStats)
        filters = []

        if workspace_id:
            filters.append(UsageStats.workspace_id == uuid.UUID(workspace_id))
        if agent_id:
            filters.append(UsageStats.agent_id == uuid.UUID(agent_id))
        if project_group_id:
            filters.append(UsageStats.project_group_id == uuid.UUID(project_group_id))
        if start_date:
            filters.append(UsageStats.date >= start_date)
        if end_date:
            filters.append(UsageStats.date <= end_date)

        if filters:
            query = query.where(and_(*filters))

        result = await db.execute(query)
        stats = result.scalars().all()

        # Aggregate totals
        total_tokens = sum(s.token_count for s in stats)
        total_messages = sum(s.message_count for s in stats)

        # Group by date
        by_date = {}
        for stat in stats:
            if stat.date not in by_date:
                by_date[stat.date] = {"token_count": 0, "message_count": 0}
            by_date[stat.date]["token_count"] += stat.token_count
            by_date[stat.date]["message_count"] += stat.message_count

        by_date_list = [
            {"date": date, **data}
            for date, data in sorted(by_date.items())
        ]

        # Group by agent
        by_agent = {}
        for stat in stats:
            if stat.agent_id:
                agent_key = str(stat.agent_id)
                if agent_key not in by_agent:
                    by_agent[agent_key] = {"agent_id": agent_key, "token_count": 0, "message_count": 0}
                by_agent[agent_key]["token_count"] += stat.token_count
                by_agent[agent_key]["message_count"] += stat.message_count

        by_agent_list = list(by_agent.values())

        return UsageStatsResponse(
            total_token_count=total_tokens,
            total_message_count=total_messages,
            by_date=by_date_list,
            by_agent=by_agent_list,
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/usage-stats/record")
async def record_usage(
    workspace_id: str,
    agent_id: Optional[str] = None,
    project_group_id: Optional[str] = None,
    user_id: Optional[str] = None,
    token_count: int = 0,
    message_count: int = 1,
    db: AsyncSession = Depends(get_db),
):
    """Record usage statistics (internal API)"""
    try:
        today = datetime.utcnow().strftime("%Y-%m-%d")

        # Check if today's record exists
        query = select(UsageStats).where(
            and_(
                UsageStats.workspace_id == uuid.UUID(workspace_id),
                UsageStats.date == today,
                *(
                    [UsageStats.agent_id == uuid.UUID(agent_id)]
                    if agent_id
                    else [UsageStats.agent_id == None]
                ),
                *(
                    [UsageStats.project_group_id == uuid.UUID(project_group_id)]
                    if project_group_id
                    else [UsageStats.project_group_id == None]
                ),
            )
        )

        result = await db.execute(query)
        existing_stat = result.scalar_one_or_none()

        if existing_stat:
            existing_stat.token_count += token_count
            existing_stat.message_count += message_count
        else:
            new_stat = UsageStats(
                workspace_id=uuid.UUID(workspace_id),
                agent_id=uuid.UUID(agent_id) if agent_id else None,
                project_group_id=uuid.UUID(project_group_id) if project_group_id else None,
                user_id=uuid.UUID(user_id) if user_id else None,
                date=today,
                token_count=token_count,
                message_count=message_count,
            )
            db.add(new_stat)

        await db.commit()
        return {"success": True, "message": "Usage recorded"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
