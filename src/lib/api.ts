import {
  Project,
  HealthResponse,
  OllamaHealthResponse,
  AnalysisJobResponse,
  ProjectAnalysis,
  KnowledgeGraphResult,
  FileContext,
  ProjectSummaryResponse,
  ImpactReport
} from '../types/api';

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
