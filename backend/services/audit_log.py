import json
from datetime import datetime, timezone
from typing import Optional, Any, Dict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from backend.models.project import AuditLog, generate_uuid


ACTION_TYPES = {
    "file_write": "File Write",
    "file_delete": "File Delete",
    "command_run": "Command Run",
    "git_commit": "Git Commit",
    "git_push": "Git Push",
    "github_pr_create": "GitHub PR Created",
    "permission_override": "Permission Override",
}


class AuditLogService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def log(
        self,
        project_id: str,
        action_type: str,
        description: str,
        task_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        user_initiated: bool = False,
    ) -> AuditLog:
        entry = AuditLog(
            id=generate_uuid(),
            project_id=project_id,
            task_id=task_id,
            action_type=action_type,
            description=description,
            metadata_json=json.dumps(metadata) if metadata else None,
            timestamp=datetime.now(timezone.utc),
            user_initiated=user_initiated,
        )
        self.session.add(entry)
        await self.session.commit()
        await self.session.refresh(entry)
        return entry

    async def get_paginated(
        self,
        project_id: str,
        page: int = 1,
        limit: int = 50,
        action_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        stmt = (
            select(AuditLog)
            .where(AuditLog.project_id == project_id)
            .order_by(AuditLog.timestamp.desc())
        )
        if action_type:
            stmt = stmt.where(AuditLog.action_type == action_type)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.session.execute(count_stmt)
        total = total_result.scalar() or 0

        stmt = stmt.offset((page - 1) * limit).limit(limit)
        result = await self.session.execute(stmt)
        entries = result.scalars().all()

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": max(1, -(-total // limit)),
            "entries": [
                {
                    "id": e.id,
                    "project_id": e.project_id,
                    "task_id": e.task_id,
                    "action_type": e.action_type,
                    "description": e.description,
                    "metadata": json.loads(e.metadata_json) if e.metadata_json else None,
                    "timestamp": e.timestamp.isoformat(),
                    "user_initiated": e.user_initiated,
                }
                for e in entries
            ],
        }
