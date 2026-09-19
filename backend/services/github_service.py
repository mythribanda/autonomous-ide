import os
import re
import json
import base64
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from collections import defaultdict

import httpx
import git
from cryptography.fernet import Fernet
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from fastapi import WebSocket

from backend.config import settings
from backend.database import AsyncSessionLocal
from backend.models.github import GitHubAccount
from backend.models.project import Project
from backend.schemas import (
    PermissionLevel,
    AgentPermissionConfig,
)
from backend.services.permission_service import PermissionService


# ─────────────────────────────────────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class GitHubUser(BaseModel):
    id: int
    login: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    html_url: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None
    public_repos: Optional[int] = 0


class GitHubRepo(BaseModel):
    id: int
    name: str
    full_name: str
    description: Optional[str] = None
    html_url: str
    clone_url: str
    default_branch: str = "main"
    language: Optional[str] = None
    stars: int = 0
    forks: int = 0
    private: bool = False
    updated_at: Optional[str] = None
    pushed_at: Optional[str] = None


class CloneResult(BaseModel):
    success: bool
    target_path: str
    repo_name: str
    message: str
    error: Optional[str] = None


class PushResult(BaseModel):
    success: bool
    branch: str
    message: str
    commit_hash: Optional[str] = None
    requires_approval: bool = False
    error: Optional[str] = None


class PullResult(BaseModel):
    success: bool
    message: str
    updated_files: List[str] = []
    error: Optional[str] = None


class PRResult(BaseModel):
    success: bool
    pr_number: Optional[int] = None
    html_url: Optional[str] = None
    title: Optional[str] = None
    state: Optional[str] = None
    message: str
    error: Optional[str] = None


class GitHubIssue(BaseModel):
    id: int
    number: int
    title: str
    body: Optional[str] = None
    state: str = "open"
    html_url: str
    user_login: Optional[str] = None
    labels: List[str] = []
    comments_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CIStatus(BaseModel):
    status: str = "unknown"  # passing, failing, running, unknown
    total_runs: int = 0
    successful_runs: int = 0
    failed_runs: int = 0
    in_progress_runs: int = 0
    runs: List[Dict[str, Any]] = []
    commit_sha: Optional[str] = None
    repo_full_name: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# ENCRYPTION MANAGER (Fernet at rest)
# ─────────────────────────────────────────────────────────────────────────────

class TokenEncryptionManager:
    def __init__(self):
        self._fernet: Optional[Fernet] = None

    def get_fernet(self) -> Fernet:
        if self._fernet is not None:
            return self._fernet

        key = settings.github_encryption_key.strip()
        if not key:
            # Fallback: persistent secret key file in data directory
            key_file = Path(settings.db_path).parent / ".github_key"
            try:
                if key_file.exists():
                    key = key_file.read_text(encoding="utf-8").strip()
                else:
                    new_key = Fernet.generate_key().decode("utf-8")
                    key_file.parent.mkdir(parents=True, exist_ok=True)
                    key_file.write_text(new_key, encoding="utf-8")
                    key = new_key
            except Exception:
                # If disk write fails, generate transient key
                key = Fernet.generate_key().decode("utf-8")

        # Ensure valid Fernet key (32 url-safe base64 bytes)
        try:
            self._fernet = Fernet(key.encode("utf-8") if isinstance(key, str) else key)
        except Exception:
            # If provided key format is invalid, derive valid base64 key
            b = key.encode("utf-8")
            padded = (b * ((32 // len(b)) + 1))[:32] if b else b"32bytesdefaultsecretkeyforgithub!"
            valid_key = base64.urlsafe_b64encode(padded)
            self._fernet = Fernet(valid_key)

        return self._fernet

    def encrypt(self, plaintext: str) -> str:
        if not plaintext:
            return ""
        f = self.get_fernet()
        return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")

    def decrypt(self, ciphertext: str) -> str:
        if not ciphertext:
            return ""
        try:
            f = self.get_fernet()
            return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
        except Exception as e:
            # If ciphertext was stored unencrypted or key mismatch
            return ciphertext


token_crypto = TokenEncryptionManager()


# ─────────────────────────────────────────────────────────────────────────────
# WEBSOCKET PROGRESS MANAGER FOR CLONE STREAMING
# ─────────────────────────────────────────────────────────────────────────────

class CloneProgressBroadcaster:
    def __init__(self):
        self.subscribers: Dict[str, List[WebSocket]] = defaultdict(list)

    async def register(self, session_id: str, ws: WebSocket):
        self.subscribers[session_id].append(ws)

    async def unregister(self, session_id: str, ws: WebSocket):
        if session_id in self.subscribers and ws in self.subscribers[session_id]:
            self.subscribers[session_id].remove(ws)
            if not self.subscribers[session_id]:
                del self.subscribers[session_id]

    def broadcast_sync(self, session_id: str, data: dict):
        """Dispatches progress to any connected WebSockets from background threads."""
        sockets = list(self.subscribers.get(session_id, []))
        if not sockets:
            return

        payload = json.dumps(data)
        for ws in sockets:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.run_coroutine_threadsafe(ws.send_text(payload), loop)
            except Exception:
                pass


clone_broadcaster = CloneProgressBroadcaster()


class CloneProgressReporter(git.RemoteProgress):
    def __init__(self, session_id: Optional[str] = None):
        super().__init__()
        self.session_id = session_id

    def update(self, op_code, cur_count, max_count=None, message=''):
        pct = 0
        if max_count and max_count > 0:
            pct = round((cur_count / max_count) * 100, 1)

        stage = self._get_stage_name(op_code)
        data = {
            "type": "clone_progress",
            "session_id": self.session_id,
            "stage": stage,
            "cur_count": cur_count,
            "max_count": max_count,
            "percent": pct,
            "message": message or f"{stage} ({pct}%)"
        }
        if self.session_id:
            clone_broadcaster.broadcast_sync(self.session_id, data)

    def _get_stage_name(self, op_code) -> str:
        if op_code & git.RemoteProgress.COUNTING:
            return "Counting objects"
        if op_code & git.RemoteProgress.COMPRESSING:
            return "Compressing objects"
        if op_code & git.RemoteProgress.RECEIVING:
            return "Receiving objects"
        if op_code & git.RemoteProgress.RESOLVING:
            return "Resolving deltas"
        if op_code & git.RemoteProgress.FINDING_SOURCES:
            return "Finding sources"
        if op_code & git.RemoteProgress.CHECKING_OUT:
            return "Checking out files"
        return "Cloning repository"


# ─────────────────────────────────────────────────────────────────────────────
# GITHUB SERVICE IMPLEMENTATION
# ─────────────────────────────────────────────────────────────────────────────

class GitHubService:
    def __init__(self):
        self.permission_service = PermissionService()

    # ── Token & Account Management ──────────────────────────────────────────

    async def get_stored_account(self) -> Optional[GitHubAccount]:
        """Returns the primary connected GitHubAccount from database."""
        async with AsyncSessionLocal() as session:
            stmt = select(GitHubAccount).order_by(GitHubAccount.updated_at.desc()).limit(1)
            res = await session.execute(stmt)
            return res.scalars().first()

    async def get_access_token(self) -> Optional[str]:
        """Returns the decrypted GitHub access token, if connected."""
        account = await self.get_stored_account()
        if not account or not account.access_token:
            return None
        return token_crypto.decrypt(account.access_token)

    async def save_account(
        self,
        username: str,
        avatar_url: Optional[str],
        access_token: str,
        token_expires_at: Optional[datetime] = None
    ) -> GitHubAccount:
        """Stores or updates the connected GitHub account with an encrypted token."""
        encrypted = token_crypto.encrypt(access_token)
        async with AsyncSessionLocal() as session:
            stmt = select(GitHubAccount).where(GitHubAccount.username == username)
            res = await session.execute(stmt)
            account = res.scalars().first()

            if account:
                account.avatar_url = avatar_url
                account.access_token = encrypted
                account.token_expires_at = token_expires_at
                account.updated_at = datetime.now(timezone.utc)
            else:
                account = GitHubAccount(
                    username=username,
                    avatar_url=avatar_url,
                    access_token=encrypted,
                    token_expires_at=token_expires_at
                )
                session.add(account)

            await session.commit()
            await session.refresh(account)
            return account

    async def disconnect(self) -> bool:
        """Removes connected GitHub accounts from database."""
        async with AsyncSessionLocal() as session:
            stmt = delete(GitHubAccount)
            await session.execute(stmt)
            await session.commit()
            return True

    # ── OAuth Helpers ────────────────────────────────────────────────────────

    def get_auth_url(self, state: str) -> str:
        """Constructs GitHub OAuth authorize URL."""
        client_id = settings.github_client_id.strip() or "mock_client_id"
        return f"https://github.com/login/oauth/authorize?client_id={client_id}&scope=repo,user&state={state}"

    async def exchange_code(self, code: str, state: Optional[str] = None) -> Tuple[str, Optional[int]]:
        """Exchanges authorization code for an OAuth access token."""
        client_id = settings.github_client_id.strip()
        client_secret = settings.github_client_secret.strip()

        # If client credentials are dummy/mock during tests, synthesize dev token
        if not client_id or not client_secret or client_id == "mock_client_id":
            return f"gho_mock_token_{code[:10]}", None

        url = "https://github.com/login/oauth/access_token"
        headers = {"Accept": "application/json"}
        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        token = data.get("access_token")
        if not token:
            error_desc = data.get("error_description") or data.get("error") or "Unknown error"
            raise ValueError(f"GitHub OAuth error: {error_desc}")

        expires_in = data.get("expires_in")
        return token, expires_in

    # ── REST API Methods (httpx) ─────────────────────────────────────────────

    def _headers(self, token: Optional[str]) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Autonomous-IDE-Desktop"
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def get_user(self, token: Optional[str] = None) -> GitHubUser:
        """Fetches the authenticated user profile."""
        tok = token or await self.get_access_token()
        if not tok:
            raise ValueError("No GitHub access token available. Connect GitHub first.")

        # If mock token
        if tok.startswith("gho_mock_"):
            return GitHubUser(
                id=1234567,
                login="developer",
                name="Autonomous Developer",
                avatar_url="https://github.com/identicons/developer.png",
                html_url="https://github.com/developer",
                email="developer@example.com",
                bio="Building autonomous software engineering agents",
                public_repos=14
            )

        url = "https://api.github.com/user"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=self._headers(tok))
            resp.raise_for_status()
            d = resp.json()

        return GitHubUser(
            id=d.get("id", 0),
            login=d.get("login", "unknown"),
            name=d.get("name"),
            avatar_url=d.get("avatar_url"),
            html_url=d.get("html_url"),
            email=d.get("email"),
            bio=d.get("bio"),
            public_repos=d.get("public_repos", 0)
        )

    async def list_repos(self, page: int = 1) -> List[GitHubRepo]:
        """Lists repositories accessible to the user sorted by last pushed."""
        tok = await self.get_access_token()
        if not tok:
            raise ValueError("No GitHub access token found. Please connect your GitHub account.")

        if tok.startswith("gho_mock_"):
            # Provide sample repos for testing environment
            return [
                GitHubRepo(
                    id=101,
                    name="autonomous-ide",
                    full_name="developer/autonomous-ide",
                    description="Autonomous AI-first Developer Workspace with deterministic verification",
                    html_url="https://github.com/developer/autonomous-ide",
                    clone_url="https://github.com/developer/autonomous-ide.git",
                    default_branch="main",
                    language="TypeScript",
                    stars=42,
                    forks=6,
                    private=False,
                    pushed_at=datetime.now(timezone.utc).isoformat()
                ),
                GitHubRepo(
                    id=102,
                    name="agentic-compiler",
                    full_name="developer/agentic-compiler",
                    description="AST analysis and automated prompt-to-spec compilation framework",
                    html_url="https://github.com/developer/agentic-compiler",
                    clone_url="https://github.com/developer/agentic-compiler.git",
                    default_branch="main",
                    language="Python",
                    stars=18,
                    forks=2,
                    private=True,
                    pushed_at=datetime.now(timezone.utc).isoformat()
                )
            ]

        url = f"https://api.github.com/user/repos?per_page=50&page={page}&sort=pushed"
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(url, headers=self._headers(tok))
            resp.raise_for_status()
            items = resp.json()

        repos: List[GitHubRepo] = []
        for r in items:
            repos.append(GitHubRepo(
                id=r.get("id"),
                name=r.get("name"),
                full_name=r.get("full_name"),
                description=r.get("description"),
                html_url=r.get("html_url"),
                clone_url=r.get("clone_url"),
                default_branch=r.get("default_branch", "main"),
                language=r.get("language"),
                stars=r.get("stargazers_count", 0),
                forks=r.get("forks_count", 0),
                private=r.get("private", False),
                updated_at=r.get("updated_at"),
                pushed_at=r.get("pushed_at")
            ))
        return repos

    async def clone_repo(
        self,
        clone_url: str,
        target_path: str,
        session_id: Optional[str] = None
    ) -> CloneResult:
        """Clones a remote repository using GitPython with live progress streaming."""
        target = Path(target_path).resolve()
        repo_name = target.name or "repository"

        # If target directory exists and is not empty, report error
        if target.exists() and any(target.iterdir()):
            return CloneResult(
                success=False,
                target_path=str(target),
                repo_name=repo_name,
                message=f"Directory '{target}' is not empty.",
                error="DirectoryNotEmpty"
            )

        target.mkdir(parents=True, exist_ok=True)

        # Inject auth token if private repo clone URL
        tok = await self.get_access_token()
        authed_clone_url = clone_url
        if tok and not tok.startswith("gho_mock_") and clone_url.startswith("https://github.com/"):
            authed_clone_url = clone_url.replace("https://github.com/", f"https://oauth2:{tok}@github.com/")

        progress_reporter = CloneProgressReporter(session_id=session_id)

        try:
            # Run git clone in thread to prevent blocking the async event loop
            await asyncio.to_thread(
                git.Repo.clone_from,
                authed_clone_url,
                str(target),
                progress=progress_reporter
            )

            # Clean remote URL in git config to not persist raw token
            try:
                repo = git.Repo(str(target))
                if "origin" in repo.remotes:
                    repo.remotes.origin.set_url(clone_url)
            except Exception:
                pass

            if session_id:
                clone_broadcaster.broadcast_sync(session_id, {
                    "type": "clone_complete",
                    "session_id": session_id,
                    "target_path": str(target),
                    "message": "Repository cloned successfully"
                })

            return CloneResult(
                success=True,
                target_path=str(target),
                repo_name=repo_name,
                message=f"Successfully cloned repository to {target}"
            )
        except Exception as ex:
            err_msg = str(ex)
            if session_id:
                clone_broadcaster.broadcast_sync(session_id, {
                    "type": "clone_error",
                    "session_id": session_id,
                    "error": err_msg
                })
            return CloneResult(
                success=False,
                target_path=str(target),
                repo_name=repo_name,
                message=f"Clone failed: {err_msg}",
                error=err_msg
            )

    async def push_branch(
        self,
        repo_path: str,
        branch: str,
        project_id: Optional[str] = None
    ) -> PushResult:
        """Pushes a local branch to remote, validating GIT_PUSH permission policy."""
        # 1. Permission check
        config = AgentPermissionConfig()
        if project_id:
            async with AsyncSessionLocal() as session:
                p_stmt = select(Project).where(Project.id == project_id)
                p_res = await session.execute(p_stmt)
                proj = p_res.scalars().first()
                if proj and proj.config_json:
                    try:
                        cfg_dict = json.loads(proj.config_json)
                        config = AgentPermissionConfig.model_validate(cfg_dict)
                    except Exception:
                        pass

        perm_res = self.permission_service.check(
            PermissionLevel.GIT_PUSH,
            repo_path,
            config,
            command=f"git push origin {branch}"
        )

        if not perm_res.allowed and not perm_res.requires_approval:
            return PushResult(
                success=False,
                branch=branch,
                message=f"Push denied by policy: {perm_res.reason}",
                error="PermissionDenied"
            )

        # 2. Push via GitPython
        try:
            repo = git.Repo(repo_path)
            if "origin" not in repo.remotes:
                return PushResult(
                    success=False,
                    branch=branch,
                    message="No 'origin' remote found in this repository.",
                    error="NoOriginRemote"
                )

            # Ensure authenticated URL if token exists
            tok = await self.get_access_token()
            origin = repo.remotes.origin
            orig_url = origin.url

            push_url = orig_url
            if tok and not tok.startswith("gho_mock_") and orig_url.startswith("https://github.com/"):
                push_url = orig_url.replace("https://github.com/", f"https://oauth2:{tok}@github.com/")
                origin.set_url(push_url)

            try:
                push_info = await asyncio.to_thread(origin.push, refspec=f"{branch}:{branch}")
            finally:
                # Reset original URL
                if push_url != orig_url:
                    origin.set_url(orig_url)

            commit_hash = repo.head.commit.hexsha[:8] if repo.head else None
            return PushResult(
                success=True,
                branch=branch,
                commit_hash=commit_hash,
                message=f"Successfully pushed branch '{branch}' to remote origin."
            )
        except Exception as ex:
            return PushResult(
                success=False,
                branch=branch,
                message=f"Push failed: {str(ex)}",
                error=str(ex)
            )

    async def pull_remote(self, repo_path: str) -> PullResult:
        """Pulls changes from remote origin into the active branch."""
        try:
            repo = git.Repo(repo_path)
            if "origin" not in repo.remotes:
                return PullResult(
                    success=False,
                    message="No 'origin' remote configured.",
                    error="NoOriginRemote"
                )

            tok = await self.get_access_token()
            origin = repo.remotes.origin
            orig_url = origin.url

            pull_url = orig_url
            if tok and not tok.startswith("gho_mock_") and orig_url.startswith("https://github.com/"):
                pull_url = orig_url.replace("https://github.com/", f"https://oauth2:{tok}@github.com/")
                origin.set_url(pull_url)

            try:
                pull_info = await asyncio.to_thread(origin.pull)
            finally:
                if pull_url != orig_url:
                    origin.set_url(orig_url)

            updated_files: List[str] = []
            for info in pull_info:
                if hasattr(info, 'commit') and info.commit:
                    for item in info.commit.stats.files.keys():
                        updated_files.append(item)

            return PullResult(
                success=True,
                message="Successfully pulled latest changes from remote.",
                updated_files=updated_files
            )
        except Exception as ex:
            return PullResult(
                success=False,
                message=f"Pull failed: {str(ex)}",
                error=str(ex)
            )

    def extract_repo_full_name(self, repo_path: str) -> Optional[str]:
        """Extracts owner/repo from git origin remote."""
        try:
            repo = git.Repo(repo_path)
            if "origin" not in repo.remotes:
                return None
            url = repo.remotes.origin.url
            # Match HTTPS or SSH: https://github.com/owner/repo.git or git@github.com:owner/repo.git
            m = re.search(r"github\.com[/:]([a-zA-Z0-9_\-\.]+)/([a-zA-Z0-9_\-\.]+?)(?:\.git)?$", url)
            if m:
                return f"{m.group(1)}/{m.group(2)}"
            return None
        except Exception:
            return None

    async def create_pull_request(
        self,
        repo_path: str,
        title: str,
        body: str,
        head: str,
        base: str = "main",
        repo_full_name: Optional[str] = None
    ) -> PRResult:
        """Creates a Pull Request on GitHub for the specified head branch."""
        full_name = repo_full_name or self.extract_repo_full_name(repo_path)
        tok = await self.get_access_token()

        if not full_name and tok and tok.startswith("gho_mock_"):
            full_name = f"developer/{Path(repo_path).name}"

        if not full_name:
            return PRResult(
                success=False,
                message="Could not resolve GitHub repository name from git remote.",
                error="RepositoryNotFound"
            )

        if not tok:
            return PRResult(
                success=False,
                message="No GitHub account connected. Connect GitHub to create PRs.",
                error="NotAuthenticated"
            )

        # Mock PR response for mock tokens
        if tok.startswith("gho_mock_"):
            pr_num = 42
            url = f"https://github.com/{full_name}/pull/{pr_num}"
            return PRResult(
                success=True,
                pr_number=pr_num,
                html_url=url,
                title=title,
                state="open",
                message=f"Pull Request #{pr_num} created successfully."
            )

        url = f"https://api.github.com/repos/{full_name}/pulls"
        payload = {
            "title": title,
            "body": body,
            "head": head,
            "base": base
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, json=payload, headers=self._headers(tok))
            if resp.status_code not in (200, 201):
                err_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                err_msg = err_data.get("message") or resp.text
                return PRResult(
                    success=False,
                    message=f"Failed to create PR: {err_msg}",
                    error=err_msg
                )
            data = resp.json()

        return PRResult(
            success=True,
            pr_number=data.get("number"),
            html_url=data.get("html_url"),
            title=data.get("title"),
            state=data.get("state"),
            message=f"Pull Request #{data.get('number')} created successfully."
        )

    async def list_issues(self, repo_full_name: str) -> List[GitHubIssue]:
        """Lists open issues for the repository."""
        tok = await self.get_access_token()

        if tok and tok.startswith("gho_mock_"):
            return [
                GitHubIssue(
                    id=1001,
                    number=1,
                    title="Implement token bucket rate limiter for API gateway",
                    body="We need to prevent DDoS and abusive requests by adding a Redis/in-memory rate limiter middleware.",
                    state="open",
                    html_url=f"https://github.com/{repo_full_name}/issues/1",
                    user_login="developer",
                    labels=["enhancement", "security"],
                    comments_count=3,
                    updated_at=datetime.now(timezone.utc).isoformat()
                ),
                GitHubIssue(
                    id=1002,
                    number=2,
                    title="Fix intermittent WebSocket reconnection failure on client",
                    body="When the backend drops the socket, exponential backoff does not trigger properly on electron window blur.",
                    state="open",
                    html_url=f"https://github.com/{repo_full_name}/issues/2",
                    user_login="qa-engineer",
                    labels=["bug", "high-priority"],
                    comments_count=1,
                    updated_at=datetime.now(timezone.utc).isoformat()
                )
            ]

        url = f"https://api.github.com/repos/{repo_full_name}/issues?state=open&per_page=30"
        headers = self._headers(tok)

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return []
            items = resp.json()

        issues: List[GitHubIssue] = []
        for it in items:
            # GitHub returns both PRs and issues in /issues; filter out PRs
            if "pull_request" in it:
                continue

            lbls = [l.get("name") for l in it.get("labels", []) if isinstance(l, dict)]
            issues.append(GitHubIssue(
                id=it.get("id"),
                number=it.get("number"),
                title=it.get("title", ""),
                body=it.get("body"),
                state=it.get("state", "open"),
                html_url=it.get("html_url", ""),
                user_login=it.get("user", {}).get("login"),
                labels=lbls,
                comments_count=it.get("comments", 0),
                created_at=it.get("created_at"),
                updated_at=it.get("updated_at")
            ))
        return issues

    async def get_ci_status(self, repo_full_name: str, commit_sha: Optional[str] = None) -> CIStatus:
        """Fetches commit check-runs or workflow runs to assess CI health."""
        tok = await self.get_access_token()

        if tok and tok.startswith("gho_mock_"):
            return CIStatus(
                status="passing",
                total_runs=3,
                successful_runs=3,
                failed_runs=0,
                in_progress_runs=0,
                runs=[
                    {"name": "Build & Bundle (Vite)", "status": "completed", "conclusion": "success"},
                    {"name": "Unit Tests (Pytest)", "status": "completed", "conclusion": "success"},
                    {"name": "Security Audit (AST)", "status": "completed", "conclusion": "success"}
                ],
                commit_sha=commit_sha or "a1b2c3d4",
                repo_full_name=repo_full_name
            )

        headers = self._headers(tok)

        # If commit_sha is provided, use check-runs API
        if commit_sha:
            url = f"https://api.github.com/repos/{repo_full_name}/commits/{commit_sha}/check-runs"
        else:
            # Otherwise fetch the latest check runs from default branch
            url = f"https://api.github.com/repos/{repo_full_name}/actions/runs?per_page=5"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code != 200:
                    return CIStatus(status="unknown", repo_full_name=repo_full_name, commit_sha=commit_sha)
                data = resp.json()

            runs = data.get("check_runs") or data.get("workflow_runs") or []
            if not runs:
                return CIStatus(status="unknown", repo_full_name=repo_full_name, commit_sha=commit_sha)

            total = len(runs)
            successful = 0
            failed = 0
            in_progress = 0
            formatted_runs = []

            for r in runs:
                st = r.get("status")
                concl = r.get("conclusion")
                formatted_runs.append({
                    "name": r.get("name", "Workflow"),
                    "status": st,
                    "conclusion": concl,
                    "html_url": r.get("html_url")
                })
                if st in ("in_progress", "queued"):
                    in_progress += 1
                elif concl == "success":
                    successful += 1
                elif concl in ("failure", "timed_out", "action_required"):
                    failed += 1

            if failed > 0:
                overall = "failing"
            elif in_progress > 0:
                overall = "running"
            elif successful > 0:
                overall = "passing"
            else:
                overall = "unknown"

            return CIStatus(
                status=overall,
                total_runs=total,
                successful_runs=successful,
                failed_runs=failed,
                in_progress_runs=in_progress,
                runs=formatted_runs,
                commit_sha=commit_sha,
                repo_full_name=repo_full_name
            )
        except Exception:
            return CIStatus(status="unknown", repo_full_name=repo_full_name, commit_sha=commit_sha)


github_service = GitHubService()
