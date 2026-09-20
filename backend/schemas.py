from datetime import datetime, timezone
from typing import Optional, List, Any, Dict, Union, Set
from enum import Enum
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
    has_dockerfile: bool = False
    has_compose: bool = False
    docker_daemon_running: bool = False
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
    risk_level: str = "low"  # "low" | "medium" | "high"
    risk_reasons: List[str] = Field(default_factory=list)
    estimated_files_to_change: int = 0

class ImpactAnalysisRequest(BaseModel):
    requirement: str

# Tasks
class TaskCreateRequest(BaseModel):
    project_id: str
    requirement: str
    mode: Optional[str] = "Guided"
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

class TaskDetailResponse(TaskResponse):
    compiled_spec: Optional[Dict[str, Any]] = None
    events: List[TaskEventResponse] = Field(default_factory=list)

class TaskReportResponse(BaseModel):
    task_id: str
    requirement: str
    status: str
    phases: Dict[str, List[TaskEventResponse]] = Field(default_factory=dict)
    verification_report: Optional[Dict[str, Any]] = None
    git_checkpoint: Optional[Dict[str, Any]] = None
    files_modified: List[str] = Field(default_factory=list)
    metrics: Dict[str, Any] = Field(default_factory=dict)


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

class ImplementationStep(BaseModel):
    step: int
    action: str
    file: str
    type: str  # "create" | "modify" | "delete"

class CompiledSpec(BaseModel):
    task_id: Optional[str] = None
    raw_requirement: str
    intent: str
    intent_category: str
    scope: str
    explicit_requirements: List[str] = Field(default_factory=list)
    ambiguities: List[str] = Field(default_factory=list)
    missing_info: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    implementation_steps: List[ImplementationStep] = Field(default_factory=list)
    new_files_needed: List[str] = Field(default_factory=list)
    acceptance_criteria: List[str] = Field(default_factory=list)
    test_cases: List[str] = Field(default_factory=list)
    affected_files: List[str] = Field(default_factory=list)
    impact_report: ImpactReport
    confidence_score: float
    error: Optional[str] = None

class AgentCompileRequest(BaseModel):
    requirement: str
    project_id: str
    task_id: Optional[str] = None

# Agent Tools & Permissions
class PermissionLevel(str, Enum):
    READ_ONLY = "READ_ONLY"
    FILE_WRITE = "FILE_WRITE"
    FILE_DELETE = "FILE_DELETE"
    COMMAND_RUN = "COMMAND_RUN"
    COMMAND_DANGEROUS = "COMMAND_DANGEROUS"
    GIT_WRITE = "GIT_WRITE"
    GIT_PUSH = "GIT_PUSH"
    NETWORK = "NETWORK"


class AgentPermissionConfig(BaseModel):
    allowed: Set[PermissionLevel] = Field(
        default_factory=lambda: {
            PermissionLevel.READ_ONLY,
            PermissionLevel.FILE_WRITE,
            PermissionLevel.COMMAND_RUN,
            PermissionLevel.GIT_WRITE,
        }
    )
    workspace_path: str = "."
    blocked_paths: List[str] = Field(default_factory=list)
    max_files_per_task: int = 20
    require_approval_for: List[PermissionLevel] = Field(
        default_factory=lambda: [
            PermissionLevel.FILE_DELETE,
            PermissionLevel.COMMAND_DANGEROUS,
            PermissionLevel.GIT_PUSH,
        ]
    )
    auto_approve_test_commands: bool = True
    auto_approve_build_commands: bool = True


class PermissionResult(BaseModel):
    allowed: bool
    requires_approval: bool
    reason: str


class CommandClassification(BaseModel):
    is_test: bool
    is_build: bool
    is_dangerous: bool
    required_permission: PermissionLevel
    risk_description: str


class SecretMatch(BaseModel):
    type: str
    pattern: str
    line_number: int
    redacted_preview: str


class PermissionCheckRequest(BaseModel):
    action: str
    path: Optional[str] = None


class PermissionTag(str, Enum):
    READ_ONLY = "read_only"
    FILE_WRITE = "file_write"
    FILE_DELETE = "file_delete"
    COMMAND_RUN = "command_run"
    COMMAND_DANGEROUS = "command_dangerous"
    GIT_WRITE = "git_write"

class AgentPermissions(BaseModel):
    allowed_tags: Set[str] = Field(default_factory=lambda: {
        PermissionTag.READ_ONLY.value,
        PermissionTag.FILE_WRITE.value,
        PermissionTag.COMMAND_RUN.value,
        PermissionTag.GIT_WRITE.value,
    })

    def is_allowed(self, tag: str) -> bool:
        return tag in self.allowed_tags

    def grant(self, tag: str):
        self.allowed_tags.add(tag)

    def revoke(self, tag: str):
        self.allowed_tags.discard(tag)

class ToolCall(BaseModel):
    tool_name: str
    args: Dict[str, Any] = Field(default_factory=dict)

class ToolResult(BaseModel):
    success: bool
    output: Union[str, Dict[str, Any], List[Any]] = ""
    error: Optional[str] = None
    requires_approval: bool = False

# Autonomous Agent State & Execution Models
class AgentStatus(str, Enum):
    QUEUED = "queued"
    PLANNING = "planning"
    EXECUTING = "executing"
    TESTING = "testing"
    RECOVERING = "recovering"
    WAITING_APPROVAL = "waiting_approval"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class AgentStep(BaseModel):
    step_id: str
    description: str
    tool: str
    tool_args: Dict[str, Any] = Field(default_factory=dict)
    status: str = "pending"  # "pending" | "running" | "done" | "failed" | "skipped"
    result: Optional[ToolResult] = None
    timestamp: Optional[datetime] = None

class Observation(BaseModel):
    step_id: str
    tool: str
    success: bool
    output: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RecoveryAttempt(BaseModel):
    attempt_number: int
    error: str
    diagnosis: str
    repair_action: str
    success: bool

class VerificationCheck(BaseModel):
    name: str
    passed: bool
    output: str = ""
    error: Optional[str] = None

class CriterionCheck(BaseModel):
    criterion: str
    met: bool
    evidence: str

class VerificationReport(BaseModel):
    build_status: VerificationCheck = Field(default_factory=lambda: VerificationCheck(name="build", passed=True, output="Skipped"))
    test_status: VerificationCheck = Field(default_factory=lambda: VerificationCheck(name="test", passed=True, output="Skipped"))
    lint_status: VerificationCheck = Field(default_factory=lambda: VerificationCheck(name="lint", passed=True, output="Skipped"))
    requirements_met: List[CriterionCheck] = Field(default_factory=list)
    files_changed_count: int = 0
    overall_success: bool = True
    summary: str = ""

    @property
    def passed(self) -> bool:
        return self.overall_success

    @property
    def checks(self) -> List[Dict[str, Any]]:
        return [
            {"name": "build", "passed": self.build_status.passed, "detail": self.build_status.output},
            {"name": "test", "passed": self.test_status.passed, "detail": self.test_status.output},
            {"name": "lint", "passed": self.lint_status.passed, "detail": self.lint_status.output},
        ] + [
            {"criterion": c.criterion, "passed": c.met, "detail": c.evidence}
            for c in self.requirements_met
        ]


class AgentResult(BaseModel):
    success: bool
    files_modified: List[str] = Field(default_factory=list)
    acceptance_criteria_met: List[str] = Field(default_factory=list)
    acceptance_criteria_failed: List[str] = Field(default_factory=list)
    recovery_attempts: int = 0
    human_interventions: int = 0
    execution_time_seconds: float = 0.0
    final_status: str = "completed"
    verification_report: Optional[VerificationReport] = None

class AgentState(BaseModel):
    task_id: str
    project_id: str
    compiled_spec: CompiledSpec
    plan: List[AgentStep] = Field(default_factory=list)
    current_step_index: int = 0
    observations: List[Observation] = Field(default_factory=list)
    status: AgentStatus = AgentStatus.QUEUED
    error_count: int = 0
    files_modified: List[str] = Field(default_factory=list)
    recovery_history: List[RecoveryAttempt] = Field(default_factory=list)


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
class GitStatus(BaseModel):
    branch: str
    is_clean: bool
    modified_files: List[str] = Field(default_factory=list)
    added_files: List[str] = Field(default_factory=list)
    deleted_files: List[str] = Field(default_factory=list)
    untracked_files: List[str] = Field(default_factory=list)
    ahead_by: int = 0
    behind_by: int = 0

    # Backward compatibility with existing GitStatusResponse
    project_path: Optional[str] = None
    staged_files: Optional[List[str]] = None

    model_config = ConfigDict(extra="ignore")


class CheckpointResult(BaseModel):
    commit_hash: str
    files_staged: int
    skipped: bool = False
    message: Optional[str] = None
    branch: Optional[str] = None
    id: Optional[str] = None


class FileDiff(BaseModel):
    file_path: str
    diff_text: str
    lines_added: int
    lines_removed: int
    old_content: Optional[str] = None
    new_content: Optional[str] = None


class RollbackResult(BaseModel):
    success: bool
    files_restored: int = 0
    message: str


class GitLogEntry(BaseModel):
    hash: str
    short_hash: str
    message: str
    author: str
    date: str
    files_changed: int = 0


class GitBranchCreateRequest(BaseModel):
    name: str


class GitCheckpointCreateBody(BaseModel):
    message: str
    task_id: Optional[str] = None


class GitRollbackBody(BaseModel):
    commit_hash: str


class GitStatusResponse(BaseModel):
    project_path: str
    branch: str
    is_clean: bool
    modified_files: List[str]
    untracked_files: List[str]
    staged_files: List[str]
    added_files: Optional[List[str]] = Field(default_factory=list)
    deleted_files: Optional[List[str]] = Field(default_factory=list)
    ahead_by: Optional[int] = 0
    behind_by: Optional[int] = 0


class GitCheckpointRequest(BaseModel):
    project_id: str
    project_path: str
    message: str
    type: Optional[str] = "ai_post_change"
    author: Optional[str] = "AutonomousDev Agent"
    task_id: Optional[str] = None


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
    task_id: Optional[str] = None
    is_autonomous: Optional[bool] = True


class GitRollbackRequest(BaseModel):
    project_path: str
    commit_hash: str


class GitRollbackResponse(BaseModel):
    success: bool
    message: str
    current_commit: str
    files_restored: Optional[int] = 0

# Health
class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"

class OllamaHealthResponse(BaseModel):
    connected: bool
    models: List[str] = Field(default_factory=list)
    error: Optional[str] = None

# Prompt Compilation
class AcceptanceCriteriaItem(BaseModel):
    id: str
    text: str
    completed: bool = False

class TechnicalPlan(BaseModel):
    frontend: str = ""
    backend: str = ""
    database: str = ""
    testing: str = ""
    architectureNotes: List[str] = Field(default_factory=list)

class PromptSpecificationResponse(BaseModel):
    id: str
    rawPrompt: str
    title: str
    qualityScore: int
    intent: str
    detectedRequirements: List[str] = Field(default_factory=list)
    ambiguities: List[str] = Field(default_factory=list)
    missingInformation: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    technicalPlan: TechnicalPlan = Field(default_factory=TechnicalPlan)
    acceptanceCriteria: List[AcceptanceCriteriaItem] = Field(default_factory=list)

class PromptCompileRequest(BaseModel):
    prompt: str
    project_id: Optional[str] = None


# Terminal
class TerminalExecuteRequest(BaseModel):
    command: str
    cwd: Optional[str] = None
    project_id: Optional[str] = None
    timeout_seconds: int = 30


class TerminalExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool = False
    execution_time_ms: float
    command_classification: Optional[CommandClassification] = None
    # Legacy alias kept for backward-compat with existing store
    duration_ms: Optional[float] = None


class TerminalHistoryItem(BaseModel):
    id: str
    command: str
    cwd: Optional[str] = None
    exit_code: Optional[int] = None
    timestamp: datetime
    project_id: str


class TerminalStreamMessage(BaseModel):
    type: str   # "stdout" | "stderr" | "exit" | "error"
    data: str
    exit_code: Optional[int] = None


# Dashboard Schemas
class RepoStats(BaseModel):
    file_count: int = 0
    languages: Dict[str, float] = Field(default_factory=dict)
    languages_breakdown: Dict[str, int] = Field(default_factory=dict)
    dependency_count: int = 0
    test_coverage: Optional[float] = None
    last_commit: Optional[Dict[str, Any]] = None
    branch: str = "main"
    is_clean: bool = True
    uncommitted_count: int = 0


class HealthCheckItem(BaseModel):
    status: str
    title: str
    detail: str
    command: str


class ProjectHealthStats(BaseModel):
    build_status: HealthCheckItem
    test_status: HealthCheckItem
    type_status: HealthCheckItem
    security_status: HealthCheckItem


class ProjectDashboardStats(BaseModel):
    project_id: str
    tasks_completed: int = 0
    tasks_failed: int = 0
    total_recovery_attempts: int = 0
    total_human_interventions: int = 0
    avg_execution_time_seconds: float = 0.0
    test_pass_rate: float = 100.0
    recent_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    repo_stats: RepoStats
    health: ProjectHealthStats


# Docker Schemas
class DockerConfig(BaseModel):
    has_dockerfile: bool = False
    has_compose: bool = False
    compose_services: List[str] = Field(default_factory=list)
    dockerfile_base_image: Optional[str] = None
    is_daemon_running: bool = False


class GenerateDockerFileResponse(BaseModel):
    dockerfile: str
    suggested_filename: str = "Dockerfile"


class GenerateComposeResponse(BaseModel):
    compose_yaml: str
    suggested_filename: str = "docker-compose.yml"


class SaveDockerFileRequest(BaseModel):
    filename: str = "Dockerfile"
    content: str


class BuildDockerImageRequest(BaseModel):
    tag: str = "latest"


class BuildResult(BaseModel):
    success: bool
    image_id: Optional[str] = None
    tag: str
    build_time_seconds: float = 0.0
    error: Optional[str] = None
    logs: Optional[str] = None


class StartContainerRequest(BaseModel):
    image_tag: str
    ports: Dict[str, str] = Field(default_factory=dict)
    env_file: Optional[str] = None
    container_name: Optional[str] = None


class ContainerResult(BaseModel):
    success: bool
    container_id: Optional[str] = None
    container_name: Optional[str] = None
    ports: Dict[str, str] = Field(default_factory=dict)
    error: Optional[str] = None


class StopContainerRequest(BaseModel):
    container_id: str


class ContainerInfo(BaseModel):
    id: str
    name: str
    image: str
    status: str
    ports: Dict[str, str] = Field(default_factory=dict)
    created: str

