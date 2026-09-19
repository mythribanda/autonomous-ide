import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database import get_db, AsyncSessionLocal
from backend.models.project import Task, Project
from backend.schemas import (
    AgentExecuteRequest,
    AgentStopRequest,
    AgentStatusResponse,
    AgentCompileRequest,
    CompiledSpec,
    AgentState,
    AgentStatus,
    ImpactReport,
    VerificationReport,
)
from backend.services.ai_agent import agent_manager
from backend.services.prompt_compiler import prompt_compiler
from backend.services.knowledge_graph import knowledge_graph
from backend.services.impact_analyzer import impact_analyzer
from backend.services.verification import VerificationService
from backend.routers.projects import _get_or_build_knowledge_graph

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/compile", response_model=CompiledSpec)
async def compile_agent_requirement(
    req: AgentCompileRequest,
    db: AsyncSession = Depends(get_db),
) -> CompiledSpec:
    # 1. Verify project exists
    stmt = select(Project).where(Project.id == req.project_id)
    result = await db.execute(stmt)
    project = result.scalars().first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {req.project_id}",
        )

    # 2. Manage Task lifecycle: create or update to status="planning"
    task = None
    if req.task_id:
        stmt_task = select(Task).where(Task.id == req.task_id)
        res_task = await db.execute(stmt_task)
        task = res_task.scalars().first()

    now = datetime.now(timezone.utc)
    if not task:
        task = Task(
            project_id=project.id,
            requirement=req.requirement,
            status="planning",
            created_at=now,
        )
        db.add(task)
        await db.flush()
    else:
        task.status = "planning"

    await db.commit()
    await db.refresh(task)
    task_id = task.id

    # 3. Retrieve or build knowledge graph
    graph = await _get_or_build_knowledge_graph(project, db)

    # 4. Context retrieval
    relevant_context = knowledge_graph.get_relevant_context(
        requirement=req.requirement,
        graph=graph,
        max_files=8,
        project_path=project.path,
    )

    # 5. Impact analysis
    impact_report = impact_analyzer.analyze_impact(
        requirement=req.requirement,
        relevant_files=relevant_context,
        graph=graph,
        project_path=project.path,
    )

    # 6. Execute Inline Prompt Compilation
    spec = await prompt_compiler.compile(
        raw_requirement=req.requirement,
        project_summary=graph.summary,
        relevant_context=relevant_context,
        impact_report=impact_report,
        task_id=task_id,
    )

    # 7. Update task lifecycle: status="waiting_approval" and store compiled spec
    task.status = "waiting_approval"
    task.compiled_spec_json = spec.model_dump_json()
    await db.commit()

    spec.task_id = task.id
    return spec


@router.post("/compile/stream")
async def compile_agent_requirement_stream(
    req: AgentCompileRequest,
    db: AsyncSession = Depends(get_db),
):
    # 1. Verify project exists
    stmt = select(Project).where(Project.id == req.project_id)
    result = await db.execute(stmt)
    project = result.scalars().first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {req.project_id}",
        )

    # 2. Manage Task lifecycle: create or update to status="planning"
    task = None
    if req.task_id:
        stmt_task = select(Task).where(Task.id == req.task_id)
        res_task = await db.execute(stmt_task)
        task = res_task.scalars().first()

    now = datetime.now(timezone.utc)
    if not task:
        task = Task(
            project_id=project.id,
            requirement=req.requirement,
            status="planning",
            created_at=now,
        )
        db.add(task)
        await db.flush()
    else:
        task.status = "planning"

    await db.commit()
    await db.refresh(task)
    task_id = task.id

    # 3. Retrieve or build knowledge graph
    graph = await _get_or_build_knowledge_graph(project, db)

    # 4. Context retrieval
    relevant_context = knowledge_graph.get_relevant_context(
        requirement=req.requirement,
        graph=graph,
        max_files=8,
        project_path=project.path,
    )

    # 5. Impact analysis
    impact_report = impact_analyzer.analyze_impact(
        requirement=req.requirement,
        relevant_files=relevant_context,
        graph=graph,
        project_path=project.path,
    )

    # 6. Stream SSE events via Queue
    queue: asyncio.Queue = asyncio.Queue()

    async def run_compilation():
        try:
            async def on_event(ev: Dict[str, Any]):
                await queue.put(ev)

            spec = await prompt_compiler.compile(
                raw_requirement=req.requirement,
                project_summary=graph.summary,
                relevant_context=relevant_context,
                impact_report=impact_report,
                task_id=task_id,
                event_callback=on_event,
            )

            # Update task in DB with separate session
            async with AsyncSessionLocal() as session:
                t_stmt = select(Task).where(Task.id == task_id)
                t_res = await session.execute(t_stmt)
                t = t_res.scalars().first()
                if t:
                    t.status = "waiting_approval"
                    t.compiled_spec_json = spec.model_dump_json()
                    await session.commit()
        except Exception as e:
            logger.error(f"Error during streaming compilation: {e}")
            await queue.put({
                "type": "compiler_step",
                "step": "error",
                "status": "error",
                "error": str(e),
            })
        finally:
            await queue.put(None)

    asyncio.create_task(run_compilation())

    async def event_generator():
        while True:
            ev = await queue.get()
            if ev is None:
                break
            yield f"data: {json.dumps(ev)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
    task.status = "cancelled" if stopped else "failed"
    await db.commit()

    return AgentStatusResponse(
        task_id=task.id,
        status="stopped",
        progress=0.0,
        current_activity="Task execution was halted"
    )

@router.post("/{task_id}/approve")
async def approve_agent_step(task_id: str):
    approved = await agent_manager.approve_step(task_id)
    return {"task_id": task_id, "approved": approved}

@router.post("/{task_id}/stop")
async def stop_agent_by_id(task_id: str, db: AsyncSession = Depends(get_db)):
    stopped = await agent_manager.stop_execution(task_id)
    stmt = select(Task).where(Task.id == task_id)
    res = await db.execute(stmt)
    t = res.scalars().first()
    if t:
        t.status = "cancelled"
        await db.commit()
    return {"task_id": task_id, "status": "cancelled", "stopped": stopped}

@router.post("/{task_id}/pause")
async def pause_agent_by_id(task_id: str):
    paused = await agent_manager.pause_execution(task_id)
    return {"task_id": task_id, "status": "paused", "paused": paused}

@router.post("/{task_id}/resume")
async def resume_agent_by_id(task_id: str):
    resumed = await agent_manager.resume_execution(task_id)
    return {"task_id": task_id, "status": "executing", "resumed": resumed}

@router.get("/status", response_model=AgentStatusResponse)
async def get_agent_status(task_id: str = Query(..., description="ID of task to check")):
    state = agent_manager.get_status(task_id)
    return AgentStatusResponse(
        task_id=task_id,
        status=state.get("status", "idle"),
        progress=state.get("progress", 0.0),
        current_activity=state.get("current_activity")
    )

@router.get("/{task_id}/status", response_model=AgentState)
async def get_agent_state_by_id(task_id: str, db: AsyncSession = Depends(get_db)):
    state = agent_manager.get_state(task_id)
    if state:
        return state

    stmt = select(Task).where(Task.id == task_id)
    res = await db.execute(stmt)
    task = res.scalars().first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found with id: {task_id}"
        )

    if task.compiled_spec_json:
        spec = CompiledSpec.model_validate_json(task.compiled_spec_json)
    else:
        spec = CompiledSpec(
            task_id=task.id,
            raw_requirement=task.requirement,
            intent=task.requirement,
            intent_category="feature_add",
            scope="project",
            impact_report=ImpactReport(),
            confidence_score=0.8
        )

    return AgentState(
        task_id=task.id,
        project_id=task.project_id,
        compiled_spec=spec,
        status=AgentStatus(task.status) if task.status in [s.value for s in AgentStatus] else AgentStatus.QUEUED
    )


@router.post("/{task_id}/verify", response_model=VerificationReport)
async def verify_agent_task(task_id: str, db: AsyncSession = Depends(get_db)):
    state = agent_manager.get_state(task_id)
    workspace_path = "."
    if not state:
        stmt = select(Task).where(Task.id == task_id)
        res = await db.execute(stmt)
        task = res.scalars().first()
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task not found with id: {task_id}"
            )

        p_stmt = select(Project).where(Project.id == task.project_id)
        p_res = await db.execute(p_stmt)
        project = p_res.scalars().first()
        if project:
            workspace_path = project.path

        if task.compiled_spec_json:
            spec = CompiledSpec.model_validate_json(task.compiled_spec_json)
        else:
            spec = CompiledSpec(
                task_id=task.id,
                raw_requirement=task.requirement,
                intent=task.requirement,
                intent_category="feature_add",
                scope="project",
                impact_report=ImpactReport(),
                confidence_score=0.8
            )

        state = AgentState(
            task_id=task.id,
            project_id=task.project_id,
            compiled_spec=spec,
            status=AgentStatus(task.status) if task.status in [s.value for s in AgentStatus] else AgentStatus.QUEUED
        )
    else:
        p_stmt = select(Project).where(Project.id == state.project_id)
        p_res = await db.execute(p_stmt)
        project = p_res.scalars().first()
        if project:
            workspace_path = project.path

    report = await VerificationService.verify(state, workspace_path=workspace_path)
    agent_manager.set_verification_report(task_id, report)
    return report


@router.get("/{task_id}/verification", response_model=VerificationReport)
async def get_verification_report_by_id(task_id: str, db: AsyncSession = Depends(get_db)):
    report = agent_manager.get_verification_report(task_id)
    if report:
        return report

    # If no report stored, generate and store
    return await verify_agent_task(task_id, db)


