import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete

from backend.database import get_db
from backend.models.project import Project, Task, TaskEvent
from backend.models.git import GitCheckpoint
from backend.schemas import (
    TaskCreateRequest,
    TaskResponse,
    TaskDetailResponse,
    TaskEventResponse,
    TaskReportResponse,
    CompiledSpec,
)
from backend.services.ai_agent import agent_manager

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(req: TaskCreateRequest, db: AsyncSession = Depends(get_db)):
    """Creates a new Task record in 'queued' status."""
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
        message=f"Task queued: {req.requirement[:80]}",
        data_json=json.dumps({"mode": req.mode or "Guided"})
    )
    db.add(init_event)

    await db.commit()
    await db.refresh(task)
    return task


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db)
):
    """List tasks, optionally filtered by project_id and status, ordered newest first."""
    query = select(Task)
    if project_id:
        query = query.where(Task.project_id == project_id)
    if status:
        query = query.where(Task.status == status)
    query = query.order_by(desc(Task.created_at))

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{task_id}", response_model=TaskDetailResponse)
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    """Returns full Task including parsed compiled_spec and all TaskEvents."""
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalars().first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found with id: {task_id}"
        )

    evt_stmt = select(TaskEvent).where(TaskEvent.task_id == task_id).order_by(TaskEvent.timestamp.asc())
    evt_res = await db.execute(evt_stmt)
    events = evt_res.scalars().all()

    spec_dict = None
    if task.compiled_spec_json:
        try:
            spec_dict = json.loads(task.compiled_spec_json)
        except Exception:
            spec_dict = None

    return TaskDetailResponse(
        id=task.id,
        project_id=task.project_id,
        requirement=task.requirement,
        compiled_spec_json=task.compiled_spec_json,
        compiled_spec=spec_dict,
        status=task.status,
        created_at=task.created_at,
        completed_at=task.completed_at,
        execution_time_seconds=task.execution_time_seconds,
        files_changed=task.files_changed,
        tests_passed=task.tests_passed,
        tests_failed=task.tests_failed,
        recovery_attempts=task.recovery_attempts,
        human_interventions=task.human_interventions,
        events=[TaskEventResponse.model_validate(e) for e in events]
    )


@router.get("/{task_id}/events", response_model=List[TaskEventResponse])
async def get_task_events(
    task_id: str,
    since: Optional[datetime] = Query(None, description="Filter events strictly newer than this timestamp"),
    db: AsyncSession = Depends(get_db)
):
    """Returns list of TaskEvents ordered by timestamp ascending."""
    task_stmt = select(Task).where(Task.id == task_id)
    task_res = await db.execute(task_stmt)
    if not task_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found with id: {task_id}"
        )

    query = select(TaskEvent).where(TaskEvent.task_id == task_id)
    if since:
        query = query.where(TaskEvent.timestamp > since)
    query = query.order_by(TaskEvent.timestamp.asc())

    result = await db.execute(query)
    return result.scalars().all()


@router.delete("/{task_id}")
async def delete_task(task_id: str, db: AsyncSession = Depends(get_db)):
    """Deletes a queued, failed, completed or stopped task. Rejects executing tasks."""
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalars().first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found with id: {task_id}"
        )

    executing_statuses = {"executing", "running", "planning", "recovering", "testing", "waiting_approval"}
    if task.status.lower() in executing_statuses or task_id in agent_manager.active_tasks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete executing tasks. Please stop the task first."
        )

    await db.delete(task)
    await db.commit()
    return {"status": "deleted", "task_id": task_id, "message": "Task deleted successfully"}


@router.post("/{task_id}/retry", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def retry_task(task_id: str, db: AsyncSession = Depends(get_db)):
    """Re-runs a failed task with the same compiled_spec. Marks old task as superseded and returns new Task."""
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    old_task = result.scalars().first()

    if not old_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found with id: {task_id}"
        )

    executing_statuses = {"executing", "running", "planning", "recovering", "testing", "waiting_approval"}
    if old_task.status.lower() in executing_statuses or task_id in agent_manager.active_tasks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot retry an executing task. Wait or stop it first."
        )

    now = datetime.now(timezone.utc)
    old_task.status = "superseded"

    new_task = Task(
        project_id=old_task.project_id,
        requirement=old_task.requirement,
        compiled_spec_json=old_task.compiled_spec_json,
        status="queued",
        created_at=now
    )
    db.add(new_task)
    await db.flush()

    init_event = TaskEvent(
        task_id=new_task.id,
        timestamp=now,
        event_type="TASK_CREATED",
        message=f"Retried task from {task_id}: {old_task.requirement[:80]}",
        data_json=json.dumps({"retried_from_task_id": task_id})
    )
    db.add(init_event)

    await db.commit()
    await db.refresh(new_task)
    return new_task


@router.get("/{task_id}/report", response_model=TaskReportResponse)
async def get_task_report(task_id: str, db: AsyncSession = Depends(get_db)):
    """Returns full execution summary for a task including phases, reports, checkpoints and metrics."""
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalars().first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found with id: {task_id}"
        )

    evt_stmt = select(TaskEvent).where(TaskEvent.task_id == task_id).order_by(TaskEvent.timestamp.asc())
    evt_res = await db.execute(evt_stmt)
    events = evt_res.scalars().all()
    event_responses = [TaskEventResponse.model_validate(e) for e in events]

    phases: Dict[str, List[TaskEventResponse]] = {
        "Planning": [],
        "Executing": [],
        "Verifying": [],
        "Recovery": []
    }

    files_modified_set = set()
    verification_dict = None

    # Check in-memory verification report first
    v_report = agent_manager.get_verification_report(task_id)
    if v_report:
        try:
            verification_dict = v_report.model_dump(mode="json")
        except Exception:
            verification_dict = None

    state = agent_manager.get_state(task_id)
    if state and state.files_modified:
        files_modified_set.update(state.files_modified)

    for e in event_responses:
        etype = (e.event_type or "").lower()
        if "plan" in etype or etype in {"planning_start", "planning_complete", "plan_created"}:
            phases["Planning"].append(e)
        elif "verif" in etype or etype in {"verification_start", "verification_run", "verification_results"}:
            phases["Verifying"].append(e)
            if not verification_dict and e.data_json:
                try:
                    d = json.loads(e.data_json)
                    if "checks" in d or "summary" in d or "passed" in d:
                        verification_dict = d
                except Exception:
                    pass
        elif "recover" in etype:
            phases["Recovery"].append(e)
        else:
            phases["Executing"].append(e)

        if e.data_json:
            try:
                data = json.loads(e.data_json)
                if isinstance(data, dict):
                    if "files_modified" in data and isinstance(data["files_modified"], list):
                        files_modified_set.update(data["files_modified"])
                    tool_args = data.get("tool_args") or data.get("args")
                    tool_name = data.get("tool") or ""
                    if tool_name in {"write_file", "create_file", "delete_file"} and isinstance(tool_args, dict):
                        p = tool_args.get("path")
                        if p:
                            files_modified_set.add(p)
            except Exception:
                pass

    # Query Git checkpoint
    git_checkpoint_dict = None
    chk_stmt = select(GitCheckpoint).where(GitCheckpoint.task_id == task_id).order_by(desc(GitCheckpoint.created_at))
    chk_res = await db.execute(chk_stmt)
    chk = chk_res.scalars().first()
    if chk:
        git_checkpoint_dict = {
            "id": chk.id,
            "commit_hash": chk.commit_hash,
            "branch": chk.branch,
            "message": chk.message,
            "author": chk.author,
            "type": chk.type,
            "files_changed": chk.files_changed,
            "created_at": chk.created_at.isoformat() if chk.created_at else None
        }

    exec_time = task.execution_time_seconds
    if exec_time is None and task.completed_at and task.created_at:
        exec_time = max(0.0, (task.completed_at - task.created_at).total_seconds())

    metrics = {
        "execution_time_seconds": exec_time or 0.0,
        "files_changed": task.files_changed or len(files_modified_set),
        "tests_passed": task.tests_passed,
        "tests_failed": task.tests_failed,
        "recovery_attempts": task.recovery_attempts,
        "human_interventions": task.human_interventions
    }

    return TaskReportResponse(
        task_id=task.id,
        requirement=task.requirement,
        status=task.status,
        phases=phases,
        verification_report=verification_dict,
        git_checkpoint=git_checkpoint_dict,
        files_modified=sorted(list(files_modified_set)),
        metrics=metrics
    )


@router.get("/{task_id}/spec", response_model=CompiledSpec)
async def get_task_spec(task_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieves compiled spec for a task."""
    stmt = select(Task).where(Task.id == task_id)
    result = await db.execute(stmt)
    task = result.scalars().first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found with id: {task_id}",
        )

    if not task.compiled_spec_json:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Compiled spec not found for task: {task_id}",
        )

    try:
        spec = CompiledSpec.model_validate_json(task.compiled_spec_json)
        spec.task_id = task.id
        return spec
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse stored compiled spec: {str(e)}",
        )

