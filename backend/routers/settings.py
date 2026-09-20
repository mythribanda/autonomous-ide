import json
import os
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter(prefix="/settings", tags=["settings"])

SETTINGS_FILE = Path.home() / ".autonomous-ide" / "settings.json"


def _get_default_settings() -> Dict[str, Any]:
    return {
        # Section 1: AI & Models
        "ollama_url": "http://localhost:11434",
        "model": "llama3.2:latest",
        "planning_model": "llama3.2:latest",
        "coding_model": "codellama:13b",
        "diagnosis_model": "llama3.2:latest",
        "summarization_model": "llama3.2:latest",
        "temperature": 0.2,
        "max_tokens": 2000,

        # Section 2: Agent Permissions
        "autonomy_level": "autonomous",
        "permission_profile": "standard",
        "max_files_per_task": 15,
        "auto_approve_tests": true if True else True,
        "auto_approve_builds": true if True else True,
        "permissions": {
            "readFile": True,
            "writeFile": True,
            "runTests": True,
            "runDevCommands": True,
            "gitStatus": True,
            "gitDiff": True,
            "gitCommit": True,
            "deleteFiles": False,
            "gitPush": False,
            "createPR": False,
            "deployApp": False
        },

        # Section 3: GitHub
        "github_connected": False,
        "github_username": "",
        "default_clone_directory": str(Path.home() / "Projects"),

        # Section 4: Appearance
        "editor_font_size": 14,
        "terminal_font_size": 13,
        "font_family": "JetBrains Mono",
        "theme": "dark-developer",

        # Section 5: Terminal
        "default_shell": "pwsh" if os.name == "nt" else "bash",
        "tab_size": 2,
        "scrollback_buffer": 2000,

        # Section 6: Keyboard Shortcuts (defaults stored)
        "shortcuts": {
            "command_palette": "Ctrl+Shift+P",
            "toggle_terminal": "Ctrl+`",
            "new_task": "Ctrl+K",
            "search_files": "Ctrl+P",
            "open_settings": "Ctrl+,",
            "save_file": "Ctrl+S",
            "toggle_git": "Ctrl+Shift+G"
        },

        # Section 7: Project Settings (current project)
        "project_name": "Autonomous IDE",
        "excluded_paths": "node_modules, dist, .git, build, .venv",
        "pre_run_command": "",
        "test_command_override": "",

        # Section 8: About / Research
        "app_version": "1.0.0",
        "research_mode": True,
        "telemetry": False,
        "notifications": True
    }


def _read_settings_file() -> Dict[str, Any]:
    defaults = _get_default_settings()
    if not SETTINGS_FILE.exists():
        return defaults
    try:
        content = SETTINGS_FILE.read_text(encoding="utf-8")
        data = json.loads(content)
        # Merge with defaults to ensure all keys present
        merged = {**defaults, **data}
        if "permissions" in data and isinstance(data["permissions"], dict):
            merged["permissions"] = {**defaults["permissions"], **data["permissions"]}
        return merged
    except Exception:
        return defaults


def _write_settings_file(settings: Dict[str, Any]) -> bool:
    try:
        SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        SETTINGS_FILE.write_text(json.dumps(settings, indent=2), encoding="utf-8")
        return True
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist settings: {e}"
        )


@router.get("", response_model=Dict[str, Any])
async def get_settings():
    """Fetches system-wide persisted configuration."""
    return _read_settings_file()


@router.put("", response_model=Dict[str, Any])
async def update_settings(updates: Dict[str, Any]):
    """Updates system-wide persisted configuration."""
    current = _read_settings_file()
    for key, value in updates.items():
        if key == "permissions" and isinstance(value, dict) and "permissions" in current:
            current["permissions"].update(value)
        else:
            current[key] = value

    _write_settings_file(current)
    return current
