from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database import get_db
from backend.models.git import GitCheckpoint
from backend.models.project import Project
from backend.schemas import (
    GitStatusResponse,
    GitCheckpointRequest,
    GitCheckpointResponse,
    GitRollbackRequest,
    GitRollbackResponse
)
from backend.services.git_service import git_service

router = APIRouter(prefix="/git", tags=["git"])

@router.get("/status", response_model=GitStatusResponse)
async def get_git_status(project_path: str = Query(..., description="Project folder path")):
    try:
        status_info = git_service.get_status(project_path)
        return GitStatusResponse(**status_info)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read git status: {str(e)}"
        )

@router.post("/checkpoint", response_model=GitCheckpointResponse)
async def create_checkpoint(req: GitCheckpointRequest, db: AsyncSession = Depends(get_db)):
    # Verify project exists
    stmt = select(Project).where(Project.id == req.project_id)
    result = await db.execute(stmt)
    project = result.scalars().first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {req.project_id}"
        )

    try:
        res = git_service.create_checkpoint(
            project_path=req.project_path,
            message=req.message,
            author_name=req.author or "AutonomousDev Agent"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    checkpoint = GitCheckpoint(
        project_id=req.project_id,
        commit_hash=res["commit_hash"],
        branch=res["branch"],
        message=req.message,
        author=req.author or "AutonomousDev Agent",
        type=req.type or "ai_post_change",
        files_changed=res["files_changed"],
        created_at=datetime.now(timezone.utc)
    )
    db.add(checkpoint)
    await db.commit()
    await db.refresh(checkpoint)
    return checkpoint

@router.post("/rollback", response_model=GitRollbackResponse)
async def rollback_checkpoint(req: GitRollbackRequest):
    try:
        res = git_service.rollback(
            project_path=req.project_path,
            commit_hash=req.commit_hash
        )
        return GitRollbackResponse(**res)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/checkpoints", response_model=List[GitCheckpointResponse])
async def list_checkpoints(
    project_id: Optional[str] = Query(None, description="Project ID"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(GitCheckpoint)
    if project_id:
        stmt = stmt.where(GitCheckpoint.project_id == project_id)
    stmt = stmt.order_by(GitCheckpoint.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/diff")
async def get_git_diff(
    project_path: str = Query(..., description="Project folder path"),
    file_path: Optional[str] = Query(None, description="Specific file path")
):
    diff = git_service.get_diff(project_path, file_path)
    return {
        "project_path": project_path,
        "file_path": file_path,
        "diff": diff
    }
