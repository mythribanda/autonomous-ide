import { create } from 'zustand';
import { PromptSpecification } from '../types';
import { MOCK_PROMPT_SPEC } from '../services/mockData';
import { AutonomousAPI } from '../services/api';

interface PromptState {
  rawPrompt: string;
  isCompiling: boolean;
  spec: PromptSpecification;
  history: PromptSpecification[];
  
  // Actions
  setRawPrompt: (val: string) => void;
  compileRequirement: () => Promise<void>;
  toggleCriteria: (id: string) => void;
  approveAndPlan: () => void;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  rawPrompt: 'Add attendance tracking to my student application',
  isCompiling: false,
  spec: MOCK_PROMPT_SPEC,
  history: [MOCK_PROMPT_SPEC],

  setRawPrompt: (rawPrompt) => set({ rawPrompt }),

  compileRequirement: async () => {
    const { rawPrompt } = get();
    if (!rawPrompt.trim()) return;
    set({ isCompiling: true });
    try {
      const compiled = await AutonomousAPI.compilePrompt({ prompt: rawPrompt });
      set((state) => ({
        isCompiling: false,
        spec: compiled,
        history: [compiled, ...state.history]
      }));
    } catch {
      set({ isCompiling: false });
    }
  },

  toggleCriteria: (id) => {
    set((state) => ({
      spec: {
        ...state.spec,
        acceptanceCriteria: state.spec.acceptanceCriteria.map((ac) =>
          ac.id === id ? { ...ac, completed: !ac.completed } : ac
        )
      }
    }));
  },

  approveAndPlan: () => {
    // Bridges to agent store
  }
}));
