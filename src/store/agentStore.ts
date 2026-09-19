import { create } from 'zustand';
import {
  AgentTask,
  AutonomyLevel,
  AgentStatus,
  ToolCall,
  ToolType
} from '../types';
import {
  AgentEvent,
  VerificationReport,
  TaskReportData,
  ApprovalRequest
} from '../types/api';
import {
  executeAgent as apiExecuteAgent,
  stopAgent as apiStopAgent,
  getAgentStatus as apiGetAgentStatus,
  createTask as apiCreateTask,
  openProject as apiOpenProject,
  approveAgentStep as apiApproveAgentStep,
  pauseAgentTask as apiPauseAgentTask,
  resumeAgentTask as apiResumeAgentTask,
  stopAgentTask as apiStopAgentTask,
  verifyAgentTask as apiVerifyAgentTask,
  getAgentVerificationReport as apiGetAgentVerificationReport,
  ApiError
} from '../lib/api';
import { AgentWebSocket } from '../lib/websocket';
import { useProjectStore } from './projectStore';

export interface AgentStoreState {
  taskId: string | null;
  agentStatus: AgentStatus;
  events: AgentEvent[];
  approvalRequest: ApprovalRequest | null;
  verificationReport: VerificationReport | null;
  taskReport: TaskReportData | null;
  isPaused: boolean;
  isLoading: boolean;
  error: string | null;

  currentTask: AgentTask;
  activeToolCall: ToolCall | null;
  selectedToolCall: ToolCall | null;

  startExecution: (taskId: string, prompt?: string, autonomyLevel?: AutonomyLevel) => Promise<void>;
  approveStep: (allowSession?: boolean) => Promise<void>;
  stopAgent: () => Promise<void>;
  pauseAgent: () => Promise<void>;
  resumeAgent: () => Promise<void>;
  addEvent: (event: AgentEvent) => void;

  setAutonomyLevel: (level: AutonomyLevel) => void;
  startNewTask: (title: string, autonomyLevel?: AutonomyLevel) => Promise<void>;
  runNextStep: () => void;
  setSelectedToolCall: (tc: ToolCall | null) => void;
  simulateFullFlow: () => void;
  fetchStatus: (taskId?: string) => Promise<void>;
  loadVerificationReport: (taskId?: string) => Promise<void>;
  dismissApproval: () => void;
}

let activeWs: AgentWebSocket | null = null;
const sessionApprovedTools = new Set<string>();

const initialTask: AgentTask = {
  id: '',
  title: 'Autonomous AI Agent',
  description: 'AI Agent is idle. Submit a requirement or prompt to initiate autonomous execution.',
  autonomyLevel: 'autonomous',
  status: 'idle',
  progress: 0,
  understandings: [
    'Idle — waiting for task execution instruction'
  ],
  plan: [],
  activities: [
    {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message: 'AI Agent ready — waiting for task instruction',
      type: 'info'
    }
  ]
};

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  taskId: null,
  agentStatus: 'idle',
  events: [],
  approvalRequest: null,
  verificationReport: null,
  taskReport: null,
  isPaused: false,
  isLoading: false,
  error: null,

  currentTask: initialTask,
  activeToolCall: null,
  selectedToolCall: null,

  addEvent: (event: AgentEvent) => {
    const timestamp = event.timestamp
      ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    set((state) => {
      const nextEvents = [...state.events, event];
      const updatedActivities = [...state.currentTask.activities];
      let updatedStatus: AgentStatus = state.agentStatus;
      let updatedProgress = state.currentTask.progress;
      let updatedPlan = [...state.currentTask.plan];
      let updatedActiveTool = state.activeToolCall;
      let approvalReq = state.approvalRequest;
      let verReport = state.verificationReport;
      let tReport = state.taskReport;

      const evType = event.type || event.data?.type || '';

      switch (evType) {
        case 'TASK_STARTED':
        case 'task_start': {
          updatedStatus = 'executing';
          updatedProgress = Math.max(updatedProgress, 10);
          updatedActivities.unshift({ timestamp, message: event.message, type: 'info' });
          break;
        }

        case 'planning_complete':
        case 'PLAN_GENERATED': {
          updatedProgress = Math.max(updatedProgress, 25);
          const rawSteps = event.data?.steps || [];
          if (Array.isArray(rawSteps) && rawSteps.length > 0) {
            updatedPlan = rawSteps.map((s: any, idx: number) => ({
              id: s.step_id || `step-${idx + 1}`,
              title: s.description || (typeof s === 'string' ? s : `Step ${idx + 1}`),
              description: s.tool ? `Tool: ${s.tool}` : `Phase ${idx + 1} execution step`,
              status: s.status || (idx === 0 ? 'in_progress' : 'pending')
            }));
          }
          updatedActivities.unshift({ timestamp, message: event.message, type: 'info' });
          break;
        }

        case 'step_start': {
          updatedStatus = 'executing';
          const stepId = event.data?.step_id;
          if (stepId) {
            updatedPlan = updatedPlan.map((p) =>
              p.id === stepId ? { ...p, status: 'in_progress' as const } : p
            );
          }
          const toolType = (event.data?.tool?.toUpperCase() as ToolType) || 'WRITE_FILE';
          const toolCall: ToolCall = {
            id: `tc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            type: toolType,
            target: event.data?.tool_args?.path || event.data?.tool_args?.file || 'workspace',
            timestamp,
            status: 'running',
            summary: event.message,
            output: JSON.stringify(event.data?.tool_args || {})
          };
          updatedActiveTool = toolCall;
          break;
        }

        case 'step_done': {
          const stepId = event.data?.step_id;
          if (stepId) {
            updatedPlan = updatedPlan.map((p) =>
              p.id === stepId ? { ...p, status: 'completed' as const } : p
            );
          }
          if (updatedActiveTool) {
            updatedActiveTool = { ...updatedActiveTool, status: 'success' };
            updatedActivities.unshift({
              timestamp,
              message: event.message,
              type: 'tool',
              toolCall: updatedActiveTool
            });
            updatedActiveTool = null;
          }
          const completedCount = updatedPlan.filter((p) => p.status === 'completed').length;
          if (updatedPlan.length > 0) {
            updatedProgress = Math.min(90, Math.round((completedCount / updatedPlan.length) * 80) + 15);
          }
          break;
        }

        case 'step_failed': {
          const stepId = event.data?.step_id;
          if (stepId) {
            updatedPlan = updatedPlan.map((p) =>
              p.id === stepId ? { ...p, status: 'failed' as const } : p
            );
          }
          if (updatedActiveTool) {
            updatedActiveTool = { ...updatedActiveTool, status: 'failed' };
            updatedActivities.unshift({
              timestamp,
              message: event.message,
              type: 'error',
              toolCall: updatedActiveTool
            });
            updatedActiveTool = null;
          }
          break;
        }

        case 'TOOL_CALL': {
          updatedProgress = Math.max(updatedProgress, 60);
          const toolType = (event.data?.tool?.toUpperCase() as ToolType) || 'WRITE_FILE';
          const toolCall: ToolCall = {
            id: `tc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            type: toolType,
            target: event.data?.target || event.data?.file || 'workspace',
            timestamp,
            status: event.data?.status === 'failed' ? 'failed' : 'success',
            summary: event.message,
            detail: event.data?.detail,
            diff: event.data?.diff,
            output: event.data?.output
          };
          updatedActiveTool = toolCall;
          updatedActivities.unshift({
            timestamp,
            message: event.message,
            type: 'tool',
            toolCall
          });
          break;
        }

        case 'waiting_approval': {
          const toolName = event.data?.tool || 'unknown_tool';
          if (sessionApprovedTools.has(toolName) && state.taskId) {
            apiApproveAgentStep(state.taskId).catch((err) =>
              console.warn('Auto-approval error:', err)
            );
          } else {
            approvalReq = {
              stepId: event.data?.step_id || 'unknown',
              tool: toolName,
              args: event.data?.args || {},
              riskLevel: event.data?.risk_level || 'high',
              message: event.message || event.data?.error
            };
          }
          break;
        }

        case 'recovery_start': {
          updatedStatus = 'recovering';
          updatedActivities.unshift({
            timestamp,
            message: event.message,
            type: 'warning'
          });
          break;
        }

        case 'recovery_diagnosis': {
          updatedActivities.unshift({
            timestamp,
            message: event.message,
            type: 'info'
          });
          break;
        }

        case 'recovery_success': {
          updatedStatus = 'executing';
          updatedActivities.unshift({
            timestamp,
            message: event.message,
            type: 'success'
          });
          break;
        }

        case 'verification_start': {
          updatedStatus = 'verifying';
          updatedProgress = 92;
          updatedActivities.unshift({
            timestamp,
            message: event.message,
            type: 'info'
          });
          break;
        }

        case 'verification_results': {
          if (event.data) {
            verReport = event.data.report || event.data;
          }
          updatedActivities.unshift({
            timestamp,
            message: `Verification complete: ${event.message}`,
            type: event.data?.passed ? 'success' : 'warning'
          });
          break;
        }

        case 'git_commit': {
          if (tReport && event.data?.commit_hash) {
            tReport = {
              ...tReport,
              gitCheckpoint: event.data.commit_hash
            };
          }
          updatedActivities.unshift({
            timestamp,
            message: event.message,
            type: 'info'
          });
          break;
        }

        case 'TASK_COMPLETED':
        case 'task_complete': {
          updatedStatus = 'completed';
          updatedProgress = 100;
          updatedActiveTool = null;
          updatedPlan = updatedPlan.map((p) => ({ ...p, status: 'completed' as const }));
          approvalReq = null;

          const resData = event.data || {};
          const vReport = resData.verification_report || verReport;
          if (vReport) {
            verReport = vReport;
          }

          tReport = {
            task: state.currentTask.title || 'Autonomous Task',
            status: 'completed',
            filesChanged: resData.files_modified?.length || resData.files_changed || 0,
            testsPassed: resData.acceptance_criteria_met?.length || resData.tests_passed || (vReport?.overall_success ? 1 : 0),
            testsFailed: resData.acceptance_criteria_failed?.length || resData.tests_failed || 0,
            buildStatus: vReport?.build_status?.passed ? 'success' : vReport?.build_status ? 'failed' : 'skipped',
            recoveryAttempts: resData.recovery_attempts || 0,
            humanInterventions: resData.human_interventions || 0,
            executionTimeSeconds: Math.round(resData.execution_time_seconds || 0),
            gitCheckpoint: resData.git_checkpoint || (state.taskReport?.gitCheckpoint ?? null)
          };

          updatedActivities.unshift({
            timestamp,
            message: event.message || 'Task completed successfully',
            type: 'success'
          });
          break;
        }

        case 'TASK_FAILED':
        case 'fatal_error': {
          updatedStatus = 'error';
          updatedActiveTool = null;
          approvalReq = null;
          const resData = event.data || {};
          const vReport = resData.verification_report || verReport;
          if (vReport) {
            verReport = vReport;
          }

          tReport = {
            task: state.currentTask.title || 'Autonomous Task',
            status: 'failed',
            filesChanged: resData.files_modified?.length || resData.files_changed || 0,
            testsPassed: resData.acceptance_criteria_met?.length || resData.tests_passed || 0,
            testsFailed: resData.acceptance_criteria_failed?.length || resData.tests_failed || 1,
            buildStatus: vReport?.build_status?.passed ? 'success' : 'failed',
            recoveryAttempts: resData.recovery_attempts || 0,
            humanInterventions: resData.human_interventions || 0,
            executionTimeSeconds: Math.round(resData.execution_time_seconds || 0),
            gitCheckpoint: resData.git_checkpoint || null
          };

          updatedActivities.unshift({
            timestamp,
            message: event.message || 'Task failed',
            type: 'error'
          });
          break;
        }

        case 'TASK_STOPPED':
        case 'task_stopped': {
          updatedStatus = 'idle';
          updatedActiveTool = null;
          approvalReq = null;
          updatedActivities.unshift({
            timestamp,
            message: event.message || 'Task stopped by user',
            type: 'warning'
          });
          break;
        }

        default: {
          if (event.message) {
            updatedActivities.unshift({
              timestamp,
              message: event.message,
              type: 'info'
            });
          }
          break;
        }
      }

      return {
        events: nextEvents,
        agentStatus: updatedStatus,
        approvalRequest: approvalReq,
        verificationReport: verReport,
        taskReport: tReport,
        currentTask: {
          ...state.currentTask,
          status: updatedStatus,
          progress: updatedProgress,
          plan: updatedPlan,
          activities: updatedActivities
        },
        activeToolCall: updatedActiveTool
      };
    });
  },

  startExecution: async (taskId: string, prompt?: string, autonomyLevel?: AutonomyLevel) => {
    const currentAutonomy = autonomyLevel || get().currentTask.autonomyLevel || 'autonomous';

    if (activeWs) {
      activeWs.disconnect();
      activeWs = null;
    }

    const title = prompt || `Task ${taskId.substring(0, 8)}`;
    const newTask: AgentTask = {
      id: taskId,
      title,
      description: `Autonomous execution for: "${title}"`,
      autonomyLevel: currentAutonomy,
      status: 'executing',
      progress: 15,
      understandings: [
        `Executing compiled specification for task: ${taskId}`,
        'Applying planned codebase modifications',
        'Running verification test suite'
      ],
      plan: [],
      activities: [
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          message: `Execution initiated for task: ${taskId}`,
          type: 'info'
        }
      ]
    };

    set({
      taskId,
      agentStatus: 'executing',
      events: [],
      approvalRequest: null,
      verificationReport: null,
      taskReport: null,
      currentTask: newTask,
      isPaused: false,
      isLoading: true,
      error: null,
      activeToolCall: null,
      selectedToolCall: null
    });

    const ws = new AgentWebSocket(taskId);
    activeWs = ws;

    ws.onEvent((event: AgentEvent) => {
      get().addEvent(event);
    });

    ws.connect();

    try {
      const statusRes = await apiExecuteAgent({
        task_id: taskId,
        prompt: prompt,
        autonomy_level: currentAutonomy
      });

      set((state) => ({
        isLoading: false,
        agentStatus: (statusRes.status as AgentStatus) || state.agentStatus,
        currentTask: {
          ...state.currentTask,
          status: (statusRes.status as AgentStatus) || state.currentTask.status,
          progress: Math.max(state.currentTask.progress, Math.round(statusRes.progress * 100))
        }
      }));
    } catch (err: unknown) {
      const errMsg = err instanceof ApiError ? `[${err.code}] ${err.message}` : (err as Error).message;
      set((state) => ({
        isLoading: false,
        error: errMsg,
        agentStatus: 'error',
        currentTask: {
          ...state.currentTask,
          status: 'error',
          activities: [
            {
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              message: `Execution request error: ${errMsg}`,
              type: 'error'
            },
            ...state.currentTask.activities
          ]
        }
      }));
    }
  },

  approveStep: async (allowSession: boolean = false) => {
    const { taskId, approvalRequest } = get();
    if (!taskId) return;

    if (allowSession && approvalRequest?.tool) {
      sessionApprovedTools.add(approvalRequest.tool);
    }

    try {
      await apiApproveAgentStep(taskId);
      set({ approvalRequest: null, agentStatus: 'executing' });
    } catch (err) {
      console.error('Failed to approve step:', err);
    }
  },

  dismissApproval: () => {
    set({ approvalRequest: null });
  },

  stopAgent: async () => {
    const { taskId } = get();

    if (activeWs) {
      activeWs.disconnect();
      activeWs = null;
    }

    set((state) => ({
      agentStatus: 'idle',
      approvalRequest: null,
      isPaused: false,
      activeToolCall: null,
      currentTask: {
        ...state.currentTask,
        status: 'idle'
      }
    }));

    if (taskId) {
      try {
        await apiStopAgentTask(taskId);
      } catch {
        try {
          await apiStopAgent({ task_id: taskId });
        } catch (err) {
          console.warn('Failed to stop agent on backend:', err);
        }
      }
    }
  },

  pauseAgent: async () => {
    const { taskId } = get();
    set((state) => ({
      isPaused: true,
      agentStatus: 'paused',
      currentTask: {
        ...state.currentTask,
        status: 'paused'
      }
    }));

    if (taskId) {
      try {
        await apiPauseAgentTask(taskId);
      } catch (err) {
        console.warn('Failed to pause agent on backend:', err);
      }
    }
  },

  resumeAgent: async () => {
    const { taskId, currentTask } = get();
    set((state) => ({
      isPaused: false,
      agentStatus: 'executing',
      currentTask: {
        ...state.currentTask,
        status: 'executing'
      }
    }));

    if (taskId) {
      try {
        await apiResumeAgentTask(taskId);
      } catch {
        try {
          await apiExecuteAgent({
            task_id: taskId,
            autonomy_level: currentTask.autonomyLevel
          });
        } catch (err) {
          console.warn('Failed to resume agent execution:', err);
        }
      }
    }
  },

  setAutonomyLevel: (level: AutonomyLevel) => {
    set((state) => ({
      currentTask: {
        ...state.currentTask,
        autonomyLevel: level
      }
    }));
  },

  startNewTask: async (title: string, autonomyLevel?: AutonomyLevel) => {
    const currentAutonomy = autonomyLevel || get().currentTask.autonomyLevel || 'autonomous';

    if (activeWs) {
      activeWs.disconnect();
      activeWs = null;
    }

    let projectId = useProjectStore.getState().projectId;
    const projectPath = useProjectStore.getState().projectPath;

    if (!projectId && projectPath) {
      try {
        const proj = await apiOpenProject(projectPath);
        projectId = proj.id;
        useProjectStore.setState({ projectId: proj.id, project: proj });
      } catch {
        // Fallback if backend offline
      }
    }

    let taskId = `task-${Date.now().toString(36)}`;
    if (projectId) {
      try {
        const created = await apiCreateTask({
          project_id: projectId,
          requirement: title
        });
        taskId = created.id;
      } catch (err) {
        console.warn('Could not register task with backend DB:', err);
      }
    }

    await get().startExecution(taskId, title, currentAutonomy);
  },

  runNextStep: () => {
    set((state) => {
      const plan = [...state.currentTask.plan];
      const inProgressIdx = plan.findIndex((p) => p.status === 'in_progress');
      if (inProgressIdx !== -1) {
        plan[inProgressIdx] = { ...plan[inProgressIdx], status: 'completed' };
        if (inProgressIdx + 1 < plan.length) {
          plan[inProgressIdx + 1] = { ...plan[inProgressIdx + 1], status: 'in_progress' };
        }
      } else {
        const firstPending = plan.findIndex((p) => p.status === 'pending');
        if (firstPending !== -1) {
          plan[firstPending] = { ...plan[firstPending], status: 'in_progress' };
        }
      }

      const completedCount = plan.filter((p) => p.status === 'completed').length;
      const progress = plan.length > 0 ? Math.round((completedCount / plan.length) * 100) : 100;
      const isDone = completedCount === plan.length && plan.length > 0;

      return {
        currentTask: {
          ...state.currentTask,
          plan,
          progress,
          status: (isDone ? 'completed' : 'executing') as AgentStatus
        }
      };
    });
  },

  setSelectedToolCall: (tc: ToolCall | null) => set({ selectedToolCall: tc }),

  simulateFullFlow: () => {
    const demoTask: AgentTask = {
      ...initialTask,
      id: `task-demo-${Date.now().toString(36)}`,
      title: 'Demo Workflow',
      status: 'completed',
      progress: 100
    };
    set({
      taskId: demoTask.id,
      agentStatus: 'completed',
      currentTask: demoTask,
      taskReport: {
        task: 'Demo Workflow',
        status: 'completed',
        filesChanged: 3,
        testsPassed: 5,
        testsFailed: 0,
        buildStatus: 'success',
        recoveryAttempts: 1,
        humanInterventions: 0,
        executionTimeSeconds: 14,
        gitCheckpoint: 'a1b2c3d'
      },
      verificationReport: {
        build_status: { name: 'Build Check', passed: true, output: '0 compilation errors' },
        test_status: { name: 'Test Suite', passed: true, output: '5/5 passed' },
        lint_status: { name: 'Linter', passed: true, output: 'Clean' },
        requirements_met: [
          { criterion: 'Implement responsive drawer', met: true, evidence: 'Verified component render' },
          { criterion: 'Type-safe WebSocket events', met: true, evidence: 'Validated TypeScript schemas' }
        ],
        files_changed_count: 3,
        overall_success: true,
        summary: 'All checks passed successfully.',
        passed: true
      }
    });
  },

  fetchStatus: async (taskId?: string) => {
    const targetId = taskId || get().taskId || get().currentTask.id;
    if (!targetId) return;

    try {
      const res = await apiGetAgentStatus(targetId);
      set((state) => ({
        agentStatus: (res.status as AgentStatus) || state.agentStatus,
        currentTask: {
          ...state.currentTask,
          status: (res.status as AgentStatus) || state.currentTask.status,
          progress: Math.round(res.progress * 100)
        }
      }));
    } catch (err) {
      console.warn('Failed to fetch agent status:', err);
    }
  },

  loadVerificationReport: async (taskId?: string) => {
    const targetId = taskId || get().taskId;
    if (!targetId) return;

    try {
      const report = await apiGetAgentVerificationReport(targetId);
      set({ verificationReport: report });
    } catch {
      try {
        const report = await apiVerifyAgentTask(targetId);
        set({ verificationReport: report });
      } catch (err) {
        console.warn('Failed to fetch verification report:', err);
      }
    }
  }
}));
