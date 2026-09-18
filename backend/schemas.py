from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict, Field

# Common Error Schema
class ErrorResponse(BaseModel):
    detail: str
    code: str

# Projects
class ProjectScanResult(BaseModel):
    languages: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    package_manager: Optional[str] = None
    entry_points: List[str] = Field(default_factory=list)
    config_files: Dict[str, str] = Field(default_factory=dict)
    test_framework: Optional[str] = None
    has_docker: bool = False
    has_git: bool = False
    has_ci: bool = False
    file_count: int = 0
    directory_structure: Dict[str, Any] = Field(default_factory=dict)
    detected_database: Optional[str] = None
    api_style: Optional[str] = None

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
    scan_result: Optional[ProjectScanResult] = None

# AST Analysis Schemas
class FunctionInfo(BaseModel):
    name: str
    line_start: int
    line_end: int
    parameters: List[str] = Field(default_factory=list)
    is_async: bool = False
    is_exported: bool = False

class ClassInfo(BaseModel):
    name: str
    line_start: int
    line_end: int
    methods: List[str] = Field(default_factory=list)
    extends: Optional[str] = None

class ImportInfo(BaseModel):
    module: str
    names: List[str] = Field(default_factory=list)
    is_default: bool = False
    line: int

class RouteInfo(BaseModel):
    method: str
    path: str
    handler_name: str
    line: int

class FileAnalysis(BaseModel):
    file_path: str
    language: str
    functions: List[FunctionInfo] = Field(default_factory=list)
    classes: List[ClassInfo] = Field(default_factory=list)
    imports: List[ImportInfo] = Field(default_factory=list)
    exports: List[str] = Field(default_factory=list)
    components: List[str] = Field(default_factory=list)
    api_routes: List[RouteInfo] = Field(default_factory=list)
    complexity_score: int = 1

class ProjectAnalysis(BaseModel):
    files: List[FileAnalysis] = Field(default_factory=list)
    total_functions: int = 0
    total_classes: int = 0
    component_tree: Dict[str, List[str]] = Field(default_factory=dict)

class AnalysisJobResponse(BaseModel):
    project_id: str
    status: str
    message: str
    files_count: int = 0

# Knowledge Graph
class GraphNode(BaseModel):
    id: str
    type: str  # "file" | "function" | "class" | "component" | "api_route" | "database_model"
    name: str
    file_path: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class GraphEdge(BaseModel):
    from_id: str
    to_id: str
    type: str  # "imports" | "calls" | "extends" | "renders" | "depends_on" | "defines_route" | "defines"

class KnowledgeGraphResult(BaseModel):
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)
    summary: str = ""

class FileContext(BaseModel):
    file_path: str
    relevance_score: float
    content_snippet: str
    reason: str

class ProjectSummaryResponse(BaseModel):
    summary: str

# Impact Analysis
class ImpactReport(BaseModel):
    directly_affected_files: List[str] = Field(default_factory=list)
    transitively_affected_files: List[str] = Field(default_factory=list)
    affected_api_routes: List[str] = Field(default_factory=list)
    affected_components: List[str] = Field(default_factory=list)
    affected_database_models: List[str] = Field(default_factory=list)
    tests_to_run: List[str] = Field(default_factory=list)
    risk_level: str  # "low" | "medium" | "high"
    risk_reasons: List[str] = Field(default_factory=list)
    estimated_files_to_change: int = 0

class ImpactAnalysisRequest(BaseModel):
    requirement: str

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
