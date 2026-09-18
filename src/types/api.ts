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
  | 'testing'
  | 'recovering'
  | 'completed'
  | 'failed'
  | 'waiting_approval';

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

export interface AgentMemory {
  id: string;
  project_id: string;
  memory_type: 'architecture' | 'decision' | 'bug' | 'requirement';
  content: string;
  created_at: string;
}

export interface AgentEvent {
  type: string;
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

export interface GitStatusResponse {
  project_path: string;
  branch: string;
  is_clean: boolean;
  modified_files: string[];
  untracked_files: string[];
  staged_files: string[];
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
  cwd?: string | null;
  timeout_seconds?: number;
}

export interface TerminalExecuteResponse {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
}

export interface PromptCompileRequest {
  prompt: string;
  project_id?: string | null;
}

