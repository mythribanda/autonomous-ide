from backend.routers.projects import router as projects_router
from backend.routers.tasks import router as tasks_router
from backend.routers.agent import router as agent_router
from backend.routers.filesystem import router as filesystem_router
from backend.routers.terminal import router as terminal_router
from backend.routers.git_router import router as git_router
from backend.routers.health import router as health_router

__all__ = [
    "projects_router",
    "tasks_router",
    "agent_router",
    "filesystem_router",
    "terminal_router",
    "git_router",
    "health_router",
]
