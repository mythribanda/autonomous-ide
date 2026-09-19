from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database import get_db
from backend.models.git import GitCheckpoint
from backend.models.project import Project
from backend.schemas import (
    GitStatus,
    GitStatusResponse,
    CheckpointResult,
    GitCheckpointRequest,
    GitCheckpointResponse,
    GitCheckpointCreateBody,
    GitRollbackRequest,
    GitRollbackResponse,
    GitRollbackBody,
    RollbackResult,
    FileDiff,
    GitLogEntry,
    GitBranchCreateRequest,
)
from backend.services.git_service import git_service

router = APIRouter(prefix="/git", tags=["git"])


async def _resolve_project_or_404(project_id: str, db: AsyncSession) -> Project:
    stmt = select(Project).where(Project.id == project_id)
    result = await db.execute(stmt)
    project = result.scalars().first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {project_id}"
        )
    return project


# ===================================================================
# 1. Project-scoped endpoints as requested
# ===================================================================

@router.get("/{project_id}/status", response_model=GitStatus)
async def get_project_git_status(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Returns repository status for the specified project."""
    project = await _resolve_project_or_404(project_id, db)
    return await git_service.get_status(project.path)


@router.post("/{project_id}/checkpoint", response_model=CheckpointResult)
async def create_project_checkpoint(
    project_id: str,
    body: GitCheckpointCreateBody,
    db: AsyncSession = Depends(get_db)
):
    """Creates a new git checkpoint commit for the project."""
    project = await _resolve_project_or_404(project_id, db)
    return await git_service.create_checkpoint(
        repo_path=project.path,
        message=body.message,
        project_id=project.id,
        task_id=body.task_id
    )


@router.get("/{project_id}/diff")
async def get_project_diff(
    project_id: str,
    file: Optional[str] = Query(None, description="Specific file path relative to repo"),
    db: AsyncSession = Depends(get_db)
):
    """Returns diff text or file diff details for changes in the project."""
    project = await _resolve_project_or_404(project_id, db)
    if file:
        file_diff = await git_service.get_file_diff(project.path, file)
        return {
            "project_id": project_id,
            "file": file,
            "diff": file_diff.diff_text,
            "details": file_diff.model_dump(),
            "original": file_diff.old_content or "",
            "modified": file_diff.new_content or "",
            "lines_added": file_diff.lines_added,
            "lines_removed": file_diff.lines_removed,
        }
    diff_text = await git_service.get_diff(project.path)
    return {
        "project_id": project_id,
        "file": None,
        "diff": diff_text
    }


class GitRevertFileBody(BaseModel):
    file: Optional[str] = None


@router.post("/{project_id}/revert-file")
@router.post("/{project_id}/revert")
async def revert_project_file(
    project_id: str,
    body: Optional[GitRevertFileBody] = None,
    file: Optional[str] = Query(None, description="Specific file path to revert"),
    db: AsyncSession = Depends(get_db)
):
    """Restores a file to its git HEAD state."""
    project = await _resolve_project_or_404(project_id, db)
    target_file = (body.file if body and body.file else None) or file
    if not target_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File path required to revert"
        )
    success = await git_service.revert_file(project.path, target_file)
    return {"success": success, "file": target_file}


@router.post("/{project_id}/rollback", response_model=RollbackResult)
async def rollback_project_checkpoint(
    project_id: str,
    body: GitRollbackBody,
    db: AsyncSession = Depends(get_db)
):
    """Rolls back the project repository to a specified checkpoint commit."""
    project = await _resolve_project_or_404(project_id, db)
    res = await git_service.rollback_to_checkpoint(
        repo_path=project.path,
        commit_hash=body.commit_hash,
        project_id=project.id
    )
    if not res.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res.message
        )
    return res


@router.get("/{project_id}/checkpoints", response_model=List[GitCheckpointResponse])
async def get_project_checkpoints(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Queries DB for all GitCheckpoint records for this project, newest first."""
    await _resolve_project_or_404(project_id, db)
    records = await git_service.get_checkpoints(project_id)
    return [GitCheckpointResponse.model_validate(r) for r in records]


@router.get("/{project_id}/log", response_model=List[GitLogEntry])
async def get_project_log(
    project_id: str,
    max_entries: int = Query(20, description="Max entries to return"),
    db: AsyncSession = Depends(get_db)
):
    """Returns the git commit history log for the project."""
    project = await _resolve_project_or_404(project_id, db)
    return await git_service.get_log(project.path, max_entries=max_entries)


@router.get("/{project_id}/branches", response_model=List[str])
async def get_project_branches(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Lists branch names in the project repository."""
    project = await _resolve_project_or_404(project_id, db)
    return await git_service.get_branches(project.path)


@router.post("/{project_id}/branch")
async def create_project_branch(
    project_id: str,
    body: GitBranchCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Creates a new branch in the project repository."""
    project = await _resolve_project_or_404(project_id, db)
    try:
        created = await git_service.create_branch(project.path, body.name)
        return {"success": created, "branch": body.name}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


class GitBranchSwitchRequest(BaseModel):
    name: str


@router.post("/{project_id}/switch-branch")
async def switch_project_branch(
    project_id: str,
    body: GitBranchSwitchRequest,
    db: AsyncSession = Depends(get_db)
):
    """Switches the working directory to the specified git branch."""
    project = await _resolve_project_or_404(project_id, db)
    try:
        ok = await git_service.switch_branch(project.path, body.name)
        return {"success": ok, "branch": body.name}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )



# ===================================================================
# 2. Legacy / Compatibility Routes (used by existing UI & services)
# ===================================================================

@router.get("/status", response_model=GitStatusResponse)
async def get_git_status_legacy(project_path: str = Query(..., description="Project folder path")):
    try:
        status_info = await git_service.get_status(project_path)
        return GitStatusResponse(
            project_path=project_path,
            branch=status_info.branch,
            is_clean=status_info.is_clean,
            modified_files=status_info.modified_files,
            untracked_files=status_info.untracked_files,
            staged_files=status_info.staged_files or [],
            added_files=status_info.added_files,
            deleted_files=status_info.deleted_files,
            ahead_by=status_info.ahead_by,
            behind_by=status_info.behind_by,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read git status: {str(e)}"
        )


@router.post("/checkpoint", response_model=GitCheckpointResponse)
async def create_checkpoint_legacy(req: GitCheckpointRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Project).where(Project.id == req.project_id)
    result = await db.execute(stmt)
    project = result.scalars().first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {req.project_id}"
        )

    try:
        res = await git_service.create_checkpoint(
            repo_path=req.project_path,
            message=req.message,
            project_id=req.project_id,
            task_id=req.task_id,
            author_name=req.author or "AutonomousDev Agent"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    # Fetch the checkpoint record from DB or create representation
    if res.id:
        stmt_chk = select(GitCheckpoint).where(GitCheckpoint.id == res.id)
        r_chk = await db.execute(stmt_chk)
        c = r_chk.scalars().first()
        if c:
            return GitCheckpointResponse.model_validate(c)

    return GitCheckpointResponse(
        id=res.id or "temp-id",
        commit_hash=res.commit_hash,
        branch=res.branch or "main",
        message=req.message,
        author=req.author or "AutonomousDev Agent",
        type=req.type or "ai_post_change",
        files_changed=res.files_staged,
        created_at=datetime.now(timezone.utc),
        task_id=req.task_id,
        is_autonomous=True
    )


@router.post("/rollback", response_model=GitRollbackResponse)
async def rollback_checkpoint_legacy(req: GitRollbackRequest):
    try:
        res = await git_service.rollback_to_checkpoint(
            repo_path=req.project_path,
            commit_hash=req.commit_hash
        )
        return GitRollbackResponse(
            success=res.success,
            message=res.message,
            current_commit=req.commit_hash,
            files_restored=res.files_restored
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/checkpoints", response_model=List[GitCheckpointResponse])
async def list_checkpoints_legacy(
    project_id: Optional[str] = Query(None, description="Project ID"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(GitCheckpoint)
    if project_id:
        stmt = stmt.where(GitCheckpoint.project_id == project_id)
    stmt = stmt.order_by(GitCheckpoint.created_at.desc())
    result = await db.execute(stmt)
    records = result.scalars().all()
    return [GitCheckpointResponse.model_validate(r) for r in records]


@router.get("/diff")
async def get_git_diff_legacy(
    project_path: str = Query(..., description="Project folder path"),
    file_path: Optional[str] = Query(None, description="Specific file path")
):
    diff = await git_service.get_diff(project_path, file_path)
    return {
        "project_path": project_path,
        "file_path": file_path,
        "diff": diff
    }
