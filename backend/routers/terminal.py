import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select, insert
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db, AsyncSessionLocal
from backend.schemas import (
    TerminalExecuteRequest,
    TerminalExecuteResponse,
    TerminalHistoryItem,
    PermissionLevel,
    AgentPermissionConfig,
    CommandClassification,
)
from backend.services.permission_service import PermissionService

router = APIRouter(prefix="/terminal", tags=["terminal"])

_permission_svc = PermissionService()

# ---------------------------------------------------------------------------
# Lazily import TaskEvent model (avoid circular import at module load)
# ---------------------------------------------------------------------------
def _get_task_event_model():
    from backend.routers.tasks import TaskEvent  # type: ignore
    return TaskEvent


# ---------------------------------------------------------------------------
# POST /api/terminal/execute
# ---------------------------------------------------------------------------
@router.post("/execute", response_model=TerminalExecuteResponse)
async def execute_terminal(req: TerminalExecuteRequest):
    """
    Execute a shell command, optionally checking permissions.
    Stores a history record in TaskEvent (event_type='terminal_command').
    """
    # --- 1. Resolve cwd ---
    cwd_str: Optional[str] = None
    if req.cwd:
        cwd_path = Path(req.cwd).resolve()
        if not cwd_path.exists():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Working directory does not exist: {req.cwd}",
            )
        cwd_str = str(cwd_path)

    # --- 2. Classify command ---
    classification: CommandClassification = _permission_svc.classify_command(req.command)

    # --- 3. Permission check (best-effort; use default config when no project) ---
    if req.project_id:
        default_cfg = AgentPermissionConfig(
            workspace_path=cwd_str or ".",
            blocked_paths=[],
        )
        required_level = classification.required_permission
        perm_result = _permission_svc.check(required_level, cwd_str, default_cfg, req.command)
        if not perm_result.allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Command not permitted: {perm_result.reason}",
            )

    # --- 4. Execute ---
    start = time.perf_counter()
    timeout = max(1, min(req.timeout_seconds, 300))
    timed_out = False
    stdout_txt = ""
    stderr_txt = ""
    exit_code = 0

    try:
        proc = await asyncio.create_subprocess_shell(
            req.command,
            cwd=cwd_str,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=float(timeout)
            )
            exit_code = proc.returncode if proc.returncode is not None else 0
            stdout_txt = stdout_bytes.decode("utf-8", errors="replace")
            stderr_txt = stderr_bytes.decode("utf-8", errors="replace")
        except asyncio.TimeoutError:
            timed_out = True
            try:
                proc.kill()
            except ProcessLookupError:
                pass
            exit_code = -1
            stderr_txt = f"Command timed out after {timeout} seconds."
    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000.0
        return TerminalExecuteResponse(
            stdout="",
            stderr=str(exc),
            exit_code=1,
            timed_out=False,
            execution_time_ms=round(elapsed, 2),
            duration_ms=round(elapsed, 2),
            command_classification=classification,
        )

    elapsed_ms = round((time.perf_counter() - start) * 1000.0, 2)

    # --- 5. Store history ---
    if req.project_id:
        try:
            async with AsyncSessionLocal() as session:
                TaskEvent = _get_task_event_model()
                entry = TaskEvent(
                    id=str(uuid.uuid4()),
                    task_id=f"terminal:{req.project_id}",
                    event_type="terminal_command",
                    message=req.command,
                    data_json=json.dumps({
                        "cwd": cwd_str,
                        "exit_code": exit_code,
                        "execution_time_ms": elapsed_ms,
                        "project_id": req.project_id,
                    }),
                )
                session.add(entry)
                await session.commit()
        except Exception:
            pass  # history write failure must never break the response

    return TerminalExecuteResponse(
        stdout=stdout_txt,
        stderr=stderr_txt,
        exit_code=exit_code,
        timed_out=timed_out,
        execution_time_ms=elapsed_ms,
        duration_ms=elapsed_ms,
        command_classification=classification,
    )


# ---------------------------------------------------------------------------
# GET /api/terminal/history/{project_id}
# ---------------------------------------------------------------------------
@router.get("/history/{project_id}", response_model=list[TerminalHistoryItem])
async def get_terminal_history(project_id: str):
    """
    Return the last 100 commands run by the user in the given project.
    Stored as TaskEvent rows with event_type='terminal_command' and
    task_id='terminal:{project_id}'.
    """
    try:
        TaskEvent = _get_task_event_model()
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(TaskEvent)
                .where(TaskEvent.task_id == f"terminal:{project_id}")
                .where(TaskEvent.event_type == "terminal_command")
                .order_by(TaskEvent.timestamp.desc())
                .limit(100)
            )
            rows = result.scalars().all()

        items: list[TerminalHistoryItem] = []
        for row in reversed(rows):  # return in chronological order
            data: dict = {}
            if row.data_json:
                try:
                    data = json.loads(row.data_json)
                except Exception:
                    pass
            items.append(
                TerminalHistoryItem(
                    id=row.id,
                    command=row.message,
                    cwd=data.get("cwd"),
                    exit_code=data.get("exit_code"),
                    timestamp=row.timestamp,
                    project_id=data.get("project_id", project_id),
                )
            )
        return items
    except Exception as exc:
        # Return empty list gracefully if table doesn't exist yet
        return []


# ---------------------------------------------------------------------------
# WebSocket handler — registered in main.py as /ws/terminal/{project_id}
# ---------------------------------------------------------------------------
async def handle_terminal_ws(websocket: WebSocket, project_id: str) -> None:
    """
    Streaming terminal WebSocket.
    Accepts: {"command": str, "cwd": str}
    Streams: {"type": "stdout"|"stderr"|"exit", "data": str, "exit_code"?: int}
    """
    await websocket.accept()
    cwd_state: Optional[str] = None

    try:
        # Send ready message
        await websocket.send_text(json.dumps({
            "type": "system",
            "data": f"Terminal connected. Project: {project_id}"
        }))

        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                await websocket.send_text(json.dumps({"type": "error", "data": "Invalid JSON"}))
                continue

            command = msg.get("command", "").strip()
            cwd = msg.get("cwd") or cwd_state

            if not command:
                continue

            # Resolve cwd
            if cwd:
                cwd_path = Path(cwd).resolve()
                cwd = str(cwd_path) if cwd_path.exists() else cwd_state
            cwd_state = cwd

            # Handle built-in commands
            if command.lower() == "clear":
                await websocket.send_text(json.dumps({"type": "clear", "data": ""}))
                continue

            # Echo command back
            await websocket.send_text(json.dumps({"type": "echo", "data": command}))

            # Execute with streaming output
            start = time.perf_counter()
            try:
                proc = await asyncio.create_subprocess_shell(
                    command,
                    cwd=cwd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

                # Stream stdout and stderr concurrently
                async def stream_pipe(pipe, msg_type: str):
                    async for line in pipe:
                        text = line.decode("utf-8", errors="replace")
                        await websocket.send_text(json.dumps({"type": msg_type, "data": text}))

                await asyncio.gather(
                    stream_pipe(proc.stdout, "stdout"),
                    stream_pipe(proc.stderr, "stderr"),
                )

                await proc.wait()
                exit_code = proc.returncode if proc.returncode is not None else 0
                elapsed_ms = round((time.perf_counter() - start) * 1000.0, 2)

                await websocket.send_text(json.dumps({
                    "type": "exit",
                    "data": f"[Process exited with code {exit_code} in {elapsed_ms}ms]",
                    "exit_code": exit_code,
                }))

                # Persist history
                if project_id:
                    try:
                        async with AsyncSessionLocal() as session:
                            TaskEvent = _get_task_event_model()
                            entry = TaskEvent(
                                id=str(uuid.uuid4()),
                                task_id=f"terminal:{project_id}",
                                event_type="terminal_command",
                                message=command,
                                data_json=json.dumps({
                                    "cwd": cwd,
                                    "exit_code": exit_code,
                                    "execution_time_ms": elapsed_ms,
                                    "project_id": project_id,
                                }),
                            )
                            session.add(entry)
                            await session.commit()
                    except Exception:
                        pass

            except Exception as exc:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "data": f"Failed to execute: {exc}",
                    "exit_code": 1,
                }))

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
