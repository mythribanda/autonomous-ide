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
  has_dockerfile?: boolean;
  has_compose?: boolean;
  docker_daemon_running?: boolean;
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

export interface GitHubAuthStartResponse {
  auth_url: string;
  state: string;
}

export interface GitHubStatusResponse {
  connected: boolean;
  username?: string | null;
  avatar_url?: string | null;
}

export interface GitHubUser {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
  html_url?: string | null;
  email?: string | null;
  bio?: string | null;
  public_repos?: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description?: string | null;
  html_url: string;
  clone_url: string;
  default_branch: string;
  language?: string | null;
  stars: number;
  forks: number;
  private: boolean;
  updated_at?: string | null;
  pushed_at?: string | null;
}

export interface GitHubCloneRequest {
  clone_url: string;
  target_path: string;
  session_id?: string;
}

export interface GitHubCloneResult {
  success: boolean;
  target_path: string;
  repo_name: string;
  message: string;
  error?: string | null;
}

export interface GitHubPushRequest {
  branch: string;
}

export interface GitHubPushResult {
  success: boolean;
  branch: string;
  message: string;
  commit_hash?: string | null;
  requires_approval?: boolean;
  error?: string | null;
}

export interface GitHubPullResult {
  success: boolean;
  message: string;
  updated_files: string[];
  error?: string | null;
}

export interface GitHubPRRequest {
  title: string;
  body: string;
  head: string;
  base?: string;
}

export interface GitHubPRResult {
  success: boolean;
  pr_number?: number | null;
  html_url?: string | null;
  title?: string | null;
  state?: string | null;
  message: string;
  error?: string | null;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  state: string;
  html_url: string;
  user_login?: string | null;
  labels: string[];
  comments_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GitHubCIRun {
  name: string;
  status?: string;
  conclusion?: string | null;
  html_url?: string | null;
}

export interface GitHubCIStatus {
  status: 'passing' | 'failing' | 'running' | 'unknown';
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  in_progress_runs: number;
  runs: GitHubCIRun[];
  commit_sha?: string | null;
  repo_full_name?: string | null;
}

export interface ProjectMemoryItem {
  id: string;
  project_id: string;
  memory_type: 'architecture' | 'decision' | 'bug' | 'requirement' | string;
  created_at: string;
  summary: string;
  tags: string[];
  task_id?: string;
  details?: {
    summary?: string;
    decision?: string;
    context?: string;
    bug?: string;
    fix?: string;
    affected_files?: string[];
    requirement?: string;
    intent?: string;
    acceptance_criteria?: string[];
    task_id?: string;
    tags?: string[];
    [key: string]: any;
  };
}

export interface GroupedMemoriesResponse {
  architecture: ProjectMemoryItem[];
  decision: ProjectMemoryItem[];
  bug: ProjectMemoryItem[];
  requirement: ProjectMemoryItem[];
  [key: string]: ProjectMemoryItem[];
}

export interface CreateMemoryRequest {
  type: 'architecture' | 'decision' | 'bug' | 'requirement' | string;
  content: string;
  tags?: string[];
  task_id?: string;
}

export interface ModelConfig {
  planning_model: string;
  coding_model: string;
  diagnosis_model: string;
  summarization_model: string;
  ollama_base_url: string;
  temperature: number;
  max_tokens: number;
}

export interface ModelLatencyStats {
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  count: number;
}

export interface ModelHealthData {
  connected: boolean;
  model_loaded: boolean;
  latency_ms?: number | null;
  error?: string | null;
}

export interface SecretMatch {
  file_path: string;
  line_number: number;
  secret_type: string;
  redacted_preview: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | string;
}

export interface SecretScanResult {
  secrets_found: SecretMatch[];
  files_scanned: number;
  has_env_example_but_no_env: boolean;
  env_in_gitignore: boolean;
}

export interface Vulnerability {
  package: string;
  version: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | string;
  description: string;
  fix_version?: string | null;
}

export interface DependencyScanResult {
  vulnerabilities: Vulnerability[];
  total_deps: number;
  outdated_count: number;
  scan_tool: string;
}

export interface SecurityReport {
  secrets: SecretScanResult;
  dependencies: DependencyScanResult;
}

export interface DockerConfig {
  has_dockerfile: boolean;
  has_compose: boolean;
  compose_services: string[];
  dockerfile_base_image?: string | null;
  is_daemon_running: boolean;
}

export interface GenerateDockerFileResponse {
  dockerfile: string;
  suggested_filename: string;
}

export interface GenerateComposeResponse {
  compose_yaml: string;
  suggested_filename: string;
}

export interface BuildResult {
  success: boolean;
  image_id?: string | null;
  tag: string;
  build_time_seconds: number;
  error?: string | null;
  logs?: string | null;
}

export interface ContainerResult {
  success: boolean;
  container_id?: string | null;
  container_name?: string | null;
  ports: Record<string, string>;
  error?: string | null;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: Record<string, string>;
  created: string;
}

export interface UITestStep {
  action: 'navigate' | 'click' | 'fill' | 'wait' | 'screenshot' | 'assert_text' | 'assert_visible';
  target?: string | null;
  value?: string | null;
  description: string;
}

export interface ScreenshotResult {
  step_index: number;
  action: string;
  description: string;
  screenshot_base64: string;
  passed: boolean;
  error?: string | null;
}

export interface UIVerificationResult {
  steps_passed: number;
  steps_failed: number;
  screenshots: ScreenshotResult[];
  errors: string[];
  overall_passed: boolean;
  app_url?: string | null;
}

export interface VerifyUIRequest {
  app_url?: string | null;
  headless?: boolean;
  test_steps?: UITestStep[];
}

export interface DeploymentConfig {
  has_vercel: boolean;
  has_fly: boolean;
  has_railway: boolean;
  has_procfile: boolean;
  has_render: boolean;
  detected_provider?: string | null;
  config_files_found: string[];
  suggested_provider: string;
}

export interface DeployResult {
  url?: string | null;
  deploy_id?: string | null;
  success: boolean;
  error?: string | null;
  provider: string;
  logs?: string | null;
  timestamp: string;
}

export interface DeployVerificationResult {
  accessible: boolean;
  response_time_ms: number;
  status_code: number;
  url: string;
  error?: string | null;
}

export interface BenchmarkModeMetrics {
  mode: string;
  completion_rate: number;
  avg_time_seconds: number;
  recovery_attempts: number;
  model_calls: number;
  status: string;
}

export interface BenchmarkResult {
  benchmark_id: string;
  task: string;
  modes: string[];
  results: Record<string, BenchmarkModeMetrics>;
  summary: string;
  timestamp: string;
}

export interface BenchmarkRequest {
  task: string;
  modes?: string[];
}



