from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.core.database import get_db
from app.models.models import Department

router = APIRouter()


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    workspace_id: Optional[str] = "00000000-0000-0000-0000-000000000001"


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.post("/departments", response_model=dict)
async def create_department(
    dept_data: DepartmentCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new department"""
    try:
        department = Department(
            name=dept_data.name,
            description=dept_data.description,
            workspace_id=uuid.UUID(dept_data.workspace_id),
        )
        db.add(department)
        await db.commit()
        await db.refresh(department)

        return {
            "id": department.id,
            "name": department.name,
            "description": department.description,
            "workspace_id": department.workspace_id,
            "created_at": department.created_at,
            "updated_at": department.updated_at,
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/departments", response_model=List[dict])
async def list_departments(
    workspace_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all departments"""
    try:
        from sqlalchemy import select
        stmt = select(Department)
        if workspace_id:
            stmt = stmt.filter(Department.workspace_id == uuid.UUID(workspace_id))

        result = await db.execute(stmt)
        departments = result.scalars().all()

        return [
            {
                "id": dept.id,
                "name": dept.name,
                "description": dept.description,
                "workspace_id": dept.workspace_id,
                "created_at": dept.created_at,
                "updated_at": dept.updated_at,
                "order": idx,
            }
            for idx, dept in enumerate(departments)
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/departments/{department_id}", response_model=dict)
async def get_department(
    department_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get department by ID"""
    department = await db.get(Department, uuid.UUID(department_id))
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    return {
        "id": department.id,
        "name": department.name,
        "description": department.description,
        "workspace_id": department.workspace_id,
        "created_at": department.created_at,
        "updated_at": department.updated_at,
    }


@router.put("/departments/{department_id}", response_model=dict)
async def update_department(
    department_id: str,
    dept_data: DepartmentUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a department"""
    department = await db.get(Department, uuid.UUID(department_id))
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    if dept_data.name is not None:
        department.name = dept_data.name
    if dept_data.description is not None:
        department.description = dept_data.description

    await db.commit()
    await db.refresh(department)

    return {
        "id": department.id,
        "name": department.name,
        "description": department.description,
        "workspace_id": department.workspace_id,
        "created_at": department.created_at,
        "updated_at": department.updated_at,
    }


@router.delete("/departments/{department_id}")
async def delete_department(
    department_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a department"""
    department = await db.get(Department, uuid.UUID(department_id))
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    await db.delete(department)
    await db.commit()

    return {"message": "Department deleted successfully"}