import {
  Project,
  HealthResponse,
  OllamaHealthResponse,
  AnalysisJobResponse,
  ProjectAnalysis,
  KnowledgeGraphResult,
  FileContext,
  ProjectSummaryResponse,
  ImpactReport,
  TerminalExecuteRequest,
  TerminalExecuteResponse,
  AgentExecuteRequest,
  AgentStopRequest,
  AgentStatusResponse,
  AgentCompileRequest,
  CompiledSpec,
  Task,
  TaskCreateRequest,
  TaskEvent,
  TaskDetailResponse,
  TaskReportResponse,
  GitStatusResponse,
  GitStatus,
  CheckpointResult,
  RollbackResult,
  GitLogEntry,
  GitCheckpointRequest,
  GitCheckpointResponse,
  GitRollbackRequest,
  GitRollbackResponse,
  GitDiffResponse,
  PromptCompileRequest,
  FileListResponse,
  FileReadResponse,
  VerificationReport,
  AgentPermissionConfig,
  PermissionResult,
  PermissionCheckRequest
} from '../types/api';
import { PromptSpecification } from '../types';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const API_BASE_URL = 'http://localhost:8000/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (err: any) {
    throw new ApiError(
      err?.message || 'Failed to connect to backend server',
      'NETWORK_ERROR',
      0
    );
  }

  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && (data.detail || data.message)) ||
      (typeof data === 'string' && data) ||
      `HTTP Error ${response.status}: ${response.statusText}`;

    const code =
      (data && typeof data === 'object' && data.code) ||
      `HTTP_${response.status}`;

    throw new ApiError(message, code, response.status);
  }

  return data as T;
}

export async function openProject(path: string, name?: string): Promise<Project> {
  return request<Project>('/projects/open', {
    method: 'POST',
    body: JSON.stringify({ path, name })
  });
}

export async function getRecentProjects(limit: number = 10): Promise<Project[]> {
  return request<Project[]>(`/projects/recent?limit=${encodeURIComponent(limit)}`, {
    method: 'GET'
  });
}

export async function getProject(id: string): Promise<Project> {
  return request<Project>(`/projects/${encodeURIComponent(id)}`, {
    method: 'GET'
  });
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health', {
    method: 'GET'
  });
}

export async function getOllamaHealth(): Promise<OllamaHealthResponse> {
  return request<OllamaHealthResponse>('/health/ollama', {
    method: 'GET'
  });
}

export async function analyzeProject(projectId: string, wait: boolean = true): Promise<AnalysisJobResponse> {
  return request<AnalysisJobResponse>(`/projects/${encodeURIComponent(projectId)}/analyze?wait=${wait}`, {
    method: 'POST'
  });
}

export async function getProjectAnalysis(projectId: string): Promise<ProjectAnalysis> {
  return request<ProjectAnalysis>(`/projects/${encodeURIComponent(projectId)}/analysis`, {
    method: 'GET'
  });
}

export async function buildKnowledgeGraph(projectId: string, rebuild: boolean = true): Promise<KnowledgeGraphResult> {
  return request<KnowledgeGraphResult>(`/projects/${encodeURIComponent(projectId)}/knowledge-graph?rebuild=${rebuild}`, {
    method: 'POST'
  });
}

export async function getProjectContext(projectId: string, requirement: string, maxFiles: number = 8): Promise<FileContext[]> {
  const params = new URLSearchParams({
    requirement,
    max_files: String(maxFiles)
  });
  return request<FileContext[]>(`/projects/${encodeURIComponent(projectId)}/context?${params.toString()}`, {
    method: 'GET'
  });
}

export async function getProjectSummary(projectId: string): Promise<ProjectSummaryResponse> {
  return request<ProjectSummaryResponse>(`/projects/${encodeURIComponent(projectId)}/summary`, {
    method: 'GET'
  });
}

export async function getImpactAnalysis(projectId: string, requirement: string): Promise<ImpactReport> {
  return request<ImpactReport>(`/projects/${encodeURIComponent(projectId)}/impact`, {
    method: 'POST',
    body: JSON.stringify({ requirement })
  });
}

export async function terminalExecute(
  command: string,
  cwd?: string | null,
  timeoutSeconds?: number
): Promise<TerminalExecuteResponse>;
export async function terminalExecute(
  request: TerminalExecuteRequest
): Promise<TerminalExecuteResponse>;
export async function terminalExecute(
  commandOrReq: string | TerminalExecuteRequest,
  cwd?: string | null,
  timeoutSeconds?: number
): Promise<TerminalExecuteResponse> {
  const payload: TerminalExecuteRequest =
    typeof commandOrReq === 'string'
      ? {
          command: commandOrReq,
          cwd: cwd || undefined,
          timeout_seconds: timeoutSeconds ?? 60
        }
      : commandOrReq;

  return request<TerminalExecuteResponse>('/terminal/execute', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function executeAgent(req: AgentExecuteRequest): Promise<AgentStatusResponse> {
  return request<AgentStatusResponse>('/agent/execute', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

export async function stopAgent(req: AgentStopRequest): Promise<AgentStatusResponse> {
  return request<AgentStatusResponse>('/agent/stop', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

export async function getAgentStatus(taskId: string): Promise<AgentStatusResponse> {
  return request<AgentStatusResponse>(`/agent/status?task_id=${encodeURIComponent(taskId)}`, {
    method: 'GET'
  });
}

export async function approveAgentStep(taskId: string): Promise<{ task_id: string; approved: boolean }> {
  return request<{ task_id: string; approved: boolean }>(`/agent/${encodeURIComponent(taskId)}/approve`, {
    method: 'POST'
  });
}

export async function pauseAgentTask(taskId: string): Promise<{ task_id: string; status: string; paused: boolean }> {
  return request<{ task_id: string; status: string; paused: boolean }>(`/agent/${encodeURIComponent(taskId)}/pause`, {
    method: 'POST'
  });
}

export async function resumeAgentTask(taskId: string): Promise<{ task_id: string; status: string; resumed: boolean }> {
  return request<{ task_id: string; status: string; resumed: boolean }>(`/agent/${encodeURIComponent(taskId)}/resume`, {
    method: 'POST'
  });
}

export async function stopAgentTask(taskId: string): Promise<{ task_id: string; status: string; stopped: boolean }> {
  return request<{ task_id: string; status: string; stopped: boolean }>(`/agent/${encodeURIComponent(taskId)}/stop`, {
    method: 'POST'
  });
}

export async function verifyAgentTask(taskId: string): Promise<VerificationReport> {
  return request<VerificationReport>(`/agent/${encodeURIComponent(taskId)}/verify`, {
    method: 'POST'
  });
}

export async function getAgentVerificationReport(taskId: string): Promise<VerificationReport> {
  return request<VerificationReport>(`/agent/${encodeURIComponent(taskId)}/verification`, {
    method: 'GET'
  });
}


export async function compileAgentRequirement(req: AgentCompileRequest): Promise<CompiledSpec> {
  return request<CompiledSpec>('/agent/compile', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

export function compileAgentRequirementStream(
  req: AgentCompileRequest,
  onEvent: (event: any) => void,
  onError?: (error: any) => void
): () => void {
  const controller = new AbortController();
  fetch(`${API_BASE_URL}/agent/compile/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(req),
    signal: controller.signal
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      for (const block of lines) {
        const line = block.trim();
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent(data);
          } catch (err) {
            console.error('Failed to parse SSE JSON:', err);
          }
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError' && onError) {
      onError(err);
    }
  });

  return () => controller.abort();
}

export async function createTask(req: TaskCreateRequest): Promise<Task> {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

export async function getProjectTasks(projectId: string, status?: string): Promise<Task[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request<Task[]>(`/projects/${encodeURIComponent(projectId)}/tasks${query}`, {
    method: 'GET'
  });
}

export async function getTask(taskId: string): Promise<Task> {
  return request<Task>(`/tasks/${encodeURIComponent(taskId)}`, {
    method: 'GET'
  });
}

export async function getTaskDetail(taskId: string): Promise<TaskDetailResponse> {
  return request<TaskDetailResponse>(`/tasks/${encodeURIComponent(taskId)}`, {
    method: 'GET'
  });
}

export async function getTaskEvents(taskId: string, since?: string): Promise<TaskEvent[]> {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return request<TaskEvent[]>(`/tasks/${encodeURIComponent(taskId)}/events${query}`, {
    method: 'GET'
  });
}

export async function deleteTask(taskId: string): Promise<{ status: string; task_id: string; message: string }> {
  return request<{ status: string; task_id: string; message: string }>(`/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE'
  });
}

export async function retryTask(taskId: string): Promise<Task> {
  return request<Task>(`/tasks/${encodeURIComponent(taskId)}/retry`, {
    method: 'POST'
  });
}

export async function getTaskReport(taskId: string): Promise<TaskReportResponse> {
  return request<TaskReportResponse>(`/tasks/${encodeURIComponent(taskId)}/report`, {
    method: 'GET'
  });
}

export async function denyAgentStep(taskId: string): Promise<{ task_id: string; denied: boolean }> {
  return request<{ task_id: string; denied: boolean }>(`/agent/${encodeURIComponent(taskId)}/deny`, {
    method: 'POST'
  });
}

export async function getTaskSpec(taskId: string): Promise<CompiledSpec> {
  return request<CompiledSpec>(`/tasks/${encodeURIComponent(taskId)}/spec`, {
    method: 'GET'
  });
}

export async function getGitStatus(projectPath: string): Promise<GitStatusResponse> {
  return request<GitStatusResponse>(`/git/status?project_path=${encodeURIComponent(projectPath)}`, {
    method: 'GET'
  });
}

export async function createGitCheckpoint(req: GitCheckpointRequest): Promise<GitCheckpointResponse> {
  return request<GitCheckpointResponse>('/git/checkpoint', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

export async function rollbackGitCheckpoint(req: GitRollbackRequest): Promise<GitRollbackResponse> {
  return request<GitRollbackResponse>('/git/rollback', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

export async function listGitCheckpoints(projectId?: string): Promise<GitCheckpointResponse[]> {
  const url = projectId
    ? `/git/checkpoints?project_id=${encodeURIComponent(projectId)}`
    : '/git/checkpoints';
  return request<GitCheckpointResponse[]>(url, {
    method: 'GET'
  });
}

export async function getGitDiff(projectPath: string, filePath?: string): Promise<GitDiffResponse> {
  const params = new URLSearchParams({ project_path: projectPath });
  if (filePath) {
    params.append('file_path', filePath);
  }
  return request<GitDiffResponse>(`/git/diff?${params.toString()}`, {
    method: 'GET'
  });
}

export async function getProjectGitStatus(projectId: string): Promise<GitStatus> {
  return request<GitStatus>(`/git/${encodeURIComponent(projectId)}/status`, {
    method: 'GET'
  });
}

export async function createProjectCheckpoint(projectId: string, message: string, taskId?: string): Promise<CheckpointResult> {
  return request<CheckpointResult>(`/git/${encodeURIComponent(projectId)}/checkpoint`, {
    method: 'POST',
    body: JSON.stringify({ message, task_id: taskId })
  });
}

export async function rollbackProjectCheckpoint(projectId: string, commitHash: string): Promise<RollbackResult> {
  return request<RollbackResult>(`/git/${encodeURIComponent(projectId)}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ commit_hash: commitHash })
  });
}

export async function getProjectCheckpoints(projectId: string): Promise<GitCheckpointResponse[]> {
  return request<GitCheckpointResponse[]>(`/git/${encodeURIComponent(projectId)}/checkpoints`, {
    method: 'GET'
  });
}

export async function getProjectLog(projectId: string, maxEntries: number = 20): Promise<GitLogEntry[]> {
  return request<GitLogEntry[]>(`/git/${encodeURIComponent(projectId)}/log?max_entries=${maxEntries}`, {
    method: 'GET'
  });
}

export async function getProjectBranches(projectId: string): Promise<string[]> {
  return request<string[]>(`/git/${encodeURIComponent(projectId)}/branches`, {
    method: 'GET'
  });
}

export async function createProjectBranch(projectId: string, name: string): Promise<{ success: boolean; branch: string }> {
  return request<{ success: boolean; branch: string }>(`/git/${encodeURIComponent(projectId)}/branch`, {
    method: 'POST',
    body: JSON.stringify({ name })
  });
}

export async function compilePrompt(req: PromptCompileRequest): Promise<PromptSpecification> {
  return request<PromptSpecification>('/prompt/compile', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

export async function listFiles(projectPath: string, recursive: boolean = true): Promise<FileListResponse> {
  return request<FileListResponse>(`/fs/list?path=${encodeURIComponent(projectPath)}&recursive=${recursive}`, {
    method: 'GET'
  });
}

export async function readFile(projectPath: string, filePath?: string): Promise<FileReadResponse> {
  let targetPath = filePath ? filePath : projectPath;
  if (filePath && !filePath.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(filePath)) {
    const normalizedProject = projectPath.replace(/[\\/]+$/, '');
    targetPath = `${normalizedProject}/${filePath.replace(/^[\\/]+/, '')}`;
  }
  return request<FileReadResponse>(`/fs/read?path=${encodeURIComponent(targetPath)}`, {
    method: 'GET'
  });
}

export async function getProjectPermissions(projectId: string): Promise<AgentPermissionConfig> {
  return request<AgentPermissionConfig>(`/projects/${encodeURIComponent(projectId)}/permissions`, {
    method: 'GET'
  });
}

export async function updateProjectPermissions(projectId: string, config: AgentPermissionConfig): Promise<AgentPermissionConfig> {
  return request<AgentPermissionConfig>(`/projects/${encodeURIComponent(projectId)}/permissions`, {
    method: 'PUT',
    body: JSON.stringify(config)
  });
}

export async function checkProjectPermission(projectId: string, action: string, path?: string): Promise<PermissionResult> {
  const payload: PermissionCheckRequest = {
    action,
    path
  };
  return request<PermissionResult>(`/projects/${encodeURIComponent(projectId)}/permissions/check`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}


