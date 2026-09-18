import { create } from 'zustand';
import { AgentTask, AutonomyLevel, AgentStatus, ToolCall, ToolType } from '../types';
import {
  executeAgent as apiExecuteAgent,
  stopAgent as apiStopAgent,
  getAgentStatus as apiGetAgentStatus,
  createTask as apiCreateTask,
  openProject as apiOpenProject,
  ApiError
} from '../lib/api';
import { AgentWebSocket } from '../lib/websocket';
import { AgentEvent } from '../types/api';
import { useProjectStore } from '../store/projectStore';

interface AgentState {
  currentTask: AgentTask;
  isPaused: boolean;
  isLoading: boolean;
  error: string | null;
  activeToolCall: ToolCall | null;
  selectedToolCall: ToolCall | null;
  
  // Actions
  setAutonomyLevel: (level: AutonomyLevel) => void;
  startNewTask: (title: string, autonomyLevel?: AutonomyLevel) => Promise<void>;
  startExecution: (taskId: string, prompt?: string, autonomyLevel?: AutonomyLevel) => Promise<void>;
  stopAgent: () => Promise<void>;
  pauseAgent: () => void;
  resumeAgent: () => Promise<void>;
  runNextStep: () => void;
  setSelectedToolCall: (tc: ToolCall | null) => void;
  simulateFullFlow: () => void;
  fetchStatus: (taskId?: string) => Promise<void>;
}

// Module-level active WebSocket stream reference
let activeWs: AgentWebSocket | null = null;

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

export const useAgentStore = create<AgentState>((set, get) => ({
  currentTask: initialTask,
  isPaused: false,
  isLoading: false,
  error: null,
  activeToolCall: null,
  selectedToolCall: null,

  setAutonomyLevel: (level) => {
    set((state) => ({
      currentTask: {
        ...state.currentTask,
        autonomyLevel: level
      }
    }));
  },

  startNewTask: async (title: string, autonomyLevel?: AutonomyLevel) => {
    const currentAutonomy = autonomyLevel || get().currentTask.autonomyLevel || 'autonomous';

    // Disconnect any existing live socket
    if (activeWs) {
      activeWs.disconnect();
      activeWs = null;
    }

    // 1. Resolve project ID from projectStore
    let projectId = useProjectStore.getState().projectId;
    const projectPath = useProjectStore.getState().projectPath;

    if (!projectId && projectPath) {
      try {
        const proj = await apiOpenProject(projectPath);
        projectId = proj.id;
        useProjectStore.setState({ projectId: proj.id, project: proj });
      } catch {
        // Continue with fallback handling if backend is unavailable
      }
    }

    // 2. Create Task in DB or generate a fallback task ID
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

    // 3. Initialize currentTask in store
    const newTask: AgentTask = {
      id: taskId,
      title,
      description: `Autonomous software engineering workflow for: "${title}"`,
      autonomyLevel: currentAutonomy,
      status: 'planning',
      progress: 10,
      understandings: [
        `Analyze architecture for: ${title}`,
        'Trace AST call sites and dependencies',
        'Generate patch set and isolated unit tests',
        'Execute verification suite with self-recovery'
      ],
      plan: [
        {
          id: 'step-1',
          title: 'Analyze workspace context',
          description: 'Scan AST and locate entry points.',
          status: 'in_progress'
        },
        {
          id: 'step-2',
          title: 'Formulate execution plan',
          description: 'Draft structural changes and interface definitions.',
          status: 'pending'
        },
        {
          id: 'step-3',
          title: 'Apply codebase changes',
          description: 'Execute file modifications and code generation.',
          status: 'pending'
        },
        {
          id: 'step-4',
          title: 'Verify operations & test suite',
          description: 'Ensure 0 regressions and high coverage.',
          status: 'pending'
        }
      ],
      activities: [
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          message: `Task initiated: "${title}"`,
          type: 'info'
        }
      ]
    };

    set({
      currentTask: newTask,
      isPaused: false,
      activeToolCall: null,
      selectedToolCall: null,
      error: null,
      isLoading: true
    });

    // 4. Attach AgentWebSocket for live updates
    const ws = new AgentWebSocket(taskId);
    activeWs = ws;

    ws.onEvent((event: AgentEvent) => {
      const timestamp = event.timestamp
        ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      set((state) => {
        if (state.currentTask.id !== taskId) return state;

        const updatedActivities = [...state.currentTask.activities];
        let updatedStatus: AgentStatus = state.currentTask.status;
        let updatedProgress = state.currentTask.progress;
        let updatedPlan = [...state.currentTask.plan];
        let updatedActiveTool = state.activeToolCall;

        switch (event.type) {
          case 'TASK_STARTED': {
            updatedStatus = 'executing';
            updatedProgress = Math.max(updatedProgress, 15);
            updatedActivities.unshift({
              timestamp,
              message: event.message,
              type: 'info'
            });
            break;
          }

          case 'PLAN_GENERATED': {
            updatedProgress = Math.max(updatedProgress, 35);
            if (event.data && Array.isArray(event.data.steps)) {
              updatedPlan = event.data.steps.map((stepName: string, idx: number) => ({
                id: `step-${idx + 1}`,
                title: stepName,
                description: `Phase ${idx + 1} execution step`,
                status: idx === 0 ? 'completed' : idx === 1 ? 'in_progress' : 'pending'
              }));
            }
            updatedActivities.unshift({
              timestamp,
              message: event.message,
              type: 'info'
            });
            break;
          }

          case 'TOOL_CALL': {
            updatedProgress = Math.max(updatedProgress, 70);
            const toolType = (event.data?.tool as ToolType) || 'WRITE_FILE';
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

            // Transition plan step to in_progress/completed
            if (updatedPlan.length >= 3) {
              updatedPlan = updatedPlan.map((p, idx) => {
                if (idx < 2) return { ...p, status: 'completed' as const };
                if (idx === 2) return { ...p, status: 'in_progress' as const };
                return p;
              });
            }
            break;
          }

          case 'TASK_COMPLETED': {
            updatedStatus = 'completed';
            updatedProgress = 100;
            updatedActiveTool = null;
            updatedPlan = updatedPlan.map((p) => ({ ...p, status: 'completed' as const }));
            updatedActivities.unshift({
              timestamp,
              message: event.message,
              type: 'success'
            });
            break;
          }

          case 'TASK_STOPPED': {
            updatedStatus = 'idle';
            updatedActiveTool = null;
            updatedActivities.unshift({
              timestamp,
              message: event.message,
              type: 'warning'
            });
            break;
          }

          case 'TASK_ERROR': {
            updatedStatus = 'error';
            updatedActiveTool = null;
            updatedActivities.unshift({
              timestamp,
              message: event.message,
              type: 'error'
            });
            break;
          }

          case 'WS_CONNECTED': {
            updatedActivities.unshift({
              timestamp,
              message: 'Connected to live agent WebSocket stream',
              type: 'info'
            });
            break;
          }

          case 'WS_ERROR':
          case 'WS_MAX_RETRIES': {
            updatedActivities.unshift({
              timestamp,
              message: event.message,
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
    });

    ws.connect();

    // 5. Trigger backend execution matching backend/schemas.py AgentExecuteRequest
    try {
      const statusRes = await apiExecuteAgent({
        task_id: taskId,
        prompt: title,
        autonomy_level: currentAutonomy
      });

      set((state) => ({
        isLoading: false,
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

  startExecution: async (taskId: string, prompt?: string, autonomyLevel?: AutonomyLevel) => {
    const currentAutonomy = autonomyLevel || get().currentTask.autonomyLevel || 'autonomous';

    if (activeWs) {
      activeWs.disconnect();
      activeWs = null;
    }

    const newTask: AgentTask = {
      id: taskId,
      title: prompt || 'Autonomous AI Execution',
      description: `Executing plan for task "${taskId}"`,
      autonomyLevel: currentAutonomy,
      status: 'executing',
      progress: 20,
      understandings: [
        `Executing compiled specification for task: ${taskId}`,
        'Applying planned codebase modifications',
        'Running verification test suite'
      ],
      plan: [
        { id: 'step-1', title: 'Load compiled specification', description: 'Validate plan steps', status: 'completed' },
        { id: 'step-2', title: 'Apply code modifications', description: 'Perform file changes', status: 'in_progress' },
        { id: 'step-3', title: 'Verify and run tests', description: 'Validate modifications', status: 'pending' }
      ],
      activities: [
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          message: `Execution initiated for task: ${taskId}`,
          type: 'info'
        }
      ]
    };

    set({
      currentTask: newTask,
      isPaused: false,
      activeToolCall: null,
      selectedToolCall: null,
      error: null,
      isLoading: true
    });

    const ws = new AgentWebSocket(taskId);
    activeWs = ws;

    ws.onEvent((event: AgentEvent) => {
      const timestamp = event.timestamp
        ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      set((state) => {
        if (state.currentTask.id !== taskId) return state;

        const updatedActivities = [...state.currentTask.activities];
        let updatedStatus: AgentStatus = state.currentTask.status;
        let updatedProgress = state.currentTask.progress;
        let updatedPlan = [...state.currentTask.plan];
        let updatedActiveTool = state.activeToolCall;

        switch (event.type) {
          case 'TASK_STARTED': {
            updatedStatus = 'executing';
            updatedProgress = Math.max(updatedProgress, 25);
            updatedActivities.unshift({ timestamp, message: event.message, type: 'info' });
            break;
          }
          case 'PLAN_GENERATED': {
            updatedProgress = Math.max(updatedProgress, 40);
            if (event.data && Array.isArray(event.data.steps)) {
              updatedPlan = event.data.steps.map((stepName: string, idx: number) => ({
                id: `step-${idx + 1}`,
                title: stepName,
                description: `Phase ${idx + 1} execution step`,
                status: idx === 0 ? 'completed' : idx === 1 ? 'in_progress' : 'pending'
              }));
            }
            updatedActivities.unshift({ timestamp, message: event.message, type: 'info' });
            break;
          }
          case 'TOOL_CALL': {
            updatedProgress = Math.max(updatedProgress, 75);
            const toolType = (event.data?.tool as ToolType) || 'WRITE_FILE';
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
            updatedActivities.unshift({ timestamp, message: event.message, type: 'tool', toolCall });
            break;
          }
          case 'TASK_COMPLETED': {
            updatedStatus = 'completed';
            updatedProgress = 100;
            updatedActiveTool = null;
            updatedPlan = updatedPlan.map((p) => ({ ...p, status: 'completed' as const }));
            updatedActivities.unshift({ timestamp, message: event.message, type: 'success' });
            break;
          }
          case 'TASK_STOPPED': {
            updatedStatus = 'idle';
            updatedActiveTool = null;
            updatedActivities.unshift({ timestamp, message: event.message, type: 'warning' });
            break;
          }
          case 'TASK_ERROR': {
            updatedStatus = 'error';
            updatedActiveTool = null;
            updatedActivities.unshift({ timestamp, message: event.message, type: 'error' });
            break;
          }
          default: {
            if (event.message) {
              updatedActivities.unshift({ timestamp, message: event.message, type: 'info' });
            }
            break;
          }
        }

        return {
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

  stopAgent: async () => {
    const { currentTask } = get();

    if (activeWs) {
      activeWs.disconnect();
      activeWs = null;
    }

    set((state) => ({
      currentTask: {
        ...state.currentTask,
        status: 'idle'
      },
      isPaused: false,
      activeToolCall: null
    }));

    if (currentTask.id) {
      try {
        const res = await apiStopAgent({ task_id: currentTask.id });
        set((state) => ({
          currentTask: {
            ...state.currentTask,
            status: (res.status as AgentStatus) || 'idle'
          }
        }));
      } catch (err) {
        console.warn('Failed to stop agent on backend:', err);
      }
    }
  },

  pauseAgent: () => {
    set((state) => ({
      isPaused: true,
      currentTask: {
        ...state.currentTask,
        status: 'paused'
      }
    }));
  },

  resumeAgent: async () => {
    const { currentTask } = get();
    set((state) => ({
      isPaused: false,
      currentTask: {
        ...state.currentTask,
        status: 'executing'
      }
    }));

    if (currentTask.id) {
      try {
        await apiExecuteAgent({
          task_id: currentTask.id,
          autonomy_level: currentTask.autonomyLevel
        });
      } catch (err) {
        console.warn('Failed to resume agent execution:', err);
      }
    }
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

  setSelectedToolCall: (tc) => set({ selectedToolCall: tc }),

  simulateFullFlow: () => {
    set({
      currentTask: {
        ...initialTask,
        id: `task-demo-${Date.now().toString(36)}`,
        title: 'Demo Workflow',
        status: 'completed',
        progress: 100
      }
    });
  },

  fetchStatus: async (taskId?: string) => {
    const targetId = taskId || get().currentTask.id;
    if (!targetId) return;

    try {
      const res = await apiGetAgentStatus(targetId);
      set((state) => ({
        currentTask: {
          ...state.currentTask,
          status: (res.status as AgentStatus) || state.currentTask.status,
          progress: Math.round(res.progress * 100)
        }
      }));
    } catch (err) {
      console.warn('Failed to fetch agent status:', err);
    }
  }
}));

