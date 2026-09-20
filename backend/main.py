import json
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.database import init_db
from backend.services.ai_agent import agent_manager
from backend.routers import (
    projects_router,
    tasks_router,
    agent_router,
    filesystem_router,
    terminal_router,
    git_router,
    health_router,
    prompt_router,
    github_router,
    docker_router,
    settings_router,
    audit_router,
    evaluation_router,
)
from backend.routers.terminal import handle_terminal_ws
from backend.routers.github import handle_clone_ws
from backend.routers.docker import handle_docker_build_ws


import logging
from pathlib import Path
import httpx

logger = logging.getLogger("autonomous_dev.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create data/ and logs/ directories if missing
    data_dir = Path("data").resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    logs_dir = Path("backend/logs").resolve()
    logs_dir.mkdir(parents=True, exist_ok=True)

    # 2. Run database migrations / schema creation
    try:
        await init_db()
        logger.info("Database schema initialized successfully.")
    except Exception as e:
        logger.error(f"Database initialization error: {e}")

    # 3. Check if Ollama is running -> log warning if not (don't crash)
    ollama_url = f"{settings.ollama_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(ollama_url)
            if resp.status_code == 200:
                logger.info(f"Ollama connected successfully at {settings.ollama_url}")
            else:
                logger.warning(f"Ollama returned HTTP {resp.status_code} at {settings.ollama_url}")
    except Exception as e:
        logger.warning(
            f"WARNING: Ollama is not reachable at {settings.ollama_url} ({e}). "
            f"Start Ollama with 'ollama serve' or pull models with 'ollama pull {settings.ollama_model}'."
        )

    # 4. Print startup URL to console
    print("Backend ready at http://localhost:8000")
    logger.info("Backend ready at http://localhost:8000")

    yield
    # Shutdown logic if any

app = FastAPI(
    title="AutonomousDev Backend",
    version="1.0.0",
    description="Python FastAPI backend powering the Autonomous IDE Electron desktop application",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "null",
        "file://"
    ],
    allow_origin_regex=r"^(http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?|file://.*|null)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers returning uniform {detail, code} shape
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "code": f"HTTP_{exc.status_code}"
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    detail_str = "; ".join(
        [f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}" for err in errors]
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": detail_str or "Request validation error",
            "code": "VALIDATION_ERROR"
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": str(exc) or "Internal server error occurred",
            "code": "INTERNAL_SERVER_ERROR"
        }
    )

# Mount all routers with /api prefix
app.include_router(projects_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(filesystem_router, prefix="/api")
app.include_router(terminal_router, prefix="/api")
app.include_router(git_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(prompt_router, prefix="/api")
app.include_router(github_router, prefix="/api")
app.include_router(docker_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(evaluation_router, prefix="/api")

# WebSocket endpoint streaming agent events to frontend per task
@app.websocket("/ws/agent/{task_id}")
async def websocket_agent_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    await agent_manager.register_subscriber(websocket, task_id=task_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                parsed = json.loads(data)
                response = {"type": "ack", "task_id": task_id, "received": parsed}
            except Exception:
                response = {"type": "ack", "task_id": task_id, "message": data}
            await websocket.send_text(json.dumps(response))
    except WebSocketDisconnect:
        await agent_manager.unregister_subscriber(websocket, task_id=task_id)

# Global WebSocket endpoint for Electron main process relay
@app.websocket("/ws")
async def websocket_global_endpoint(websocket: WebSocket):
    await websocket.accept()
    await agent_manager.register_subscriber(websocket, task_id=None)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                parsed = json.loads(data)
                response = {"type": "ack", "received": parsed}
            except Exception:
                response = {"type": "ack", "message": data}
            await websocket.send_text(json.dumps(response))
    except WebSocketDisconnect:
        await agent_manager.unregister_subscriber(websocket, task_id=None)


# Terminal streaming WebSocket endpoint
@app.websocket("/ws/terminal/{project_id}")
async def websocket_terminal_endpoint(websocket: WebSocket, project_id: str):
    await handle_terminal_ws(websocket, project_id)


# GitHub Clone progress streaming WebSocket endpoint
@app.websocket("/ws/github/clone/{session_id}")
async def websocket_github_clone_endpoint(websocket: WebSocket, session_id: str):
    await handle_clone_ws(websocket, session_id)


# Docker Build streaming WebSocket endpoint
@app.websocket("/ws/docker/build/{project_id}")
async def websocket_docker_build_endpoint(websocket: WebSocket, project_id: str):
    await handle_docker_build_ws(websocket, project_id)

