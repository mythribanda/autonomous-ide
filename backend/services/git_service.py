from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import asyncio
import os
from datetime import datetime, timezone
import git

from backend.schemas import (
    GitStatus,
    CheckpointResult,
    FileDiff,
    RollbackResult,
    GitLogEntry,
)
from backend.database import AsyncSessionLocal
from backend.models.git import GitCheckpoint
from sqlalchemy import select

CHECKPOINT_PREFIX = "CHECKPOINT: "
AUTONOMOUS_SUFFIX = " [autonomous-ide]"


class GitService:
    def _get_repo(self, repo_path: str) -> Optional[git.Repo]:
        p = Path(repo_path)
        if not p.exists():
            return None
        try:
            return git.Repo(p, search_parent_directories=True)
        except (git.InvalidGitRepositoryError, git.NoSuchPathError):
            return None

    def _ensure_repo(self, repo_path: str) -> git.Repo:
        repo = self._get_repo(repo_path)
        if not repo:
            p = Path(repo_path)
            p.mkdir(parents=True, exist_ok=True)
            repo = git.Repo.init(repo_path)
        return repo

    def _sync_get_status(self, repo_path: str) -> GitStatus:
        repo = self._get_repo(repo_path)
        if not repo:
            return GitStatus(
                branch="none",
                is_clean=True,
                modified_files=[],
                added_files=[],
                deleted_files=[],
                untracked_files=[],
                ahead_by=0,
                behind_by=0,
                project_path=repo_path,
                staged_files=[],
            )

        try:
            branch = repo.active_branch.name
        except Exception:
            try:
                branch = repo.head.commit.hexsha[:7]
            except Exception:
                branch = "main"

        porcelain = repo.git.status("--porcelain")
        modified_files: List[str] = []
        added_files: List[str] = []
        deleted_files: List[str] = []
        untracked_files: List[str] = []
        staged_files: List[str] = []

        for line in porcelain.splitlines():
            if not line or len(line) < 3:
                continue
            x = line[0]
            y = line[1]
            raw_path = line[3:].strip()
            if " -> " in raw_path:
                raw_path = raw_path.split(" -> ")[1].strip()

            if x == "?" and y == "?":
                untracked_files.append(raw_path)
                continue

            # Check staged
            if x in ("M", "A", "D", "R", "C"):
                staged_files.append(raw_path)
                if x == "A":
                    added_files.append(raw_path)
                elif x == "D":
                    deleted_files.append(raw_path)
                elif x == "M":
                    modified_files.append(raw_path)

            # Check unstaged
            if y == "M":
                if raw_path not in modified_files:
                    modified_files.append(raw_path)
            elif y == "D":
                if raw_path not in deleted_files:
                    deleted_files.append(raw_path)

        is_clean = len(porcelain.strip()) == 0

        # Ahead / Behind calculation
        ahead_by = 0
        behind_by = 0
        try:
            tracking = repo.active_branch.tracking_branch()
            if tracking:
                ahead_commits = list(repo.iter_commits(f"{tracking.name}..{repo.active_branch.name}"))
                behind_commits = list(repo.iter_commits(f"{repo.active_branch.name}..{tracking.name}"))
                ahead_by = len(ahead_commits)
                behind_by = len(behind_commits)
        except Exception:
            ahead_by = 0
            behind_by = 0

        return GitStatus(
            branch=branch,
            is_clean=is_clean,
            modified_files=modified_files,
            added_files=added_files,
            deleted_files=deleted_files,
            untracked_files=untracked_files,
            ahead_by=ahead_by,
            behind_by=behind_by,
            project_path=repo_path,
            staged_files=staged_files,
        )

    async def get_status(self, repo_path: str) -> GitStatus:
        return await asyncio.to_thread(self._sync_get_status, repo_path)

    def _sync_create_checkpoint(
        self,
        repo_path: str,
        message: str,
        author_name: str = "AutonomousDev Agent"
    ) -> Tuple[str, int, bool, str]:
        repo = self._ensure_repo(repo_path)

        # 1. repo.git.add("-A")
        repo.git.add("-A")

        # 2. Check if clean / nothing staged
        try:
            porcelain = repo.git.status("--porcelain")
        except Exception:
            porcelain = ""

        has_staged = False
        staged_count = 0
        for line in porcelain.splitlines():
            if line and len(line) >= 2 and line[0] in ("M", "A", "D", "R", "C"):
                has_staged = True
                staged_count += 1

        if not repo.head.is_valid():
            has_staged = len(porcelain.strip()) > 0
            staged_count = len(porcelain.splitlines())

        if not has_staged:
            current_hash = repo.head.commit.hexsha if repo.head.is_valid() else ""
            try:
                cur_branch = repo.active_branch.name
            except Exception:
                cur_branch = "main"
            return current_hash, 0, True, cur_branch

        # 3. repo.index.commit(f"CHECKPOINT: {message} [autonomous-ide]")
        full_msg = f"{CHECKPOINT_PREFIX}{message}{AUTONOMOUS_SUFFIX}"
        actor = git.Actor(author_name, "agent@autonomous-ide.local")
        commit = repo.index.commit(full_msg, author=actor, committer=actor)

        try:
            branch = repo.active_branch.name
        except Exception:
            branch = "main"

        files_staged = len(commit.stats.files) or staged_count or 1
        return commit.hexsha, files_staged, False, branch

    async def create_checkpoint(
        self,
        repo_path: str,
        message: str,
        project_id: Optional[str] = None,
        task_id: Optional[str] = None,
        author_name: str = "AutonomousDev Agent",
        is_autonomous: bool = True
    ) -> CheckpointResult:
        commit_hash, files_staged, skipped, branch = await asyncio.to_thread(
            self._sync_create_checkpoint, repo_path, message, author_name
        )

        record_id = None
        # 4. Store CheckpointResult in GitCheckpoint DB model if not skipped and project_id given
        if project_id and not skipped:
            try:
                async with AsyncSessionLocal() as session:
                    chk = GitCheckpoint(
                        project_id=project_id,
                        task_id=task_id,
                        commit_hash=commit_hash,
                        branch=branch,
                        message=f"{CHECKPOINT_PREFIX}{message}{AUTONOMOUS_SUFFIX}",
                        author=author_name,
                        type="ai_checkpoint",
                        files_changed=files_staged,
                        is_autonomous=is_autonomous,
                        created_at=datetime.now(timezone.utc)
                    )
                    session.add(chk)
                    await session.commit()
                    await session.refresh(chk)
                    record_id = chk.id
            except Exception as e:
                pass

        # 5. Return CheckpointResult
        return CheckpointResult(
            commit_hash=commit_hash,
            files_staged=files_staged,
            skipped=skipped,
            message=message,
            branch=branch,
            id=record_id
        )

    def _sync_get_diff(self, repo_path: str, file_path: Optional[str] = None) -> str:
        repo = self._get_repo(repo_path)
        if not repo:
            return ""
        try:
            if file_path:
                if repo.head.is_valid():
                    diff = repo.git.diff("HEAD", "--", file_path)
                else:
                    diff = repo.git.diff("--", file_path)
                if not diff:
                    diff = repo.git.diff(file_path)
                return diff
            return repo.git.diff("HEAD") if repo.head.is_valid() else repo.git.diff()
        except Exception:
            try:
                return repo.git.diff(file_path) if file_path else repo.git.diff()
            except Exception:
                return ""

    async def get_diff(self, repo_path: str, file_path: Optional[str] = None) -> str:
        return await asyncio.to_thread(self._sync_get_diff, repo_path, file_path)

    def _sync_get_file_diff(self, repo_path: str, file_path: str, old_commit: str = "HEAD") -> FileDiff:
        repo = self._get_repo(repo_path)
        if not repo:
            return FileDiff(
                file_path=file_path,
                diff_text="",
                lines_added=0,
                lines_removed=0,
                old_content=None,
                new_content=None
            )

        # Get old content
        old_content: Optional[str] = None
        if repo.head.is_valid():
            try:
                old_content = repo.git.show(f"{old_commit}:{file_path}")
            except Exception:
                old_content = None

        # Get new content from disk
        new_content: Optional[str] = None
        target = Path(repo_path) / file_path
        if target.exists() and target.is_file():
            try:
                new_content = target.read_text(encoding="utf-8", errors="replace")
            except Exception:
                new_content = None

        # Generate diff text
        diff_text = ""
        try:
            if repo.head.is_valid():
                diff_text = repo.git.diff(old_commit, "--", file_path)
            else:
                diff_text = repo.git.diff("--", file_path)
        except Exception:
            diff_text = ""

        lines_added = 0
        lines_removed = 0
        for line in diff_text.splitlines():
            if line.startswith("+") and not line.startswith("+++"):
                lines_added += 1
            elif line.startswith("-") and not line.startswith("---"):
                lines_removed += 1

        return FileDiff(
            file_path=file_path,
            diff_text=diff_text,
            lines_added=lines_added,
            lines_removed=lines_removed,
            old_content=old_content,
            new_content=new_content
        )

    async def get_file_diff(self, repo_path: str, file_path: str, old_commit: str = "HEAD") -> FileDiff:
        return await asyncio.to_thread(self._sync_get_file_diff, repo_path, file_path, old_commit)

    def _sync_revert_file(self, repo_path: str, file_path: str) -> bool:
        repo = self._get_repo(repo_path)
        if not repo:
            return False
        try:
            if repo.head.is_valid():
                repo.git.checkout("HEAD", "--", file_path)
            else:
                repo.git.checkout("--", file_path)
            return True
        except Exception:
            target = Path(repo_path) / file_path
            if target.exists() and target.is_file():
                try:
                    target.unlink()
                    return True
                except Exception:
                    pass
            return False

    async def revert_file(self, repo_path: str, file_path: str) -> bool:
        return await asyncio.to_thread(self._sync_revert_file, repo_path, file_path)

    def _sync_rollback(self, repo_path: str, commit_hash: str) -> Tuple[bool, int, str]:
        repo = self._get_repo(repo_path)
        if not repo:
            return False, 0, "Repository not found"

        # 1. Validate commit_hash exists in repo
        try:
            commit = repo.commit(commit_hash)
        except Exception:
            return False, 0, f"Commit hash {commit_hash} does not exist in repository"

        # 2. Validate it is an autonomous-ide checkpoint commit (check message prefix)
        commit_msg = commit.message.strip()
        is_checkpoint = (
            commit_msg.startswith(CHECKPOINT_PREFIX) or
            AUTONOMOUS_SUFFIX in commit_msg or
            "CHECKPOINT" in commit_msg.upper()
        )
        if not is_checkpoint:
            return False, 0, f"Commit {commit_hash[:7]} is not an autonomous-ide checkpoint commit"

        # 4. repo.git.reset("--hard", commit_hash)
        files_restored = 0
        try:
            stat_diff = repo.git.diff("--name-only", commit_hash)
            files_restored = len([f for f in stat_diff.splitlines() if f.strip()])
        except Exception:
            files_restored = 1

        try:
            repo.git.reset("--hard", commit_hash)
            return True, files_restored, f"Successfully rolled back to checkpoint {commit_hash[:7]}"
        except Exception as e:
            return False, 0, f"Git reset failed: {str(e)}"

    async def rollback_to_checkpoint(
        self,
        repo_path: str,
        commit_hash: str,
        project_id: Optional[str] = None
    ) -> RollbackResult:
        success, files_restored, message = await asyncio.to_thread(
            self._sync_rollback, repo_path, commit_hash
        )

        # 3. Record rollback in DB if project_id provided
        if success and project_id:
            try:
                async with AsyncSessionLocal() as session:
                    rec = GitCheckpoint(
                        project_id=project_id,
                        commit_hash=commit_hash,
                        branch="HEAD",
                        message=f"Rollback to checkpoint {commit_hash[:7]}",
                        author="AutonomousDev Agent",
                        type="rollback",
                        files_changed=files_restored,
                        is_autonomous=True,
                        created_at=datetime.now(timezone.utc)
                    )
                    session.add(rec)
                    await session.commit()
            except Exception:
                pass

        return RollbackResult(
            success=success,
            files_restored=files_restored,
            message=message
        )

    async def get_checkpoints(self, project_id: str) -> List[GitCheckpoint]:
        async with AsyncSessionLocal() as session:
            stmt = (
                select(GitCheckpoint)
                .where(GitCheckpoint.project_id == project_id)
                .order_by(GitCheckpoint.created_at.desc())
            )
            result = await session.execute(stmt)
            return list(result.scalars().all())

    def _sync_get_log(self, repo_path: str, max_entries: int = 20) -> List[GitLogEntry]:
        repo = self._get_repo(repo_path)
        if not repo or not repo.head.is_valid():
            return []

        entries: List[GitLogEntry] = []
        try:
            commits = list(repo.iter_commits(max_count=max_entries))
            for c in commits:
                files_count = 0
                try:
                    files_count = len(c.stats.files)
                except Exception:
                    files_count = 0

                entries.append(GitLogEntry(
                    hash=c.hexsha,
                    short_hash=c.hexsha[:7],
                    message=c.message.strip(),
                    author=c.author.name if c.author else "Unknown",
                    date=c.authored_datetime.isoformat() if hasattr(c, "authored_datetime") else "",
                    files_changed=files_count
                ))
        except Exception:
            pass

        return entries

    async def get_log(self, repo_path: str, max_entries: int = 20) -> List[GitLogEntry]:
        return await asyncio.to_thread(self._sync_get_log, repo_path, max_entries)

    def _sync_get_branches(self, repo_path: str) -> List[str]:
        repo = self._get_repo(repo_path)
        if not repo:
            return []
        try:
            branches = [h.name for h in repo.heads]
            if not branches:
                try:
                    branches = [repo.active_branch.name]
                except Exception:
                    branches = ["main"]
            return branches
        except Exception:
            return ["main"]

    async def get_branches(self, repo_path: str) -> List[str]:
        return await asyncio.to_thread(self._sync_get_branches, repo_path)

    def _sync_create_branch(self, repo_path: str, branch_name: str) -> bool:
        repo = self._ensure_repo(repo_path)
        try:
            repo.git.branch(branch_name)
            return True
        except Exception as e:
            raise RuntimeError(f"Failed to create branch {branch_name}: {str(e)}")

    async def create_branch(self, repo_path: str, branch_name: str) -> bool:
        return await asyncio.to_thread(self._sync_create_branch, repo_path, branch_name)

    def _sync_switch_branch(self, repo_path: str, branch_name: str) -> bool:
        repo = self._get_repo(repo_path)
        if not repo:
            return False
        try:
            repo.git.checkout(branch_name)
            return True
        except Exception as e:
            raise RuntimeError(f"Failed to checkout branch {branch_name}: {str(e)}")

    async def switch_branch(self, repo_path: str, branch_name: str) -> bool:
        return await asyncio.to_thread(self._sync_switch_branch, repo_path, branch_name)

    # Synchronous compatibility layer for legacy calls
    def rollback(self, project_path: str, commit_hash: str) -> Dict[str, Any]:
        success, files_restored, message = self._sync_rollback(project_path, commit_hash)
        if not success:
            raise RuntimeError(message)
        return {
            "success": True,
            "message": message,
            "current_commit": commit_hash,
            "files_restored": files_restored
        }


git_service = GitService()
