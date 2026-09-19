import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import git

from backend.database import get_db
from backend.models.project import Project
from backend.services.github_service import (
    github_service,
    clone_broadcaster,
    GitHubUser,
    GitHubRepo,
    GitHubIssue,
    CIStatus,
    CloneResult,
    PushResult,
    PullResult,
    PRResult
)

router = APIRouter(prefix="/github", tags=["github"])


# ─────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class GitHubAuthStartResponse(BaseModel):
    auth_url: str
    state: str


class GitHubStatusResponse(BaseModel):
    connected: bool
    username: Optional[str] = None
    avatar_url: Optional[str] = None


class CloneRequestBody(BaseModel):
    clone_url: str
    target_path: str
    session_id: Optional[str] = None


class PushRequestBody(BaseModel):
    branch: str


class PRRequestBody(BaseModel):
    title: str
    body: str
    head: str
    base: str = "main"


async def _resolve_project_or_404(project_id: str, db: AsyncSession) -> Project:
    stmt = select(Project).where(Project.id == project_id)
    res = await db.execute(stmt)
    proj = res.scalars().first()
    if not proj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {project_id}"
        )
    return proj


# ─────────────────────────────────────────────────────────────────────────────
# OAUTH & AUTHENTICATION ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/auth/start", response_model=GitHubAuthStartResponse)
async def github_auth_start():
    """Initiates the GitHub OAuth flow and returns the authorization URL."""
    state = str(uuid.uuid4())
    auth_url = github_service.get_auth_url(state)
    return GitHubAuthStartResponse(auth_url=auth_url, state=state)


@router.get("/auth/callback")
async def github_auth_callback(
    code: str = Query(..., description="Authorization code from GitHub"),
    state: Optional[str] = Query(None, description="OAuth state parameter"),
    db: AsyncSession = Depends(get_db)
):
    """Exchanges code for access token and securely stores the authenticated profile."""
    try:
        token, expires_in = await github_service.exchange_code(code, state)
        user = await github_service.get_user(token)
        await github_service.save_account(
            username=user.login,
            avatar_url=user.avatar_url,
            access_token=token
        )

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <title>GitHub Connected</title>
          <style>
            body {{
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background-color: #1E1E1E;
              color: #CCCCCC;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }}
            .card {{
              background: #252526;
              border: 1px solid #2B2B2B;
              border-radius: 8px;
              padding: 32px;
              text-align: center;
              max-width: 420px;
              box-shadow: 0 4px 16px rgba(0,0,0,0.4);
            }}
            .avatar {{
              width: 72px;
              height: 72px;
              border-radius: 50%;
              border: 2px solid #007ACC;
              margin-bottom: 16px;
            }}
            h2 {{ color: #FFFFFF; margin: 0 0 8px 0; }}
            p {{ color: #858585; font-size: 14px; margin: 0 0 20px 0; }}
            .btn {{
              background: #007ACC;
              color: #FFFFFF;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
              text-decoration: none;
              display: inline-block;
            }}
          </style>
        </head>
        <body>
          <div class="card">
            <img class="avatar" src="{user.avatar_url or 'https://github.com/identicons/default.png'}" alt="{user.login}" />
            <h2>GitHub Connected</h2>
            <p>Authenticated as <strong>@{user.login}</strong>.<br/>You can close this window and return to Autonomous IDE.</p>
            <button class="btn" onclick="window.close()">Close Window</button>
          </div>
          <script>
            if (window.opener) {{
              window.opener.postMessage({{ type: 'GITHUB_AUTH_SUCCESS', username: '{user.login}' }}, '*');
              setTimeout(() => window.close(), 1200);
            }}
          </script>
        </body>
        </html>
        """
        return HTMLResponse(content=html_content, status_code=200)
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub OAuth callback failed: {str(ex)}"
        )


@router.get("/status", response_model=GitHubStatusResponse)
async def get_github_status():
    """Returns current GitHub account connection state."""
    account = await github_service.get_stored_account()
    if not account:
        return GitHubStatusResponse(connected=False)
    return GitHubStatusResponse(
        connected=True,
        username=account.username,
        avatar_url=account.avatar_url
    )


@router.post("/disconnect")
async def disconnect_github():
    """Disconnects the active GitHub account."""
    await github_service.disconnect()
    return {"connected": False, "message": "Disconnected GitHub account."}


# ─────────────────────────────────────────────────────────────────────────────
# REPOSITORIES & CLONING
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/repos", response_model=List[GitHubRepo])
async def list_github_repos(
    page: int = Query(1, ge=1, description="Page number for pagination")
):
    """Lists repositories accessible to the authenticated GitHub user."""
    try:
        return await github_service.list_repos(page=page)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(ve))
    except Exception as ex:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(ex))


@router.post("/clone", response_model=CloneResult)
async def clone_github_repo(body: CloneRequestBody):
    """Clones a remote GitHub repository to target filesystem location."""
    result = await github_service.clone_repo(
        clone_url=body.clone_url,
        target_path=body.target_path,
        session_id=body.session_id
    )
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.message
        )
    return result


# ─────────────────────────────────────────────────────────────────────────────
# PROJECT GIT OPERATIONS (PUSH, PULL, PR)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{project_id}/push", response_model=PushResult)
async def push_project_branch(
    project_id: str,
    body: PushRequestBody,
    db: AsyncSession = Depends(get_db)
):
    """Pushes the specified branch to remote origin with GIT_PUSH security permission check."""
    project = await _resolve_project_or_404(project_id, db)
    result = await github_service.push_branch(
        repo_path=project.path,
        branch=body.branch,
        project_id=project_id
    )
    if not result.success:
        status_code = (
            status.HTTP_403_FORBIDDEN
            if result.error == "PermissionDenied"
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=result.message)
    return result


@router.post("/{project_id}/pull", response_model=PullResult)
async def pull_project_remote(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Pulls remote changes for the current project."""
    project = await _resolve_project_or_404(project_id, db)
    result = await github_service.pull_remote(project.path)
    if not result.success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.message)
    return result


@router.post("/{project_id}/pr", response_model=PRResult)
async def create_project_pr(
    project_id: str,
    body: PRRequestBody,
    db: AsyncSession = Depends(get_db)
):
    """Creates a Pull Request on GitHub for this project's active branch."""
    project = await _resolve_project_or_404(project_id, db)
    result = await github_service.create_pull_request(
        repo_path=project.path,
        title=body.title,
        body=body.body,
        head=body.head,
        base=body.base
    )
    if not result.success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result.message)
    return result


@router.get("/{project_id}/issues", response_model=List[GitHubIssue])
async def list_project_issues(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Lists open GitHub issues associated with this project's repository."""
    project = await _resolve_project_or_404(project_id, db)
    full_name = github_service.extract_repo_full_name(project.path)
    if not full_name:
        tok = await github_service.get_access_token()
        if tok and tok.startswith("gho_mock_"):
            full_name = f"developer/{project.name.replace(' ', '-').lower()}"
        else:
            return []
    return await github_service.list_issues(full_name)


@router.get("/{project_id}/ci-status", response_model=CIStatus)
async def get_project_ci_status(
    project_id: str,
    commit_sha: Optional[str] = Query(None, description="Optional commit hash"),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves continuous integration (GitHub Actions) status for the project's HEAD commit."""
    project = await _resolve_project_or_404(project_id, db)
    full_name = github_service.extract_repo_full_name(project.path)
    if not full_name:
        tok = await github_service.get_access_token()
        if tok and tok.startswith("gho_mock_"):
            full_name = f"developer/{project.name.replace(' ', '-').lower()}"
        else:
            return CIStatus(status="unknown", repo_full_name=None)

    # If commit_sha was not provided, read current HEAD commit sha
    if not commit_sha:
        try:
            repo = git.Repo(project.path)
            if repo.head and repo.head.commit:
                commit_sha = repo.head.commit.hexsha
        except Exception:
            commit_sha = None

    return await github_service.get_ci_status(full_name, commit_sha)


# ─────────────────────────────────────────────────────────────────────────────
# WEBSOCKET FOR CLONE PROGRESS STREAMING
# ─────────────────────────────────────────────────────────────────────────────

async def handle_clone_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    await clone_broadcaster.register(session_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await clone_broadcaster.unregister(session_id, websocket)
