from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database import get_db
from backend.models.project import Project, Task, TaskEvent
from backend.schemas import TaskCreateRequest, TaskResponse, TaskEventResponse

router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(req: TaskCreateRequest, db: AsyncSession = Depends(get_db)):
    # Verify project exists
    stmt = select(Project).where(Project.id == req.project_id)
    result = await db.execute(stmt)
    project = result.scalars().first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {req.project_id}"
        )

    now = datetime.now(timezone.utc)
    task = Task(
        project_id=req.project_id,
        requirement=req.requirement,
        compiled_spec_json=req.compiled_spec_json,
        status="queued",
        created_at=now
    )
    db.add(task)
    await db.flush()

    # Create initial TaskEvent
    init_event = TaskEvent(
        task_id=task.id,
        timestamp=now,
        event_type="TASK_CREATED",
        message=f"Task registered: {req.requirement[:80]}",
        data_json=None
    )
    db.add(init_event)

    await db.commit()
    await db.refresh(task)
    return task

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalars().first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found with id: {task_id}"
        )
    return task

@router.get("/{task_id}/events", response_model=List[TaskEventResponse])
async def get_task_events(task_id: str, db: AsyncSession = Depends(get_db)):
    # Check task existence
    task_stmt = select(Task).where(Task.id == task_id)
    task_res = await db.execute(task_stmt)
    if not task_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found with id: {task_id}"
        )

    stmt = select(TaskEvent).where(TaskEvent.task_id == task_id).order_by(TaskEvent.timestamp.asc())
    result = await db.execute(stmt)
    events = result.scalars().all()
    return events
