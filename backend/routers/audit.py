from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.services.audit_log import AuditLogService
from backend.models.project import Project
from sqlalchemy import select

router = APIRouter(prefix="/projects", tags=["audit"])


@router.get("/{project_id}/audit-log")
async def get_audit_log(
    project_id: str,
    page: int = 1,
    limit: int = 50,
    action_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    # Verify project exists
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    svc = AuditLogService(db)
    return await svc.get_paginated(project_id, page=page, limit=min(limit, 200), action_type=action_type)
