from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
import uuid
import json
from datetime import datetime
from io import BytesIO, StringIO
import csv

from app.core.database import get_db
from app.models.models import Message, ConversationSession, KnowledgeBase, Document, Agent, User, WorkspaceMember, Workspace
from app.schemas.schemas import ExportRequest

router = APIRouter(prefix="/export", tags=["export"])


def check_workspace_access(workspace_id: str, user_id: str, db: AsyncSession, require_write: bool = False) -> bool:
    """Check if user has access to workspace"""
    workspace = db.get(Workspace, uuid.UUID(workspace_id))
    if not workspace:
        return False

    if str(workspace.owner_id) == user_id:
        return True

    member_query = select(WorkspaceMember).where(
        and_(
            WorkspaceMember.workspace_id == uuid.UUID(workspace_id),
            WorkspaceMember.user_id == uuid.UUID(user_id)
        )
    )
    member = db.execute(member_query).scalar_one_or_none()

    if not member:
        return False

    if require_write and member.role == "readonly":
        return False

    return True


@router.post("/conversations")
async def export_conversations(
    request: ExportRequest,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Export conversation history"""
    if request.workspace_id and not check_workspace_access(request.workspace_id, user_id, db):
        raise HTTPException(status_code=403, detail="Access denied")

    conversations = []

    if request.agent_id:
        query = select(ConversationSession).where(
            ConversationSession.agent_id == uuid.UUID(request.agent_id)
        )
    elif request.workspace_id:
        agent_query = select(Agent.id).where(
            Agent.workspace_id == uuid.UUID(request.workspace_id)
        )
        agents_result = await db.execute(agent_query)
        agent_ids = [row[0] for row in agents_result.fetchall()]

        query = select(ConversationSession).where(
            ConversationSession.agent_id.in_(agent_ids)
        )
    else:
        query = select(ConversationSession)

    result = await db.execute(query)
    sessions = result.scalars().all()

    for session in sessions:
        messages_query = select(Message).where(
            Message.session_id == session.id
        ).order_by(Message.created_at)

        messages_result = await db.execute(messages_query)
        messages = messages_result.scalars().all()

        session_data = {
            "session_id": str(session.id),
            "title": session.title or "无标题",
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "archived": session.is_archived,
            "messages": [
                {
                    "id": str(msg.id),
                    "content": msg.content,
                    "message_type": msg.message_type,
                    "token_count": msg.token_count,
                    "created_at": msg.created_at.isoformat() if msg.created_at else None,
                }
                for msg in messages
            ]
        }
        conversations.append(session_data)

    if request.format == "json":
        return {
            "export_type": "conversations",
            "exported_at": datetime.utcnow().isoformat(),
            "count": len(conversations),
            "data": conversations
        }
    else:
        csv_output = StringIO()
        writer = csv.writer(csv_output)
        writer.writerow(["Session ID", "Title", "Created At", "Message Type", "Content", "Token Count"])

        for conv in conversations:
            for msg in conv["messages"]:
                writer.writerow([
                    conv["session_id"],
                    conv["title"],
                    conv["created_at"],
                    msg["message_type"],
                    msg["content"],
                    msg["token_count"]
                ])

        return {
            "export_type": "conversations",
            "exported_at": datetime.utcnow().isoformat(),
            "count": len(conversations),
            "format": "csv",
            "data": csv_output.getvalue()
        }


@router.post("/knowledge-bases")
async def export_knowledge_bases(
    request: ExportRequest,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Export knowledge base content"""
    if request.workspace_id and not check_workspace_access(request.workspace_id, user_id, db):
        raise HTTPException(status_code=403, detail="Access denied")

    if not request.workspace_id:
        raise HTTPException(status_code=400, detail="Workspace ID required")

    kb_query = select(KnowledgeBase).where(
        KnowledgeBase.workspace_id == uuid.UUID(request.workspace_id)
    )
    result = await db.execute(kb_query)
    knowledge_bases = result.scalars().all()

    export_data = []

    for kb in knowledge_bases:
        docs_query = select(Document).where(
            Document.knowledge_base_id == kb.id
        )
        docs_result = await db.execute(docs_query)
        documents = docs_result.scalars().all()

        kb_data = {
            "knowledge_base": {
                "id": str(kb.id),
                "name": kb.name,
                "description": kb.description,
                "visibility": kb.visibility,
                "created_at": kb.created_at.isoformat() if kb.created_at else None,
            },
            "documents": [
                {
                    "id": str(doc.id),
                    "title": doc.title,
                    "content": doc.content,
                    "file_path": doc.file_path,
                    "file_type": doc.file_type,
                    "chunk_count": doc.chunk_count,
                    "created_at": doc.created_at.isoformat() if doc.created_at else None,
                }
                for doc in documents
            ]
        }
        export_data.append(kb_data)

    if request.format == "json":
        return {
            "export_type": "knowledge_bases",
            "exported_at": datetime.utcnow().isoformat(),
            "count": len(export_data),
            "data": export_data
        }
    else:
        csv_output = StringIO()
        writer = csv.writer(csv_output)
        writer.writerow(["KB Name", "Document Title", "Content", "File Type", "Created At"])

        for kb_data in export_data:
            for doc in kb_data["documents"]:
                writer.writerow([
                    kb_data["knowledge_base"]["name"],
                    doc["title"],
                    doc["content"],
                    doc["file_type"],
                    doc["created_at"]
                ])

        return {
            "export_type": "knowledge_bases",
            "exported_at": datetime.utcnow().isoformat(),
            "count": len(export_data),
            "format": "csv",
            "data": csv_output.getvalue()
        }


@router.post("/workspace")
async def export_workspace(
    workspace_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Export all workspace data"""
    if not check_workspace_access(workspace_id, user_id, db):
        raise HTTPException(status_code=403, detail="Access denied")

    workspace = db.get(Workspace, uuid.UUID(workspace_id))
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    agents_query = select(Agent).where(
        Agent.workspace_id == uuid.UUID(workspace_id)
    )
    agents_result = await db.execute(agents_query)
    agents = agents_result.scalars().all()

    kb_query = select(KnowledgeBase).where(
        KnowledgeBase.workspace_id == uuid.UUID(workspace_id)
    )
    kb_result = await db.execute(kb_query)
    knowledge_bases = kb_result.scalars().all()

    workspace_data = {
        "workspace": {
            "id": str(workspace.id),
            "name": workspace.name,
            "description": workspace.description,
            "created_at": workspace.created_at.isoformat() if workspace.created_at else None,
        },
        "agents": [
            {
                "id": str(agent.id),
                "name": agent.name,
                "role": agent.role,
                "status": agent.status,
                "system_prompt": agent.system_prompt,
                "tools": agent.tools,
                "created_at": agent.created_at.isoformat() if agent.created_at else None,
            }
            for agent in agents
        ],
        "knowledge_bases": [
            {
                "id": str(kb.id),
                "name": kb.name,
                "description": kb.description,
                "visibility": kb.visibility,
                "created_at": kb.created_at.isoformat() if kb.created_at else None,
            }
            for kb in knowledge_bases
        ]
    }

    return {
        "export_type": "workspace",
        "exported_at": datetime.utcnow().isoformat(),
        "workspace_id": workspace_id,
        "data": workspace_data
    }
