import { create } from 'zustand';
import { ActivityView } from '../types';

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

interface UIState {
  activeView: ActivityView;
  isAgentPanelOpen: boolean;
  isCommandPaletteOpen: boolean;
  explorerWidth: number;
  agentPanelWidth: number;
  terminalHeight: number;
  toasts: Toast[];
  
  // Actions
  setActiveView: (view: ActivityView) => void;
  toggleAgentPanel: () => void;
  setAgentPanelOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setExplorerWidth: (w: number) => void;
  setAgentPanelWidth: (w: number) => void;
  setTerminalHeight: (h: number) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'explorer',
  isAgentPanelOpen: true,
  isCommandPaletteOpen: false,
  explorerWidth: 260,
  agentPanelWidth: 380,
  terminalHeight: 220,
  toasts: [],

  setActiveView: (activeView) => set({ activeView }),
  toggleAgentPanel: () => set((state) => ({ isAgentPanelOpen: !state.isAgentPanelOpen })),
  setAgentPanelOpen: (isAgentPanelOpen) => set({ isAgentPanelOpen }),
  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
  setExplorerWidth: (explorerWidth) => set({ explorerWidth }),
  setAgentPanelWidth: (agentPanelWidth) => set({ agentPanelWidth }),
  setTerminalHeight: (terminalHeight) => set({ terminalHeight }),

  addToast: (t) => {
    const id = `toast-${Date.now()}`;
    set((state) => ({
      toasts: [...state.toasts, { ...t, id }]
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((item) => item.id !== id)
      }));
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  }
}));
