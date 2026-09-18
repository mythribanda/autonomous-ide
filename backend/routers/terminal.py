import asyncio
import time
from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from backend.schemas import TerminalExecuteRequest, TerminalExecuteResponse

router = APIRouter(prefix="/terminal", tags=["terminal"])

@router.post("/execute", response_model=TerminalExecuteResponse)
async def execute_terminal(req: TerminalExecuteRequest):
    cwd = str(Path(req.cwd).resolve()) if req.cwd else None
    if cwd and not Path(cwd).exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Working directory does not exist: {req.cwd}"
        )

    start_time = time.perf_counter()
    timeout = req.timeout_seconds or 60

    try:
        proc = await asyncio.create_subprocess_shell(
            req.command,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(),
                timeout=float(timeout)
            )
            exit_code = proc.returncode if proc.returncode is not None else 0
            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except ProcessLookupError:
                pass
            exit_code = -1
            stdout = ""
            stderr = f"Command timed out after {timeout} seconds."

    except Exception as e:
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        return TerminalExecuteResponse(
            stdout="",
            stderr=str(e),
            exit_code=1,
            duration_ms=round(duration_ms, 2)
        )

    duration_ms = (time.perf_counter() - start_time) * 1000.0
    return TerminalExecuteResponse(
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        duration_ms=round(duration_ms, 2)
    )
