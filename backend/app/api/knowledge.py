from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List
import uuid
import os
from datetime import datetime

from app.core.database import get_db
from app.models.models import KnowledgeBase, Document, User, WorkspaceMember, Workspace
from app.schemas.schemas import (
    KnowledgeBaseCreate, KnowledgeBaseUpdate, KnowledgeBaseResponse,
    DocumentResponse
)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


async def check_workspace_access(workspace_id: str, user_id: str, db: AsyncSession, require_write: bool = False) -> bool:
    """Check if user has access to workspace"""
    if user_id == "default-user":
        return True

    try:
        workspace = await db.get(Workspace, uuid.UUID(workspace_id))
        if not workspace:
            return False

        if user_id == str(workspace.owner_id):
            return True

        try:
            user_uuid = uuid.UUID(user_id)
            member_query = select(WorkspaceMember).where(
                and_(
                    WorkspaceMember.workspace_id == uuid.UUID(workspace_id),
                    WorkspaceMember.user_id == user_uuid
                )
            )
            member_result = await db.execute(member_query)
            member = member_result.scalar_one_or_none()

            if not member:
                return False

            if require_write and member.role == "readonly":
                return False
        except (ValueError, Exception):
            pass

        return True
    except (ValueError, Exception):
        return False


@router.post("/", response_model=KnowledgeBaseResponse)
async def create_knowledge_base(
    kb_data: KnowledgeBaseCreate,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Create a new knowledge base"""
    workspace_id_str = str(kb_data.workspace_id)
    if not await check_workspace_access(workspace_id_str, user_id, db, require_write=True):
        raise HTTPException(status_code=403, detail="Access denied")

    kb = KnowledgeBase(
        name=kb_data.name,
        description=kb_data.description,
        workspace_id=kb_data.workspace_id,
        visibility=kb_data.visibility or "private",
    )
    db.add(kb)
    await db.commit()
    await db.refresh(kb)

    return KnowledgeBaseResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        workspace_id=kb.workspace_id,
        visibility=kb.visibility,
        created_at=kb.created_at,
        updated_at=kb.updated_at,
    )


@router.get("/", response_model=List[KnowledgeBaseResponse])
async def list_knowledge_bases(
    workspace_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """List knowledge bases in a workspace"""
    if not await check_workspace_access(workspace_id, user_id, db):
        raise HTTPException(status_code=403, detail="Access denied")

    query = select(KnowledgeBase).where(
        KnowledgeBase.workspace_id == uuid.UUID(workspace_id)
    )
    result = await db.execute(query)
    kbs = result.scalars().all()

    return [
        KnowledgeBaseResponse(
            id=kb.id,
            name=kb.name,
            description=kb.description,
            workspace_id=kb.workspace_id,
            visibility=kb.visibility,
            created_at=kb.created_at,
            updated_at=kb.updated_at,
        )
        for kb in kbs
    ]


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(
    kb_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get knowledge base details"""
    kb = await db.get(KnowledgeBase, uuid.UUID(kb_id))
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    if not await check_workspace_access(str(kb.workspace_id), user_id, db):
        raise HTTPException(status_code=403, detail="Access denied")

    return KnowledgeBaseResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        workspace_id=kb.workspace_id,
        visibility=kb.visibility,
        created_at=kb.created_at,
        updated_at=kb.updated_at,
    )


@router.put("/{kb_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base(
    kb_id: str,
    kb_data: KnowledgeBaseUpdate,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Update knowledge base"""
    kb = await db.get(KnowledgeBase, uuid.UUID(kb_id))
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    if not await check_workspace_access(str(kb.workspace_id), user_id, db, require_write=True):
        raise HTTPException(status_code=403, detail="Write access required")

    update_data = kb_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(kb, key, value)

    await db.commit()
    await db.refresh(kb)

    return KnowledgeBaseResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        workspace_id=kb.workspace_id,
        visibility=kb.visibility,
        created_at=kb.created_at,
        updated_at=kb.updated_at,
    )


@router.delete("/{kb_id}")
async def delete_knowledge_base(
    kb_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete knowledge base"""
    kb = await db.get(KnowledgeBase, uuid.UUID(kb_id))
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    if not await check_workspace_access(str(kb.workspace_id), user_id, db, require_write=True):
        raise HTTPException(status_code=403, detail="Write access required")

    await db.delete(kb)
    await db.commit()

    return {"success": True, "message": "Knowledge base deleted"}


@router.get("/{kb_id}/documents", response_model=List[DocumentResponse])
async def list_documents(
    kb_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """List documents in a knowledge base"""
    kb = await db.get(KnowledgeBase, uuid.UUID(kb_id))
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    if not check_workspace_access(str(kb.workspace_id), user_id, db):
        raise HTTPException(status_code=403, detail="Access denied")

    query = select(Document).where(
        Document.knowledge_base_id == uuid.UUID(kb_id)
    )
    result = await db.execute(query)
    docs = result.scalars().all()

    return [
        DocumentResponse(
            id=doc.id,
            title=doc.title,
            content=doc.content,
            file_path=doc.file_path,
            file_type=doc.file_type,
            knowledge_base_id=doc.knowledge_base_id,
            chunk_count=doc.chunk_count,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
        )
        for doc in docs
    ]


@router.get("/visibility/{visibility}")
async def list_knowledge_bases_by_visibility(
    visibility: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """List knowledge bases by visibility (for cross-workspace sharing)"""
    if visibility not in ["team", "readonly"]:
        raise HTTPException(status_code=400, detail="Invalid visibility")

    query = select(KnowledgeBase).where(
        KnowledgeBase.visibility == visibility
    )
    result = await db.execute(query)
    kbs = result.scalars().all()

    accessible_kbs = []
    for kb in kbs:
        if check_workspace_access(str(kb.workspace_id), user_id, db):
            accessible_kbs.append(
                KnowledgeBaseResponse(
                    id=kb.id,
                    name=kb.name,
                    description=kb.description,
                    workspace_id=kb.workspace_id,
                    visibility=kb.visibility,
                    created_at=kb.created_at,
                    updated_at=kb.updated_at,
                )
            )

    return accessible_kbs


@router.post("/documents", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    knowledge_base_id: str = Form(...),
    user_id: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload a document to a knowledge base"""
    # Check knowledge base exists
    kb = await db.get(KnowledgeBase, uuid.UUID(knowledge_base_id))
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    # Check access
    if not check_workspace_access(str(kb.workspace_id), user_id, db, require_write=True):
        raise HTTPException(status_code=403, detail="Write access required")

    # Create uploads directory if not exists
    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)

    # Save file
    file_path = os.path.join(upload_dir, f"{uuid.uuid4()}_{file.filename}")
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    # Create document
    document = Document(
        title=file.filename,
        content=content.decode('utf-8', errors='ignore'),
        file_path=file_path,
        file_type=file.content_type,
        knowledge_base_id=uuid.UUID(knowledge_base_id),
        chunk_count=1,  # Simplified for now
    )

    db.add(document)
    await db.commit()
    await db.refresh(document)

    return DocumentResponse(
        id=document.id,
        title=document.title,
        content=document.content,
        file_path=document.file_path,
        file_type=document.file_type,
        knowledge_base_id=document.knowledge_base_id,
        chunk_count=document.chunk_count,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a document"""
    document = await db.get(Document, uuid.UUID(document_id))
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check knowledge base exists
    kb = await db.get(KnowledgeBase, document.knowledge_base_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    # Check access
    if not check_workspace_access(str(kb.workspace_id), user_id, db, require_write=True):
        raise HTTPException(status_code=403, detail="Write access required")

    # Delete file if exists
    if document.file_path and os.path.exists(document.file_path):
        os.remove(document.file_path)

    await db.delete(document)
    await db.commit()

    return {"success": True, "message": "Document deleted"}


@router.put("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    user_id: str,
    title: str,
    content: str,
    db: AsyncSession = Depends(get_db)
):
    """Update a document"""
    document = await db.get(Document, uuid.UUID(document_id))
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check knowledge base exists
    kb = await db.get(KnowledgeBase, document.knowledge_base_id)
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    # Check access
    if not check_workspace_access(str(kb.workspace_id), user_id, db, require_write=True):
        raise HTTPException(status_code=403, detail="Write access required")

    # Update document
    document.title = title
    document.content = content
    document.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(document)

    return DocumentResponse(
        id=document.id,
        title=document.title,
        content=document.content,
        file_path=document.file_path,
        file_type=document.file_type,
        knowledge_base_id=document.knowledge_base_id,
        chunk_count=document.chunk_count,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )
