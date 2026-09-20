export type AutonomyLevel = 'assist' | 'guided' | 'autonomous';

export type AgentStatus = 'idle' | 'planning' | 'executing' | 'verifying' | 'recovering' | 'completed' | 'paused' | 'error' | 'waiting_approval';

export type ToolType = 'READ_FILE' | 'SEARCH' | 'WRITE_FILE' | 'RUN_COMMAND' | 'GIT_DIFF' | 'ANALYZE_AST' | 'INSPECT_TEST';

export interface ToolCall {
  id: string;
  type: ToolType;
  target: string;
  timestamp: string;
  status: 'running' | 'success' | 'failed';
  summary: string;
  detail?: string;
  diff?: {
    file: string;
    additions: number;
    deletions: number;
    preview: string;
  };
  output?: string;
}

export interface AgentPlanStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  toolCalls?: ToolCall[];
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  autonomyLevel: AutonomyLevel;
  status: AgentStatus;
  progress: number;
  understandings: string[];
  plan: AgentPlanStep[];
  activities: {
    timestamp: string;
    message: string;
    type: 'info' | 'tool' | 'success' | 'warning' | 'error';
    toolCall?: ToolCall;
  }[];
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  language?: string;
  status?: 'modified' | 'added' | 'deleted' | 'untracked';
  content?: string;
  size?: number;
}

export interface PromptSpecification {
  id: string;
  rawPrompt: string;
  title: string;
  qualityScore: number;
  intent: string;
  detectedRequirements: string[];
  ambiguities: string[];
  missingInformation: string[];
  assumptions: string[];
  technicalPlan: {
    frontend: string;
    backend: string;
    database: string;
    testing: string;
    architectureNotes: string[];
  };
  acceptanceCriteria: {
    id: string;
    text: string;
    completed: boolean;
  }[];
}

export interface DependencyNode {
  id: string;
  name: string;
  type: 'component' | 'service' | 'router' | 'model' | 'database';
  layer: 'frontend' | 'backend' | 'database';
  file: string;
  imports: string[];
  exports: string[];
  usedBy: string[];
  risk: 'Low' | 'Medium' | 'High';
  x: number;
  y: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ImpactAnalysisResult {
  task: string;
  totalAffected: number;
  highImpact: number;
  mediumImpact: number;
  testImpact: number;
  affectedFiles: {
    file: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW' | 'TESTS';
    confidence: number;
    reason: string;
    locChangeEstimate: number;
  }[];
}

export interface TestCase {
  id: string;
  suite: string;
  name: string;
  durationMs: number;
  status: 'passed' | 'failed' | 'skipped';
  file: string;
  line?: number;
  error?: {
    message: string;
    expected: string;
    received: string;
    stack: string;
  };
}

export interface TestSummary {
  overall: 'PASSED' | 'FAILED' | 'RUNNING';
  build: 'Passed' | 'Failed' | 'Building';
  unit: { total: number; passed: number; failed: number };
  integration: { total: number; passed: number; failed: number };
  e2e: { total: number; passed: number; failed: number };
  staticAnalysis: 'Passed' | 'Warnings' | 'Failed';
  tests: TestCase[];
}

export interface RecoveryStep {
  attemptNumber: number;
  status: 'failed' | 'recovering' | 'success';
  title: string;
  errorIdentified: string;
  rootCause: string;
  repairApplied: string;
  diffSnippet: string;
  result: string;
}

export interface GitChange {
  file: string;
  status: 'M' | 'A' | 'D' | 'U';
  staged: boolean;
  additions: number;
  deletions: number;
  diff: string;
}

export interface GitCheckpoint {
  id: string;
  commitHash: string;
  message: string;
  timestamp: string;
  author: string;
  type: 'ai_pre_change' | 'ai_post_change' | 'user_manual' | 'recovery_point';
  filesChanged: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'READ' | 'WRITE' | 'RUN' | 'GIT_COMMIT' | 'GIT_PUSH' | 'DELETE';
  target: string;
  verdict: 'Allowed' | 'Blocked' | 'Prompted';
  reason: string;
  actor: 'AI Agent' | 'User';
}

export interface SystemSettings {
  aiProvider: 'local' | 'cloud';
  localRuntime: 'Ollama' | 'LMStudio' | 'vLLM';
  model: string;
  contextLimit: number;
  ramEstimateGb: number;
  autonomyLevel: AutonomyLevel;
  workspacePath: string;
  permissions: {
    readFile: boolean;
    writeFile: boolean;
    runTests: boolean;
    runDevCommands: boolean;
    gitStatus: boolean;
    gitDiff: boolean;
    gitCommit: boolean;
    deleteFiles: boolean;
    gitPush: boolean;
    createPR: boolean;
    deployApp: boolean;
  };
  theme: 'dark-developer';
  telemetry: boolean;
  notifications: boolean;
}

export type ActivityView =
  | 'home'
  | 'dashboard'
  | 'explorer'
  | 'tasks'
  | 'intelligence'
  | 'impact'
  | 'agent'
  | 'verification'
  | 'recovery'
  | 'git'
  | 'github'
  | 'terminal'
  | 'security'
  | 'docker'
  | 'evaluation'
  | 'memory'
  | 'settings';

