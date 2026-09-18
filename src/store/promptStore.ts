import { create } from 'zustand';
import { CompiledSpec, ImplementationStep } from '../types/api';
import { AutonomyLevel } from '../types';
import { compileAgentRequirement, ApiError } from '../lib/api';
import { AgentWebSocket } from '../lib/websocket';
import { useAgentStore } from '../stores/agentStore';
import { useProjectStore } from './projectStore';
import { useUIStore } from '../stores/uiStore';

export type PromptMode = 'Assist' | 'Guided' | 'Autonomous';

export interface StepStatus {
  status: 'idle' | 'running' | 'done' | 'error';
  result?: any;
}

export interface CompilerSteps {
  intent_detection: StepStatus;
  requirement_extraction: StepStatus;
  technical_planning: StepStatus;
  spec_complete: {
    status: 'idle' | 'running' | 'done' | 'error';
    spec?: CompiledSpec;
  };
}

export interface PromptState {
  requirement: string;
  mode: PromptMode;
  compiledSpec: CompiledSpec | null;
  compilerSteps: CompilerSteps;
  isCompiling: boolean;
  taskId: string | null;
  attachedFiles: string[];
  isEditingSpec: boolean;
  isPanelOpen: boolean;
  compileError: string | null;

  // Actions
  setRequirement: (requirement: string) => void;
  setMode: (mode: PromptMode) => void;
  addAttachedFiles: (files: string[]) => void;
  removeAttachedFile: (fileName: string) => void;
  clearAttachedFiles: () => void;
  compileRequirement: (text?: string, mode?: PromptMode) => Promise<void>;
  editSpec: (updates: Partial<CompiledSpec>) => void;
  executeSpec: () => Promise<void>;
  cancelCompilation: () => void;
  setIsEditingSpec: (isEditing: boolean) => void;
  setIsPanelOpen: (isOpen: boolean) => void;
  reset: () => void;
}

const initialCompilerSteps: CompilerSteps = {
  intent_detection: { status: 'idle' },
  requirement_extraction: { status: 'idle' },
  technical_planning: { status: 'idle' },
  spec_complete: { status: 'idle' }
};

let activeCompilerWs: AgentWebSocket | null = null;

export const usePromptStore = create<PromptState>((set, get) => ({
  requirement: '',
  mode: 'Guided',
  compiledSpec: null,
  compilerSteps: initialCompilerSteps,
  isCompiling: false,
  taskId: null,
  attachedFiles: [],
  isEditingSpec: false,
  isPanelOpen: false,
  compileError: null,

  setRequirement: (requirement) => set({ requirement }),

  setMode: (mode) => set({ mode }),

  addAttachedFiles: (files) => {
    set((state) => {
      const existing = new Set(state.attachedFiles);
      const toAdd = files.filter((f) => !existing.has(f));
      return { attachedFiles: [...state.attachedFiles, ...toAdd] };
    });
  },

  removeAttachedFile: (fileName) => {
    set((state) => ({
      attachedFiles: state.attachedFiles.filter((f) => f !== fileName)
    }));
  },

  clearAttachedFiles: () => set({ attachedFiles: [] }),

  setIsEditingSpec: (isEditingSpec) => set({ isEditingSpec }),

  setIsPanelOpen: (isPanelOpen) => set({ isPanelOpen }),

  compileRequirement: async (text?: string, mode?: PromptMode) => {
    const activeText = text !== undefined ? text : get().requirement;
    const activeMode = mode !== undefined ? mode : get().mode;

    if (text !== undefined) set({ requirement: text });
    if (mode !== undefined) set({ mode });

    if (!activeText.trim()) return;

    if (activeCompilerWs) {
      activeCompilerWs.disconnect();
      activeCompilerWs = null;
    }

    const tempTaskId = `task-${Date.now().toString(36)}`;

    set({
      isCompiling: true,
      compileError: null,
      isPanelOpen: true,
      compiledSpec: null,
      taskId: tempTaskId,
      compilerSteps: {
        intent_detection: { status: 'running' },
        requirement_extraction: { status: 'idle' },
        technical_planning: { status: 'idle' },
        spec_complete: { status: 'idle' }
      }
    });

    // 1. Setup live WebSocket listener for compiler steps
    const ws = new AgentWebSocket(tempTaskId);
    activeCompilerWs = ws;

    ws.onEvent((event) => {
      const rawData = event.data || {};
      const stepName = rawData.step || event.type;
      const stepStatus = rawData.status || 'done';

      set((state) => {
        const steps = { ...state.compilerSteps };

        if (stepName === 'intent_detection') {
          steps.intent_detection = {
            status: stepStatus === 'running' ? 'running' : 'done',
            result: rawData.result
          };
          if (stepStatus === 'done' && steps.requirement_extraction.status === 'idle') {
            steps.requirement_extraction = { status: 'running' };
          }
        } else if (stepName === 'requirement_extraction') {
          steps.requirement_extraction = {
            status: stepStatus === 'running' ? 'running' : 'done',
            result: rawData.result
          };
          if (stepStatus === 'done' && steps.technical_planning.status === 'idle') {
            steps.technical_planning = { status: 'running' };
          }
        } else if (stepName === 'technical_planning') {
          steps.technical_planning = {
            status: stepStatus === 'running' ? 'running' : 'done',
            result: rawData.result
          };
        } else if (stepName === 'spec_complete') {
          steps.spec_complete = {
            status: 'done',
            spec: rawData.spec
          };
          if (rawData.spec) {
            return {
              compilerSteps: steps,
              compiledSpec: rawData.spec,
              taskId: rawData.spec.task_id || state.taskId,
              isCompiling: false
            };
          }
        }

        return { compilerSteps: steps };
      });
    });

    ws.connect();

    // 2. Resolve project ID
    const projectId = useProjectStore.getState().projectId || 'default-project';

    // 3. Post to compile endpoint
    try {
      const spec = await compileAgentRequirement({
        requirement: activeText,
        project_id: projectId,
        task_id: tempTaskId
      });

      set((state) => ({
        isCompiling: false,
        compiledSpec: spec,
        taskId: spec.task_id || tempTaskId,
        compilerSteps: {
          intent_detection: {
            status: 'done',
            result: state.compilerSteps.intent_detection.result || { intent: spec.intent }
          },
          requirement_extraction: {
            status: 'done',
            result: state.compilerSteps.requirement_extraction.result || {
              explicit_requirements: spec.explicit_requirements
            }
          },
          technical_planning: {
            status: 'done',
            result: state.compilerSteps.technical_planning.result || {
              implementation_steps: spec.implementation_steps
            }
          },
          spec_complete: {
            status: 'done',
            spec
          }
        }
      }));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Compilation request failed';
      set({
        isCompiling: false,
        compileError: msg,
        compilerSteps: {
          intent_detection: { status: 'error' },
          requirement_extraction: { status: 'error' },
          technical_planning: { status: 'error' },
          spec_complete: { status: 'error' }
        }
      });
    }
  },

  editSpec: (updates) => {
    set((state) => {
      if (!state.compiledSpec) return state;
      return {
        compiledSpec: {
          ...state.compiledSpec,
          ...updates
        }
      };
    });
  },

  executeSpec: async () => {
    const { taskId, compiledSpec, requirement, mode } = get();
    const effectiveTaskId = taskId || compiledSpec?.task_id;
    if (!effectiveTaskId) return;

    // Convert mode to agent autonomy level
    const autonomyLevel: AutonomyLevel =
      mode === 'Autonomous' ? 'autonomous' : mode === 'Assist' ? 'assist' : 'guided';

    // Delegate to agent store
    await useAgentStore.getState().startExecution(
      effectiveTaskId,
      compiledSpec?.intent || requirement,
      autonomyLevel
    );

    // Open Agent Panel in UI
    useUIStore.getState().setAgentPanelOpen(true);
    set({ isPanelOpen: false });
  },

  cancelCompilation: () => {
    if (activeCompilerWs) {
      activeCompilerWs.disconnect();
      activeCompilerWs = null;
    }
    set({ isCompiling: false });
  },

  reset: () => {
    if (activeCompilerWs) {
      activeCompilerWs.disconnect();
      activeCompilerWs = null;
    }
    set({
      requirement: '',
      compiledSpec: null,
      compilerSteps: initialCompilerSteps,
      isCompiling: false,
      taskId: null,
      attachedFiles: [],
      isEditingSpec: false,
      isPanelOpen: false,
      compileError: null
    });
  }
}));
