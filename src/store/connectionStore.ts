import { create } from 'zustand';
import { getHealth, getOllamaHealth } from '../lib/api';
import { BackendStatus, OllamaStatus } from '../types/api';

interface ConnectionState {
  backendStatus: BackendStatus;
  ollamaStatus: OllamaStatus;
  ollamaModels: string[];
  lastChecked: Date | null;
  pollIntervalId: any | null;

  setBackendStatus: (status: BackendStatus) => void;
  setOllamaStatus: (status: OllamaStatus) => void;
  setOllamaModels: (models: string[]) => void;
  checkConnections: () => Promise<void>;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  backendStatus: 'connecting',
  ollamaStatus: 'connecting',
  ollamaModels: [],
  lastChecked: null,
  pollIntervalId: null,

  setBackendStatus: (backendStatus: BackendStatus) => set({ backendStatus }),
  setOllamaStatus: (ollamaStatus: OllamaStatus) => set({ ollamaStatus }),
  setOllamaModels: (ollamaModels: string[]) => set({ ollamaModels }),

  checkConnections: async () => {
    // 1. Check Backend Health
    let backendOk = false;
    try {
      const health = await getHealth();
      if (health && health.status === 'ok') {
        backendOk = true;
        set({ backendStatus: 'connected' });
      } else {
        set({ backendStatus: 'error' });
      }
    } catch {
      set({ backendStatus: 'error' });
    }

    // 2. Check Ollama Health
    if (backendOk) {
      try {
        const ollama = await getOllamaHealth();
        if (ollama.connected) {
          set({
            ollamaStatus: 'connected',
            ollamaModels: ollama.models || []
          });
        } else {
          set({
            ollamaStatus: 'unavailable',
            ollamaModels: []
          });
        }
      } catch {
        set({
          ollamaStatus: 'unavailable',
          ollamaModels: []
        });
      }
    } else {
      set({
        ollamaStatus: 'unavailable',
        ollamaModels: []
      });
    }

    set({ lastChecked: new Date() });

    // Automatically ensure 30s polling is running
    if (!get().pollIntervalId) {
      get().startPolling(30000);
    }
  },

  startPolling: (intervalMs: number = 30000) => {
    const existing = get().pollIntervalId;
    if (existing) {
      clearInterval(existing);
    }
    const intervalId = setInterval(() => {
      get().checkConnections();
    }, intervalMs);

    set({ pollIntervalId: intervalId });
  },

  stopPolling: () => {
    const existing = get().pollIntervalId;
    if (existing) {
      clearInterval(existing);
      set({ pollIntervalId: null });
    }
  }
}));
