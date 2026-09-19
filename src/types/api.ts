export interface Project {
  id: string;
  name: string;
  path: string;
  language?: string | null;
  framework?: string | null;
  last_opened: string;
  created_at: string;
  config_json?: string | null;
  scan_result?: ProjectScanResult | null;
}

export interface ProjectOpenRequest {
  path: string;
  name?: string;
}

export type TaskStatus =
  | 'queued'
  | 'planning'
  | 'executing'
  | 'running'
  | 'testing'
  | 'recovering'
  | 'completed'
  | 'failed'
  | 'waiting_approval'
  | 'superseded'
  | 'cancelled'
  | 'paused';

export interface Task {
  id: string;
  project_id: string;
  requirement: string;
  compiled_spec_json?: string | null;
  status: TaskStatus;
  created_at: string;
  completed_at?: string | null;
  execution_time_seconds?: number | null;
  files_changed: number;
  tests_passed: number;
  tests_failed: number;
  recovery_attempts: number;
  human_interventions: number;
}

export interface TaskCreateRequest {
  project_id: string;
  requirement: string;
  mode?: string;
  compiled_spec_json?: string;
}

export interface TaskEvent {
  id: string;
  task_id: string;
  timestamp: string;
  event_type: string;
  message: string;
  data_json?: string | null;
}

export interface TaskDetailResponse extends Task {
  compiled_spec?: any | null;
  events: TaskEvent[];
}

export interface TaskReportResponse {
  task_id: string;
  requirement: string;
  status: string;
  phases: Record<string, TaskEvent[]>;
  verification_report?: any | null;
  git_checkpoint?: any | null;
  files_modified: string[];
  metrics: {
    execution_time_seconds: number;
    files_changed: number;
    tests_passed: number;
    tests_failed: number;
    recovery_attempts: number;
    human_interventions: number;
  };
}

export interface AgentMemory {
  id: string;
  project_id: string;
  memory_type: 'architecture' | 'decision' | 'bug' | 'requirement';
  content: string;
  created_at: string;
}

export interface AgentEvent {
  type: string;
  event_type?: string;
  timestamp: string;
  message: string;
  data?: any;
  task_id?: string;
}

export interface AgentExecuteRequest {
  task_id: string;
  prompt?: string | null;
  autonomy_level?: string | null;
  target_files?: string[] | null;
}

export interface AgentStopRequest {
  task_id: string;
}

export interface AgentStatusResponse {
  task_id: string;
  status: string;
  progress: number;
  current_activity?: string | null;
}

export interface GitStatus {
  branch: string;
  is_clean: boolean;
  modified_files: string[];
  added_files: string[];
  deleted_files: string[];
  untracked_files: string[];
  ahead_by: number;
  behind_by: number;
  project_path?: string | null;
  staged_files?: string[] | null;
}

export interface CheckpointResult {
  commit_hash: string;
  files_staged: number;
  skipped: boolean;
  message?: string | null;
  branch?: string | null;
  id?: string | null;
}

export interface FileDiff {
  file_path: string;
  diff_text: string;
  lines_added: number;
  lines_removed: number;
  old_content?: string | null;
  new_content?: string | null;
}

export interface FileDiffDetailResponse {
  project_id: string;
  file?: string | null;
  diff: string;
  details?: FileDiff | null;
  original?: string;
  modified?: string;
  lines_added?: number;
  lines_removed?: number;
}

export interface RollbackResult {
  success: boolean;
  files_restored: number;
  message: string;
}

export interface GitLogEntry {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  date: string;
  files_changed: number;
}

export interface GitStatusResponse {
  project_path: string;
  branch: string;
  is_clean: boolean;
  modified_files: string[];
  untracked_files: string[];
  staged_files: string[];
  added_files?: string[];
  deleted_files?: string[];
  ahead_by?: number;
  behind_by?: number;
}

export interface GitCheckpointRequest {
  project_id: string;
  project_path: string;
  message: string;
  type?: string | null;
  author?: string | null;
}

export interface GitCheckpointResponse {
  id: string;
  commit_hash: string;
  branch: string;
  message: string;
  author: string;
  type: string;
  files_changed: number;
  created_at: string;
}

export type GitCheckpoint = GitCheckpointResponse;

export interface GitRollbackRequest {
  project_path: string;
  commit_hash: string;
}

export interface GitRollbackResponse {
  success: boolean;
  message: string;
}

export interface GitDiffResponse {
  project_path: string;
  file_path?: string | null;
  diff: string;
}

export interface HealthResponse {
  status: string;
  version: string;
}

export interface OllamaHealthResponse {
  connected: boolean;
  models: string[];
  error?: string | null;
}

export interface ApiErrorData {
  message: string;
  code: string;
  status: number;
}

export type BackendStatus = 'connecting' | 'connected' | 'error';
export type OllamaStatus = 'connecting' | 'connected' | 'error' | 'unavailable';

export interface ProjectScanResult {
  languages: string[];
  frameworks: string[];
  package_manager?: string | null;
  entry_points: string[];
  config_files: Record<string, string>;
  test_framework?: string | null;
  has_docker: boolean;
  has_git: boolean;
  has_ci: boolean;
  file_count: number;
  directory_structure: Record<string, any>;
  detected_database?: string | null;
  api_style?: string | null;
}

export interface GraphNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'component' | 'api_route' | 'database_model' | string;
  name: string;
  file_path: string;
  metadata?: Record<string, any>;
}

export interface GraphEdge {
  from_id: string;
  to_id: string;
  type: 'imports' | 'calls' | 'extends' | 'renders' | 'depends_on' | 'defines_route' | 'defines' | string;
}

export interface KnowledgeGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: string;
}

export interface FileContext {
  file_path: string;
  relevance_score: number;
  content_snippet: string;
  reason: string;
}

export interface ProjectSummaryResponse {
  summary: string;
}

export interface ImpactReport {
  directly_affected_files: string[];
  transitively_affected_files: string[];
  affected_api_routes: string[];
  affected_components: string[];
  affected_database_models: string[];
  tests_to_run: string[];
  risk_level: 'low' | 'medium' | 'high';
  risk_reasons: string[];
  estimated_files_to_change: number;
}

export interface AnalysisJobResponse {
  project_id: string;
  status: string;
  message: string;
  files_count: number;
}

export interface ProjectAnalysis {
  files: any[];
  total_functions: number;
  total_classes: number;
  component_tree: Record<string, string[]>;
}

export interface TerminalExecuteRequest {
  command: string;
  cwd?: string;
  project_id?: string;
  timeout_seconds?: number;
}

export interface TerminalCommandClassification {
  is_test: boolean;
  is_build: boolean;
  is_dangerous: boolean;
  required_permission: string;
  risk_description: string;
}

export interface TerminalExecuteResponse {
  stdout: string;
  stderr: string;
  exit_code: number;
  timed_out: boolean;
  execution_time_ms: number;
  /** backward-compat alias */
  duration_ms?: number;
  command_classification?: TerminalCommandClassification;
}

export interface TerminalHistoryItem {
  id: string;
  command: string;
  cwd?: string;
  exit_code?: number;
  timestamp: string;
  project_id: string;
}

export interface TerminalStreamMessage {
  type: 'stdout' | 'stderr' | 'exit' | 'error' | 'system' | 'echo' | 'clear';
  data: string;
  exit_code?: number;
}

export interface PromptCompileRequest {
  prompt: string;
  project_id?: string | null;
}

export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number | null;
}

export interface FileListResponse {
  path: string;
  items: FileItem[];
}

export interface FileReadResponse {
  path: string;
  content: string;
  size: number;
}

export interface ImplementationStep {
  step: number;
  action: string;
  file: string;
  type: 'create' | 'modify' | 'delete' | string;
}

export interface CompiledSpec {
  task_id?: string | null;
  raw_requirement: string;
  intent: string;
  intent_category: string;
  scope: string;
  explicit_requirements: string[];
  ambiguities: string[];
  missing_info: string[];
  assumptions: string[];
  implementation_steps: ImplementationStep[];
  new_files_needed: string[];
  acceptance_criteria: string[];
  test_cases: string[];
  affected_files: string[];
  impact_report: ImpactReport;
  confidence_score: number;
  error?: string | null;
}

export interface AgentCompileRequest {
  requirement: string;
  project_id: string;
  task_id?: string | null;
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  output: string;
  error?: string | null;
}

export interface CriterionCheck {
  criterion: string;
  met: boolean;
  evidence: string;
}

export interface VerificationReport {
  build_status: VerificationCheck;
  test_status: VerificationCheck;
  lint_status: VerificationCheck;
  requirements_met: CriterionCheck[];
  files_changed_count: number;
  overall_success: boolean;
  summary: string;
  passed?: boolean;
}

export interface TaskReportData {
  task: string;
  status: string;
  filesChanged: number;
  testsPassed: number;
  testsFailed: number;
  buildStatus: 'success' | 'failed' | 'skipped';
  recoveryAttempts: number;
  humanInterventions: number;
  executionTimeSeconds: number;
  gitCheckpoint?: string | null;
}

export interface ApprovalRequest {
  stepId: string;
  tool: string;
  args: Record<string, any>;
  riskLevel?: 'low' | 'medium' | 'high';
  message?: string;
}

export type PermissionLevel =
  | 'READ_ONLY'
  | 'FILE_WRITE'
  | 'FILE_DELETE'
  | 'COMMAND_RUN'
  | 'COMMAND_DANGEROUS'
  | 'GIT_WRITE'
  | 'GIT_PUSH'
  | 'NETWORK';

export interface AgentPermissionConfig {
  allowed: PermissionLevel[];
  workspace_path: string;
  blocked_paths: string[];
  max_files_per_task: number;
  require_approval_for: PermissionLevel[];
  auto_approve_test_commands: boolean;
  auto_approve_build_commands: boolean;
}

export interface PermissionResult {
  allowed: boolean;
  requires_approval: boolean;
  reason: string;
}

export interface CommandClassification {
  is_test: boolean;
  is_build: boolean;
  is_dangerous: boolean;
  required_permission: PermissionLevel;
  risk_description: string;
}

export interface SecretMatch {
  type: string;
  pattern: string;
  line_number: number;
  redacted_preview: string;
}

export interface PermissionCheckRequest {
  action: string;
  path?: string | null;
}

export interface RepoStats {
  file_count: number;
  languages: Record<string, number>;
  languages_breakdown: Record<string, number>;
  dependency_count: number;
  test_coverage?: number | null;
  last_commit?: {
    hash: string;
    message: string;
    author: string;
    date: string;
  } | null;
  branch: string;
  is_clean: boolean;
  uncommitted_count: number;
}

export interface HealthCheckItem {
  status: 'passing' | 'failing' | 'warning' | 'unknown';
  title: string;
  detail: string;
  command: string;
}

export interface ProjectHealthStats {
  build_status: HealthCheckItem;
  test_status: HealthCheckItem;
  type_status: HealthCheckItem;
  security_status: HealthCheckItem;
}

export interface RecentTaskItem {
  id: string;
  title: string;
  requirement: string;
  status: string;
  created_at: string | null;
  execution_time_seconds: number;
  files_changed: number;
  tests_passed: number;
  tests_failed: number;
}

export interface ProjectDashboardStats {
  project_id: string;
  tasks_completed: number;
  tasks_failed: number;
  total_recovery_attempts: number;
  total_human_interventions: number;
  avg_execution_time_seconds: number;
  test_pass_rate: number;
  recent_tasks: RecentTaskItem[];
  repo_stats: RepoStats;
  health: ProjectHealthStats;
}

export interface CategoryMetrics {
  task_count: number;
  completion_rate: number;
  avg_time: number;
}

export interface EvaluationTimelineItem {
  task_index: number;
  timestamp: string | null;
  cumulative_completed: number;
  cumulative_failed: number;
  status: string;
  title: string;
}

export interface EvaluationMetrics {
  task_completion_rate: number;
  test_success_rate: number;
  recovery_rate: number;
  human_intervention_rate: number;
  avg_recovery_iterations: number;
  avg_execution_time_seconds: number;
  median_execution_time_seconds: number;
  avg_files_changed_per_task: number;
  total_tasks: number;
  total_recovery_attempts: number;
  total_human_interventions: number;
  model_avg_latency_ms: number;
  verification_success_rate: number;
  by_intent_category: Record<string, CategoryMetrics>;
  by_mode: Record<string, CategoryMetrics>;
  recovery_iterations_distribution: Record<string, number>;
  completion_timeline: EvaluationTimelineItem[];
}

