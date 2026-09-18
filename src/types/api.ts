export interface Project {
  id: string;
  name: string;
  path: string;
  language?: string | null;
  framework?: string | null;
  last_opened: string;
  created_at: string;
  config_json?: string | null;
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

export interface GitCheckpoint {
  id: string;
  commit_hash: string;
  branch: string;
  message: string;
  author: string;
  type: string;
  files_changed: number;
  created_at: string;
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
