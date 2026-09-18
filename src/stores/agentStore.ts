import { create } from 'zustand';
import { AgentTask, AutonomyLevel, AgentStatus, ToolCall } from '../types';
import { MOCK_AGENT_TASK } from '../services/mockData';

interface AgentState {
  currentTask: AgentTask;
  isPaused: boolean;
  activeToolCall: ToolCall | null;
  selectedToolCall: ToolCall | null;
  
  // Actions
  setAutonomyLevel: (level: AutonomyLevel) => void;
  startNewTask: (title: string, autonomyLevel?: AutonomyLevel) => void;
  stopAgent: () => void;
  pauseAgent: () => void;
  resumeAgent: () => void;
  runNextStep: () => void;
  setSelectedToolCall: (tc: ToolCall | null) => void;
  simulateFullFlow: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  currentTask: MOCK_AGENT_TASK,
  isPaused: false,
  activeToolCall: MOCK_AGENT_TASK.activities[3]?.toolCall || null,
  selectedToolCall: MOCK_AGENT_TASK.activities[2]?.toolCall || null,

  setAutonomyLevel: (level) => {
    set((state) => ({
      currentTask: {
        ...state.currentTask,
        autonomyLevel: level
      }
    }));
  },

  startNewTask: (title, autonomyLevel) => {
    const newTask: AgentTask = {
      id: `task-${Date.now().toString(36)}`,
      title,
      description: `Autonomous software engineering workflow for: "${title}"`,
      autonomyLevel: autonomyLevel || get().currentTask.autonomyLevel,
      status: 'planning',
      progress: 15,
      understandings: [
        `Analyze architecture for: ${title}`,
        'Trace AST call sites and dependencies',
        'Generate patch set and isolated unit tests',
        'Execute verification suite with self-recovery'
      ],
      plan: [
        {
          id: 'step-1',
          title: 'Analyze project architecture',
          description: 'Scan AST and locate entry points.',
          status: 'in_progress'
        },
        {
          id: 'step-2',
          title: 'Generate implementation specification',
          description: 'Draft structural changes and interface definitions.',
          status: 'pending'
        },
        {
          id: 'step-3',
          title: 'Apply atomic code edits',
          description: 'Modify identified frontend and backend files.',
          status: 'pending'
        },
        {
          id: 'step-4',
          title: 'Run test verification suite',
          description: 'Ensure 0 regressions and high coverage.',
          status: 'pending'
        }
      ],
      activities: [
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          message: `Task started: "${title}"`,
          type: 'info'
        }
      ]
    };
    set({ currentTask: newTask, isPaused: false });
  },

  stopAgent: () => {
    set((state) => ({
      currentTask: {
        ...state.currentTask,
        status: 'idle'
      },
      isPaused: false
    }));
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

  resumeAgent: () => {
    set((state) => ({
      isPaused: false,
      currentTask: {
        ...state.currentTask,
        status: 'executing'
      }
    }));
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
      const progress = Math.round((completedCount / plan.length) * 100);
      const isDone = completedCount === plan.length;

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
    // Reset to demo state
    set({ currentTask: MOCK_AGENT_TASK });
  }
}));
