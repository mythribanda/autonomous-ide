from pathlib import Path
from typing import Dict, Any, List, Optional
import git

class GitService:
    def _get_repo(self, project_path: str) -> Optional[git.Repo]:
        p = Path(project_path)
        if not p.exists():
            return None
        try:
            return git.Repo(p, search_parent_directories=True)
        except (git.InvalidGitRepositoryError, git.NoSuchPathError):
            return None

    def get_status(self, project_path: str) -> Dict[str, Any]:
        repo = self._get_repo(project_path)
        if not repo:
            return {
                "project_path": project_path,
                "branch": "none",
                "is_clean": True,
                "modified_files": [],
                "untracked_files": [],
                "staged_files": []
            }

        try:
            branch = repo.active_branch.name
        except TypeError:
            branch = "HEAD (detached)"

        untracked = repo.untracked_files
        modified = [item.a_path for item in repo.index.diff(None)]
        staged = [item.a_path for item in repo.index.diff("HEAD")] if repo.head.is_valid() else []

        is_clean = len(untracked) == 0 and len(modified) == 0 and len(staged) == 0

        return {
            "project_path": project_path,
            "branch": branch,
            "is_clean": is_clean,
            "modified_files": modified,
            "untracked_files": untracked,
            "staged_files": staged
        }

    def create_checkpoint(self, project_path: str, message: str, author_name: str = "AutonomousDev Agent") -> Dict[str, Any]:
        repo = self._get_repo(project_path)
        if not repo:
            # Initialize repo if not already one
            repo = git.Repo.init(project_path)

        try:
            repo.git.add(A=True)
            actor = git.Actor(author_name, "agent@autonomous-ide.local")
            commit = repo.index.commit(message, author=actor, committer=actor)
            try:
                branch = repo.active_branch.name
            except Exception:
                branch = "main"

            return {
                "commit_hash": commit.hexsha,
                "branch": branch,
                "files_changed": len(commit.stats.files)
            }
        except Exception as e:
            raise RuntimeError(f"Failed to create git checkpoint: {str(e)}")

    def rollback(self, project_path: str, commit_hash: str) -> Dict[str, Any]:
        repo = self._get_repo(project_path)
        if not repo:
            raise RuntimeError("Repository not found")

        try:
            repo.git.checkout(commit_hash, force=True)
            return {
                "success": True,
                "message": f"Successfully rolled back to commit {commit_hash}",
                "current_commit": repo.head.commit.hexsha
            }
        except Exception as e:
            raise RuntimeError(f"Rollback failed: {str(e)}")

    def get_diff(self, project_path: str, file_path: Optional[str] = None) -> str:
        repo = self._get_repo(project_path)
        if not repo:
            return ""
        try:
            if file_path:
                if repo.head.is_valid():
                    diff = repo.git.diff("HEAD", file_path)
                else:
                    diff = repo.git.diff(file_path)
                if not diff:
                    diff = repo.git.diff(file_path)
                return diff
            return repo.git.diff("HEAD") if repo.head.is_valid() else repo.git.diff()
        except Exception:
            try:
                return repo.git.diff(file_path) if file_path else repo.git.diff()
            except Exception:
                return ""

git_service = GitService()
