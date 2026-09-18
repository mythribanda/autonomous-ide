from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database import get_db
from backend.models.project import Task
from backend.schemas import AgentExecuteRequest, AgentStopRequest, AgentStatusResponse
from backend.services.ai_agent import agent_manager

router = APIRouter(prefix="/agent", tags=["agent"])

@router.post("/execute", response_model=AgentStatusResponse)
async def execute_agent(req: AgentExecuteRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == req.task_id)
    result = await db.execute(stmt)
    task = result.scalars().first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found with id: {req.task_id}"
        )

    task.status = "executing"
    await db.commit()

    await agent_manager.start_execution(
        task_id=task.id,
        requirement=task.requirement,
        autonomy_level=req.autonomy_level or "autonomous"
    )

    state = agent_manager.get_status(task.id)
    return AgentStatusResponse(
        task_id=task.id,
        status=state.get("status", "executing"),
        progress=state.get("progress", 0.0),
        current_activity=state.get("current_activity")
    )

@router.post("/stop", response_model=AgentStatusResponse)
async def stop_agent(req: AgentStopRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Task).where(Task.id == req.task_id)
    result = await db.execute(stmt)
    task = result.scalars().first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found with id: {req.task_id}"
        )

    stopped = await agent_manager.stop_execution(task.id)
    task.status = "failed" if not stopped else "queued"
    await db.commit()

    return AgentStatusResponse(
        task_id=task.id,
        status="stopped",
        progress=0.0,
        current_activity="Task execution was halted"
    )

@router.get("/status", response_model=AgentStatusResponse)
async def get_agent_status(task_id: str = Query(..., description="ID of task to check")):
    state = agent_manager.get_status(task_id)
    return AgentStatusResponse(
        task_id=task_id,
        status=state.get("status", "idle"),
        progress=state.get("progress", 0.0),
        current_activity=state.get("current_activity")
    )
