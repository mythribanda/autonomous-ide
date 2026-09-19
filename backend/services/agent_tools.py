import os
import re
import time
import shutil
import asyncio
import difflib
import fnmatch
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Optional, Tuple, Any, Callable

from backend.schemas import (
    ToolCall,
    ToolResult,
    PermissionTag,
    AgentPermissions,
    FileAnalysis,
    KnowledgeGraphResult,
)
from backend.services.git_service import git_service
from backend.services.ast_analyzer import ast_analyzer, LANGUAGE_MAP
from backend.services.knowledge_graph import knowledge_graph
from backend.services.project_scanner import ProjectScanner

# Common directories to skip
IGNORED_DIRS = {
    "node_modules",
    ".git",
    "__pycache__",
    "dist",
    "build",
    ".autonomous_ide_trash",
    ".next",
    ".nuxt",
    ".output",
    "target",
    "vendor",
    ".venv",
    "venv",
    ".idea",
    ".vscode",
    "coverage",
    ".pytest_cache",
    ".turbo",
    ".cache"
}

# In-memory rollback store for write_file: resolved_path -> list of previous versions
_file_rollback_history: Dict[str, List[str]] = defaultdict(list)

# In-memory cache for knowledge graph: workspace_path -> (timestamp, graph)
_knowledge_graph_cache: Dict[str, Tuple[float, KnowledgeGraphResult]] = {}

# Dangerous command regex patterns for run_command
DANGEROUS_COMMAND_PATTERNS = [
    (re.compile(r"\brm\b", re.IGNORECASE), "rm"),
    (re.compile(r"\brmdir\b", re.IGNORECASE), "rmdir"),
    (re.compile(r"\bdrop\b", re.IGNORECASE), "drop"),
    (re.compile(r"\bdelete\b", re.IGNORECASE), "delete"),
    (re.compile(r"\bformat\b", re.IGNORECASE), "format"),
    (re.compile(r"\bmkfs\b", re.IGNORECASE), "mkfs"),
    (re.compile(r"\bdd\b", re.IGNORECASE), "dd"),
    (re.compile(r"\bcurl\b", re.IGNORECASE), "curl"),
    (re.compile(r"\bwget\b", re.IGNORECASE), "wget"),
    (re.compile(r"\bsudo\b", re.IGNORECASE), "sudo"),
    (re.compile(r"\bchmod\s+777\b", re.IGNORECASE), "chmod 777"),
    (re.compile(r"\bnpm\s+publish\b", re.IGNORECASE), "npm publish"),
    (re.compile(r"\bgit\s+push\b", re.IGNORECASE), "git push"),
    (re.compile(r"\bpip\s+install\b", re.IGNORECASE), "pip install (suggest venv instead)"),
]


def check_dangerous_command(command: str) -> Tuple[bool, Optional[str]]:
    """Checks if a shell command matches any dangerous patterns."""
    for pattern, name in DANGEROUS_COMMAND_PATTERNS:
        if pattern.search(command):
            return True, name
    return False, None


def _resolve_workspace_path(path_str: str, workspace_path: str) -> Tuple[Optional[Path], Optional[str]]:
    """
    Resolves path_str relative to workspace_path and verifies it stays within workspace boundaries.
    Prevents path traversal attacks.
    """
    try:
        ws = Path(workspace_path).resolve()
        p = Path(path_str)
        if p.is_absolute():
            target = p.resolve()
        else:
            target = (ws / path_str).resolve()
        # Verify target is within workspace
        target.relative_to(ws)
        return target, None
    except ValueError:
        return None, f"Path '{path_str}' is outside the workspace boundary ({workspace_path})"
    except Exception as e:
        return None, f"Invalid path '{path_str}': {str(e)}"


def get_file_rollback_history(file_path: str, workspace_path: str = ".") -> List[str]:
    """Returns previous in-memory content versions of a file."""
    target, _ = _resolve_workspace_path(file_path, workspace_path)
    if target and str(target) in _file_rollback_history:
        return list(_file_rollback_history[str(target)])
    return []


def rollback_file_last_version(file_path: str, workspace_path: str = ".") -> Optional[str]:
    """Restores the most recent in-memory version of a file before its last write_file call."""
    target, _ = _resolve_workspace_path(file_path, workspace_path)
    if target and str(target) in _file_rollback_history and _file_rollback_history[str(target)]:
        previous_content = _file_rollback_history[str(target)].pop()
        target.write_text(previous_content, encoding="utf-8")
        return previous_content
    return None


def _get_or_build_cached_graph(project_path: str) -> KnowledgeGraphResult:
    """Builds or retrieves cached KnowledgeGraph for the workspace."""
    now = time.time()
    if project_path in _knowledge_graph_cache:
        timestamp, cached_graph = _knowledge_graph_cache[project_path]
        if now - timestamp < 30.0:
            return cached_graph

    p = Path(project_path).resolve()
    scan_result = ProjectScanner()._scan_sync(p)
    file_analyses: List[FileAnalysis] = []
    for root, dirs, filenames in os.walk(p):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]
        for fname in filenames:
            fp = Path(root) / fname
            ext = fp.suffix.lower()
            if ext in LANGUAGE_MAP:
                fa = ast_analyzer.analyze_file(str(fp), LANGUAGE_MAP[ext])
                file_analyses.append(fa)
                if len(file_analyses) >= 100:
                    break
        if len(file_analyses) >= 100:
            break

    kg_result = knowledge_graph.build_graph(project_path, file_analyses, scan_result)
    _knowledge_graph_cache[project_path] = (now, kg_result)
    return kg_result


# ---------------------------------------------------------------------------
# FILESYSTEM TOOLS
# ---------------------------------------------------------------------------

async def read_file(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    Read file at path (must be within workspace boundary). Return content as string.
    Return error if file not found or outside workspace.
    """
    try:
        ws = call.args.get("workspace_path", workspace_path)
        path = call.args.get("path")
        if not path:
            return ToolResult(success=False, error="Argument 'path' is required")

        target, err = _resolve_workspace_path(path, ws)
        if err:
            return ToolResult(success=False, error=err)
        if not target.exists() or not target.is_file():
            return ToolResult(success=False, error=f"File not found: {path}")

        content = target.read_text(encoding="utf-8", errors="replace")
        return ToolResult(success=True, output=content)
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to read file: {str(e)}")


async def write_file(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    Write content to path. Create parent directories if needed. Return {bytes_written: int}.
    Before writing, store old content in memory for rollback.
    """
    try:
        ws = call.args.get("workspace_path", workspace_path)
        perms = permissions or AgentPermissions()
        if not perms.is_allowed(PermissionTag.FILE_WRITE.value):
            return ToolResult(
                requires_approval=True,
                success=False,
                error=f"Requires human approval: {PermissionTag.FILE_WRITE.value} is required for write_file"
            )

        path = call.args.get("path")
        content = call.args.get("content")
        if path is None or content is None:
            return ToolResult(success=False, error="Arguments 'path' and 'content' are required")

        target, err = _resolve_workspace_path(path, ws)
        if err:
            return ToolResult(success=False, error=err)

        # Store old content in memory for rollback if file exists
        if target.exists() and target.is_file():
            try:
                old_content = target.read_text(encoding="utf-8", errors="replace")
                _file_rollback_history[str(target)].append(old_content)
            except Exception:
                pass

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        bytes_written = len(content.encode("utf-8"))
        return ToolResult(success=True, output={"bytes_written": bytes_written})
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to write file: {str(e)}")


async def list_files(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    List files. Skip node_modules/, .git/, __pycache__/, dist/, build/.
    If pattern provided (e.g. "*.ts"), filter by it.
    Return {files: [str], count: int}.
    """
    try:
        ws = call.args.get("workspace_path", workspace_path)
        directory = call.args.get("directory", ".")
        recursive = bool(call.args.get("recursive", False))
        pattern = call.args.get("pattern")

        target_dir, err = _resolve_workspace_path(directory, ws)
        if err:
            return ToolResult(success=False, error=err)
        if not target_dir.exists() or not target_dir.is_dir():
            return ToolResult(success=False, error=f"Directory not found: {directory}")

        files: List[str] = []
        if recursive:
            for root, dirs, filenames in os.walk(target_dir):
                dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".git")]
                for fname in filenames:
                    file_path = Path(root) / fname
                    rel_p = file_path.relative_to(target_dir).as_posix()
                    if pattern:
                        if fnmatch.fnmatch(fname, pattern) or fnmatch.fnmatch(rel_p, pattern):
                            files.append(rel_p)
                    else:
                        files.append(rel_p)
        else:
            for item in target_dir.iterdir():
                if item.name in IGNORED_DIRS or item.name.startswith(".git"):
                    continue
                if item.is_file():
                    fname = item.name
                    if pattern:
                        if fnmatch.fnmatch(fname, pattern):
                            files.append(fname)
                    else:
                        files.append(fname)

        files.sort()
        return ToolResult(success=True, output={"files": files, "count": len(files)})
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to list files: {str(e)}")


async def search_in_files(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    Search for text inside files. Return matches: [{file: str, line: int, text: str}].
    Cap at max_results.
    """
    try:
        ws = call.args.get("workspace_path", workspace_path)
        query = call.args.get("query", "")
        directory = call.args.get("directory", ".")
        case_sensitive = bool(call.args.get("case_sensitive", False))
        max_results = int(call.args.get("max_results", 50))

        if not query:
            return ToolResult(success=False, error="Argument 'query' is required")

        target_dir, err = _resolve_workspace_path(directory, ws)
        if err:
            return ToolResult(success=False, error=err)
        if not target_dir.exists() or not target_dir.is_dir():
            return ToolResult(success=False, error=f"Directory not found: {directory}")

        matches: List[Dict[str, Any]] = []
        target_query = query if case_sensitive else query.lower()

        for root, dirs, filenames in os.walk(target_dir):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".git")]
            for fname in filenames:
                fp = Path(root) / fname
                try:
                    if fp.stat().st_size > 1024 * 1024:  # skip files > 1MB
                        continue
                    text = fp.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    continue

                rel_path = fp.relative_to(target_dir).as_posix()
                for line_idx, line in enumerate(text.splitlines(), start=1):
                    compare_line = line if case_sensitive else line.lower()
                    if target_query in compare_line:
                        matches.append({
                            "file": rel_path,
                            "line": line_idx,
                            "text": line.strip()[:200]
                        })
                        if len(matches) >= max_results:
                            return ToolResult(success=True, output=matches)

        return ToolResult(success=True, output=matches)
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to search in files: {str(e)}")


async def create_file(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    Create new file. Error if already exists. Return {path: str, created: bool}.
    """
    try:
        ws = call.args.get("workspace_path", workspace_path)
        perms = permissions or AgentPermissions()
        if not perms.is_allowed(PermissionTag.FILE_WRITE.value):
            return ToolResult(
                requires_approval=True,
                success=False,
                error=f"Requires human approval: {PermissionTag.FILE_WRITE.value} is required for create_file"
            )

        path = call.args.get("path")
        content = call.args.get("content", "")
        if not path:
            return ToolResult(success=False, error="Argument 'path' is required")

        target, err = _resolve_workspace_path(path, ws)
        if err:
            return ToolResult(success=False, error=err)
        if target.exists():
            return ToolResult(success=False, error=f"File already exists: {path}")

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return ToolResult(success=True, output={"path": path, "created": True})
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to create file: {str(e)}")


async def delete_file(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    Delete file. Soft delete — move to .autonomous_ide_trash/ inside workspace.
    Requires user permission (tag: "file_delete").
    Return {path: str, deleted: bool, trash_path: str}.
    """
    try:
        perms = permissions or AgentPermissions()
        if not perms.is_allowed(PermissionTag.FILE_DELETE.value):
            return ToolResult(
                requires_approval=True,
                success=False,
                error="Requires human approval: file_delete is required for delete_file"
            )

        ws = call.args.get("workspace_path", workspace_path)
        path = call.args.get("path")
        if not path:
            return ToolResult(success=False, error="Argument 'path' is required")

        target, err = _resolve_workspace_path(path, ws)
        if err:
            return ToolResult(success=False, error=err)
        if not target.exists():
            return ToolResult(success=False, error=f"File not found: {path}")

        ws_path = Path(ws).resolve()
        trash_dir = ws_path / ".autonomous_ide_trash"
        trash_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        trash_dest = trash_dir / f"{timestamp}_{target.name}"
        shutil.move(str(target), str(trash_dest))
        trash_rel = trash_dest.relative_to(ws_path).as_posix()

        return ToolResult(
            success=True,
            output={"path": path, "deleted": True, "trash_path": trash_rel}
        )
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to delete file: {str(e)}")


async def get_file_diff(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    Return unified diff between existing file content and new_content.
    Return {path: str, diff: str, lines_added: int, lines_removed: int}.
    """
    try:
        ws = call.args.get("workspace_path", workspace_path)
        path = call.args.get("path")
        new_content = call.args.get("new_content", "")
        if not path:
            return ToolResult(success=False, error="Argument 'path' is required")

        target, err = _resolve_workspace_path(path, ws)
        if err:
            return ToolResult(success=False, error=err)

        if target.exists() and target.is_file():
            old_content = target.read_text(encoding="utf-8", errors="replace")
        else:
            old_content = ""

        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)
        diff_lines = list(difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=f"a/{path}",
            tofile=f"b/{path}"
        ))
        diff_str = "".join(diff_lines)
        lines_added = sum(1 for line in diff_lines if line.startswith("+") and not line.startswith("+++"))
        lines_removed = sum(1 for line in diff_lines if line.startswith("-") and not line.startswith("---"))

        return ToolResult(
            success=True,
            output={
                "path": path,
                "diff": diff_str,
                "lines_added": lines_added,
                "lines_removed": lines_removed
            }
        )
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to compute file diff: {str(e)}")


# ---------------------------------------------------------------------------
# TERMINAL TOOLS
# ---------------------------------------------------------------------------

async def run_command(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    Run shell command asynchronously with timeout.
    Capture stdout and stderr.
    Dangerous commands require user permission (tag: "command_dangerous"):
    - Any command containing: rm, rmdir, drop, delete, format, mkfs, dd
    - Network commands: curl, wget
    - Privilege commands: sudo, chmod 777
    - Package publish: npm publish
    - Push commands: git push
    - Package install: pip install (suggest venv instead)
    Return {command: str, stdout: str, stderr: str, returncode: int, timed_out: bool}.
    """
    try:
        command = call.args.get("command")
        if not command:
            return ToolResult(success=False, error="Argument 'command' is required")

        timeout = int(call.args.get("timeout", 30))
        cwd = call.args.get("cwd")
        ws = call.args.get("workspace_path", workspace_path)

        # Detect dangerous command
        is_dangerous, _ = check_dangerous_command(command)
        perms = permissions or AgentPermissions()

        if is_dangerous:
            if not perms.is_allowed(PermissionTag.COMMAND_DANGEROUS.value):
                return ToolResult(
                    requires_approval=True,
                    success=False,
                    error="Requires human approval: command_dangerous is required for run_command"
                )
        else:
            if not perms.is_allowed(PermissionTag.COMMAND_RUN.value):
                return ToolResult(
                    requires_approval=True,
                    success=False,
                    error="Requires human approval: command_run is required for run_command"
                )

        if cwd:
            effective_cwd, err = _resolve_workspace_path(cwd, ws)
            if err:
                return ToolResult(success=False, error=err)
        else:
            effective_cwd = Path(ws).resolve()

        if not effective_cwd.exists() or not effective_cwd.is_dir():
            return ToolResult(success=False, error=f"Working directory not found: {effective_cwd}")

        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(effective_cwd)
        )

        timed_out = False
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(),
                timeout=float(timeout)
            )
            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")
            returncode = proc.returncode if proc.returncode is not None else 0
        except asyncio.TimeoutError:
            timed_out = True
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass
            stdout = ""
            stderr = f"Command timed out after {timeout} seconds"
            returncode = -1

        output_data = {
            "command": command,
            "stdout": stdout,
            "stderr": stderr,
            "returncode": returncode,
            "timed_out": timed_out
        }
        return ToolResult(
            success=(returncode == 0 and not timed_out),
            output=output_data,
            error=stderr if (returncode != 0 or timed_out) else None
        )
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to run command: {str(e)}")


# ---------------------------------------------------------------------------
# GIT TOOLS
# ---------------------------------------------------------------------------

async def git_status(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    Run git status, return clean summary:
    {branch: str, clean: bool, modified: [str], untracked: [str], staged: [str]}.
    """
    try:
        perms = permissions or AgentPermissions()
        if not perms.is_allowed(PermissionTag.READ_ONLY.value):
            return ToolResult(
                requires_approval=True,
                success=False,
                error=f"Requires human approval: {PermissionTag.READ_ONLY.value} is required for git_status"
            )

        ws = call.args.get("workspace_path", workspace_path)
        status = git_service.get_status(ws)
        output = {
            "branch": status.get("branch", "none"),
            "clean": status.get("is_clean", True),
            "modified": status.get("modified_files", []),
            "untracked": status.get("untracked_files", []),
            "staged": status.get("staged_files", []),
        }
        return ToolResult(success=True, output=output)
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to get git status: {str(e)}")


async def git_checkpoint(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    git add -A && git commit -m "CHECKPOINT: {message}"
    Return {commit_hash: str, message: str, files_changed: int}.
    """
    try:
        perms = permissions or AgentPermissions()
        if not perms.is_allowed(PermissionTag.GIT_WRITE.value):
            return ToolResult(
                requires_approval=True,
                success=False,
                error=f"Requires human approval: {PermissionTag.GIT_WRITE.value} is required for git_checkpoint"
            )

        ws = call.args.get("workspace_path", workspace_path)
        message = call.args.get("message", "Auto-checkpoint")
        formatted_message = f"CHECKPOINT: {message}"
        res = git_service.create_checkpoint(ws, formatted_message)
        output = {
            "commit_hash": res.get("commit_hash", ""),
            "message": formatted_message,
            "files_changed": res.get("files_changed", 0),
        }
        return ToolResult(success=True, output=output)
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to create git checkpoint: {str(e)}")


async def git_diff(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    git diff (or git diff --cached if staged).
    Return {diff: str}.
    """
    try:
        perms = permissions or AgentPermissions()
        if not perms.is_allowed(PermissionTag.READ_ONLY.value):
            return ToolResult(
                requires_approval=True,
                success=False,
                error=f"Requires human approval: {PermissionTag.READ_ONLY.value} is required for git_diff"
            )

        ws = call.args.get("workspace_path", workspace_path)
        staged = bool(call.args.get("staged", False))
        repo = git_service._get_repo(ws)
        if not repo:
            return ToolResult(success=False, error="Git repository not found in workspace")

        if staged:
            diff_str = repo.git.diff("--cached") if repo.head.is_valid() else repo.git.diff("--cached")
        else:
            diff_str = repo.git.diff()
        return ToolResult(success=True, output={"diff": diff_str})
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to get git diff: {str(e)}")


async def git_rollback(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    Rollback to commit. Requires user permission (tag: "git_write").
    Return {success: bool, current_commit: str}.
    """
    try:
        perms = permissions or AgentPermissions()
        if not perms.is_allowed(PermissionTag.GIT_WRITE.value):
            return ToolResult(
                requires_approval=True,
                success=False,
                error=f"Requires human approval: {PermissionTag.GIT_WRITE.value} is required for git_rollback"
            )

        ws = call.args.get("workspace_path", workspace_path)
        commit_hash = call.args.get("commit_hash")
        if not commit_hash:
            return ToolResult(success=False, error="Argument 'commit_hash' is required")

        git_service.rollback(ws, commit_hash)
        repo = git_service._get_repo(ws)
        curr = repo.head.commit.hexsha if repo and repo.head.is_valid() else commit_hash
        return ToolResult(
            success=True,
            output={"success": True, "current_commit": curr}
        )
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to rollback git: {str(e)}")


# ---------------------------------------------------------------------------
# ANALYSIS TOOLS
# ---------------------------------------------------------------------------

async def read_ast_info(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    Return AST analysis for file (functions, classes, imports, routes, complexity).
    Use existing ast_analyzer service.
    """
    try:
        perms = permissions or AgentPermissions()
        if not perms.is_allowed(PermissionTag.READ_ONLY.value):
            return ToolResult(
                requires_approval=True,
                success=False,
                error=f"Requires human approval: {PermissionTag.READ_ONLY.value} is required for read_ast_info"
            )

        ws = call.args.get("workspace_path", workspace_path)
        path = call.args.get("path")
        if not path:
            return ToolResult(success=False, error="Argument 'path' is required")

        target, err = _resolve_workspace_path(path, ws)
        if err:
            return ToolResult(success=False, error=err)
        if not target.exists() or not target.is_file():
            return ToolResult(success=False, error=f"File not found: {path}")

        ext = target.suffix.lower()
        lang = LANGUAGE_MAP.get(ext)
        if not lang:
            return ToolResult(success=False, error=f"Unsupported language or file type for AST analysis: {ext}")

        analysis = ast_analyzer.analyze_file(str(target), lang)
        return ToolResult(success=True, output=analysis.model_dump())
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to read AST info: {str(e)}")


async def get_relevant_files(call: ToolCall, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None) -> ToolResult:
    """
    Return files most relevant to requirement.
    Use existing knowledge_graph.get_relevant_context.
    """
    try:
        perms = permissions or AgentPermissions()
        if not perms.is_allowed(PermissionTag.READ_ONLY.value):
            return ToolResult(
                requires_approval=True,
                success=False,
                error=f"Requires human approval: {PermissionTag.READ_ONLY.value} is required for get_relevant_files"
            )

        ws = call.args.get("workspace_path", workspace_path)
        requirement = call.args.get("requirement")
        if not requirement:
            return ToolResult(success=False, error="Argument 'requirement' is required")
        max_files = int(call.args.get("max_files", 5))

        ws_path = Path(ws).resolve()
        graph = _get_or_build_cached_graph(str(ws_path))
        contexts = knowledge_graph.get_relevant_context(
            requirement=requirement,
            graph=graph,
            max_files=max_files,
            project_path=str(ws_path)
        )
        return ToolResult(success=True, output=[c.model_dump() for c in contexts])
    except Exception as e:
        return ToolResult(success=False, error=f"Failed to get relevant files: {str(e)}")


# ---------------------------------------------------------------------------
# TOOL REGISTRY AND DISPATCHER
# ---------------------------------------------------------------------------

TOOL_REGISTRY: Dict[str, Callable] = {
    "read_file": read_file,
    "write_file": write_file,
    "list_files": list_files,
    "search_in_files": search_in_files,
    "create_file": create_file,
    "delete_file": delete_file,
    "get_file_diff": get_file_diff,
    "run_command": run_command,
    "git_status": git_status,
    "git_checkpoint": git_checkpoint,
    "git_diff": git_diff,
    "git_rollback": git_rollback,
    "read_ast_info": read_ast_info,
    "get_relevant_files": get_relevant_files,
}

TOOL_PERMISSIONS: Dict[str, PermissionTag] = {
    "read_file": PermissionTag.READ_ONLY,
    "list_files": PermissionTag.READ_ONLY,
    "search_in_files": PermissionTag.READ_ONLY,
    "get_file_diff": PermissionTag.READ_ONLY,
    "git_status": PermissionTag.READ_ONLY,
    "git_diff": PermissionTag.READ_ONLY,
    "read_ast_info": PermissionTag.READ_ONLY,
    "get_relevant_files": PermissionTag.READ_ONLY,
    "write_file": PermissionTag.FILE_WRITE,
    "create_file": PermissionTag.FILE_WRITE,
    "delete_file": PermissionTag.FILE_DELETE,
    "git_checkpoint": PermissionTag.GIT_WRITE,
    "git_rollback": PermissionTag.GIT_WRITE,
}


async def execute_tool(
    call: ToolCall,
    workspace_path: str = ".",
    permissions: Optional[AgentPermissions] = None
) -> ToolResult:
    """
    Executes a ToolCall after verifying permissions and routing to the appropriate tool handler.
    Guaranteed to never raise an unhandled exception.
    """
    try:
        perms = permissions or AgentPermissions()
        tool_fn = TOOL_REGISTRY.get(call.tool_name)
        if not tool_fn:
            return ToolResult(
                success=False,
                error=f"Unknown tool: '{call.tool_name}'. Available tools: {list(TOOL_REGISTRY.keys())}"
            )

        # Check static permissions
        req_tag = TOOL_PERMISSIONS.get(call.tool_name)
        if req_tag and not perms.is_allowed(req_tag.value):
            return ToolResult(
                requires_approval=True,
                success=False,
                error=f"Requires human approval: {req_tag.value} is required for {call.tool_name}"
            )

        ws = call.args.get("workspace_path", workspace_path)
        return await tool_fn(call, workspace_path=ws, permissions=perms)
    except Exception as e:
        return ToolResult(success=False, error=f"Tool execution failed: {str(e)}")


class AgentToolRegistry:
    """
    Instance-based registry for executing tools bound to a specific workspace and permission set.
    """
    def __init__(self, workspace_path: str = ".", permissions: Optional[AgentPermissions] = None):
        self.workspace_path = workspace_path
        self.permissions = permissions or AgentPermissions()

    async def execute(self, call: ToolCall) -> ToolResult:
        return await execute_tool(call, self.workspace_path, self.permissions)
