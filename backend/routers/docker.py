import json
import asyncio
from pathlib import Path
from typing import Optional, Dict, Set, List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.project import Project
from backend.schemas import (
    DockerConfig,
    GenerateDockerFileResponse,
    GenerateComposeResponse,
    SaveDockerFileRequest,
    BuildDockerImageRequest,
    BuildResult,
    StartContainerRequest,
    ContainerResult,
    StopContainerRequest,
    ContainerInfo,
    ProjectScanResult
)
from backend.services.docker_service import docker_service

router = APIRouter(prefix="/projects/{project_id}/docker", tags=["docker"])

# Active WebSocket subscribers for streaming build logs: project_id -> Set[WebSocket]
_build_subscribers: Dict[str, Set[WebSocket]] = {}


async def _get_project_or_404(project_id: str, db: AsyncSession) -> Project:
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' not found"
        )
    return project


# ---------------------------------------------------------------------------
# GET /api/projects/{project_id}/docker/config
# ---------------------------------------------------------------------------
@router.get("/config", response_model=DockerConfig)
async def get_docker_config(project_id: str, db: AsyncSession = Depends(get_db)):
    """Detects Docker configuration and Docker daemon availability for the project."""
    project = await _get_project_or_404(project_id, db)
    return docker_service.detect_docker_config(project.path)


# ---------------------------------------------------------------------------
# POST /api/projects/{project_id}/docker/generate-dockerfile
# ---------------------------------------------------------------------------
@router.post("/generate-dockerfile", response_model=GenerateDockerFileResponse)
async def generate_dockerfile(project_id: str, db: AsyncSession = Depends(get_db)):
    """Generates a production-ready Dockerfile based on project language and framework analysis."""
    project = await _get_project_or_404(project_id, db)
    scan_result: Optional[ProjectScanResult] = None
    if project.config_json:
        try:
            cfg = json.loads(project.config_json)
            if "scan_result" in cfg:
                scan_result = ProjectScanResult(**cfg["scan_result"])
        except Exception:
            pass

    content = await docker_service.generate_dockerfile(project.path, scan_result)
    return GenerateDockerFileResponse(dockerfile=content, suggested_filename="Dockerfile")


# ---------------------------------------------------------------------------
# POST /api/projects/{project_id}/docker/generate-compose
# ---------------------------------------------------------------------------
@router.post("/generate-compose", response_model=GenerateComposeResponse)
async def generate_compose(project_id: str, db: AsyncSession = Depends(get_db)):
    """Generates a docker-compose.yml file linking app, detected database, and cache services."""
    project = await _get_project_or_404(project_id, db)
    db_name = None
    services: List[str] = ["redis"]
    if project.config_json:
        try:
            cfg = json.loads(project.config_json)
            if "scan_result" in cfg:
                db_name = cfg["scan_result"].get("detected_database")
        except Exception:
            pass

    compose_content = await docker_service.generate_compose(
        project.path,
        services=services,
        db=db_name
    )
    return GenerateComposeResponse(compose_yaml=compose_content, suggested_filename="docker-compose.yml")


# ---------------------------------------------------------------------------
# POST /api/projects/{project_id}/docker/save-file
# ---------------------------------------------------------------------------
@router.post("/save-file")
async def save_docker_file(project_id: str, req: SaveDockerFileRequest, db: AsyncSession = Depends(get_db)):
    """Writes the reviewed Dockerfile or docker-compose.yml to the project directory."""
    project = await _get_project_or_404(project_id, db)
    target_path = Path(project.path) / req.filename
    try:
        target_path.write_text(req.content, encoding="utf-8")
        return {"success": True, "saved_path": str(target_path)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write file '{req.filename}': {e}"
        )


# ---------------------------------------------------------------------------
# POST /api/projects/{project_id}/docker/build
# ---------------------------------------------------------------------------
@router.post("/build", response_model=BuildResult)
async def build_docker_image(
    project_id: str,
    req: BuildDockerImageRequest,
    db: AsyncSession = Depends(get_db)
):
    """Builds a Docker image for the project, streaming logs to active WebSocket listeners."""
    project = await _get_project_or_404(project_id, db)

    async def _stream_log(line: str):
        subscribers = _build_subscribers.get(project_id, set())
        if subscribers:
            payload = json.dumps({"type": "build_log", "data": line})
            disconnected = set()
            for ws in list(subscribers):
                try:
                    await ws.send_text(payload)
                except Exception:
                    disconnected.add(ws)
            if disconnected:
                subscribers.difference_update(disconnected)

    tag = req.tag.strip() or f"{Path(project.path).name.lower()}:latest"
    result = await docker_service.build_image(project.path, tag=tag, log_callback=_stream_log)

    # Broadcast completion
    subscribers = _build_subscribers.get(project_id, set())
    if subscribers:
        comp_payload = json.dumps({"type": "build_complete", "result": result.model_dump()})
        for ws in list(subscribers):
            try:
                await ws.send_text(comp_payload)
            except Exception:
                pass

    return result


# ---------------------------------------------------------------------------
# POST /api/projects/{project_id}/docker/start
# ---------------------------------------------------------------------------
@router.post("/start", response_model=ContainerResult)
async def start_docker_container(
    project_id: str,
    req: StartContainerRequest,
    db: AsyncSession = Depends(get_db)
):
    """Runs a Docker container with given port mappings and optional env file."""
    project = await _get_project_or_404(project_id, db)
    return await docker_service.start_container(
        image_tag=req.image_tag,
        ports=req.ports,
        env_file=req.env_file,
        container_name=req.container_name
    )


# ---------------------------------------------------------------------------
# POST /api/projects/{project_id}/docker/stop
# ---------------------------------------------------------------------------
@router.post("/stop")
async def stop_docker_container(
    project_id: str,
    req: StopContainerRequest,
    db: AsyncSession = Depends(get_db)
):
    """Stops a running container by its ID."""
    await _get_project_or_404(project_id, db)
    stopped = await docker_service.stop_container(req.container_id)
    if not stopped:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to stop container '{req.container_id}'"
        )
    return {"success": True, "container_id": req.container_id}


# ---------------------------------------------------------------------------
# GET /api/projects/{project_id}/docker/logs
# ---------------------------------------------------------------------------
@router.get("/logs")
async def get_container_logs(
    project_id: str,
    container_id: str = Query(..., description="Target container ID"),
    tail: int = Query(100, ge=1, le=5000),
    db: AsyncSession = Depends(get_db)
):
    """Fetches recent stdout/stderr output lines from a container."""
    await _get_project_or_404(project_id, db)
    logs = await docker_service.get_container_logs(container_id=container_id, tail=tail)
    return {"container_id": container_id, "logs": logs}


# ---------------------------------------------------------------------------
# GET /api/projects/{project_id}/docker/containers
# ---------------------------------------------------------------------------
@router.get("/containers", response_model=List[ContainerInfo])
async def list_running_containers(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Lists currently running containers on the Docker daemon."""
    project = await _get_project_or_404(project_id, db)
    return docker_service.get_running_containers(project.path)


# ---------------------------------------------------------------------------
# WebSocket handler for live build streaming
# ---------------------------------------------------------------------------
async def handle_docker_build_ws(websocket: WebSocket, project_id: str):
    await websocket.accept()
    if project_id not in _build_subscribers:
        _build_subscribers[project_id] = set()
    _build_subscribers[project_id].add(websocket)

    try:
        while True:
            # Keepalive ping/pong
            msg = await websocket.receive_text()
            try:
                data = json.loads(msg)
                if data.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        if project_id in _build_subscribers:
            _build_subscribers[project_id].discard(websocket)
            if not _build_subscribers[project_id]:
                del _build_subscribers[project_id]
