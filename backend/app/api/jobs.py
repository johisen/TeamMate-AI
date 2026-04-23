from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid

from app.core.database import get_db
from app.models.models import Job, Department

router = APIRouter()


class JobCreate(BaseModel):
    name: str
    department_id: str
    description: Optional[str] = None


class JobUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[str] = None
    description: Optional[str] = None


@router.post("/jobs", response_model=dict)
async def create_job(
    job_data: JobCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new job"""
    try:
        # Verify department exists
        department = await db.get(Department, uuid.UUID(job_data.department_id))
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")

        job = Job(
            name=job_data.name,
            department_id=uuid.UUID(job_data.department_id),
            description=job_data.description,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)

        return {
            "id": job.id,
            "name": job.name,
            "department_id": job.department_id,
            "description": job.description,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/jobs", response_model=List[dict])
async def list_jobs(
    department_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all jobs"""
    try:
        from sqlalchemy import select
        stmt = select(Job)
        if department_id:
            stmt = stmt.filter(Job.department_id == uuid.UUID(department_id))

        result = await db.execute(stmt)
        jobs = result.scalars().all()

        return [
            {
                "id": job.id,
                "name": job.name,
                "department_id": job.department_id,
                "description": job.description,
                "created_at": job.created_at,
                "updated_at": job.updated_at,
            }
            for job in jobs
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/jobs/{job_id}", response_model=dict)
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get job by ID"""
    job = await db.get(Job, uuid.UUID(job_id))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "id": job.id,
        "name": job.name,
        "department_id": job.department_id,
        "description": job.description,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


@router.put("/jobs/{job_id}", response_model=dict)
async def update_job(
    job_id: str,
    job_data: JobUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a job"""
    job = await db.get(Job, uuid.UUID(job_id))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job_data.department_id:
        # Verify department exists
        department = await db.get(Department, uuid.UUID(job_data.department_id))
        if not department:
            raise HTTPException(status_code=404, detail="Department not found")
        job.department_id = uuid.UUID(job_data.department_id)
    if job_data.name is not None:
        job.name = job_data.name
    if job_data.description is not None:
        job.description = job_data.description

    await db.commit()
    await db.refresh(job)

    return {
        "id": job.id,
        "name": job.name,
        "department_id": job.department_id,
        "description": job.description,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


@router.delete("/jobs/{job_id}")
async def delete_job(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a job"""
    job = await db.get(Job, uuid.UUID(job_id))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await db.delete(job)
    await db.commit()

    return {"message": "Job deleted successfully"}