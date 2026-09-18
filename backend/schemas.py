from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict, Field

# Common Error Schema
class ErrorResponse(BaseModel):
    detail: str
    code: str

# Projects
class ProjectOpenRequest(BaseModel):
    path: str
    name: Optional[str] = None

class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    path: str
    language: Optional[str] = None
    framework: Optional[str] = None
    last_opened: datetime
    created_at: datetime
    config_json: Optional[str] = None

# Tasks
class TaskCreateRequest(BaseModel):
    project_id: str
    requirement: str
    compiled_spec_json: Optional[str] = None

class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    requirement: str
    compiled_spec_json: Optional[str] = None
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    execution_time_seconds: Optional[float] = None
    files_changed: int = 0
    tests_passed: int = 0
    tests_failed: int = 0
    recovery_attempts: int = 0
    human_interventions: int = 0

class TaskEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    timestamp: datetime
    event_type: str
    message: str
    data_json: Optional[str] = None

# Agent
class AgentExecuteRequest(BaseModel):
    task_id: str
    prompt: Optional[str] = None
    autonomy_level: Optional[str] = "autonomous"
    target_files: Optional[List[str]] = None

class AgentStopRequest(BaseModel):
    task_id: str

class AgentStatusResponse(BaseModel):
    task_id: str
    status: str
    progress: float
    current_activity: Optional[str] = None

# Filesystem
class FileItem(BaseModel):
    name: str
    path: str
    is_dir: bool
    size: Optional[int] = None

class FileListResponse(BaseModel):
    path: str
    items: List[FileItem]

class FileReadResponse(BaseModel):
    path: str
    content: str
    size: int

class FileWriteRequest(BaseModel):
    path: str
    content: str

class FileWriteResponse(BaseModel):
    path: str
    success: bool
    bytes_written: int

class FileDiffRequest(BaseModel):
    path: str
    modified_content: str

class FileDiffResponse(BaseModel):
    path: str
    diff: str
    has_changes: bool

# Terminal
class TerminalExecuteRequest(BaseModel):
    command: str
    cwd: Optional[str] = None
    timeout_seconds: Optional[int] = 60

class TerminalExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: float

# Git
class GitStatusResponse(BaseModel):
    project_path: str
    branch: str
    is_clean: bool
    modified_files: List[str]
    untracked_files: List[str]
    staged_files: List[str]

class GitCheckpointRequest(BaseModel):
    project_id: str
    project_path: str
    message: str
    type: Optional[str] = "ai_post_change"
    author: Optional[str] = "AutonomousDev Agent"

class GitCheckpointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    commit_hash: str
    branch: str
    message: str
    author: str
    type: str
    files_changed: int
    created_at: datetime

class GitRollbackRequest(BaseModel):
    project_path: str
    commit_hash: str

class GitRollbackResponse(BaseModel):
    success: bool
    message: str
    current_commit: str

# Health
class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"

class OllamaHealthResponse(BaseModel):
    connected: bool
    models: List[str] = Field(default_factory=list)
    error: Optional[str] = None
