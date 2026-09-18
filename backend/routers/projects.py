from pathlib import Path
from typing import List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from backend.database import get_db
from backend.models.project import Project
from backend.schemas import ProjectOpenRequest, ProjectResponse
from backend.services.project_scanner import scan_project_metadata

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("/open", response_model=ProjectResponse)
async def open_project(req: ProjectOpenRequest, db: AsyncSession = Depends(get_db)):
    project_path = str(Path(req.path).resolve())
    folder_path = Path(project_path)

    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project directory does not exist: {req.path}"
        )

    # Detect language and framework
    metadata = scan_project_metadata(project_path)
    name = req.name or folder_path.name or "Untitled Project"

    # Check if project already registered
    stmt = select(Project).where(Project.path == project_path)
    result = await db.execute(stmt)
    project = result.scalars().first()

    now = datetime.now(timezone.utc)

    if project:
        project.last_opened = now
        project.name = name
        project.language = metadata.get("language")
        project.framework = metadata.get("framework")
    else:
        project = Project(
            name=name,
            path=project_path,
            language=metadata.get("language"),
            framework=metadata.get("framework"),
            last_opened=now,
            created_at=now
        )
        db.add(project)

    await db.commit()
    await db.refresh(project)
    return project

@router.get("/recent", response_model=List[ProjectResponse])
async def get_recent_projects(limit: int = 10, db: AsyncSession = Depends(get_db)):
    stmt = select(Project).order_by(desc(Project.last_opened)).limit(limit)
    result = await db.execute(stmt)
    projects = result.scalars().all()
    return projects

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Project).where(Project.id == project_id)
    result = await db.execute(stmt)
    project = result.scalars().first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {project_id}"
        )
    return project
