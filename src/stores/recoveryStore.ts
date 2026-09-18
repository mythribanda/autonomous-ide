import { create } from 'zustand';
import { RecoveryStep } from '../types';
import { MOCK_RECOVERY_STEPS } from '../services/mockData';

interface RecoveryState {
  steps: RecoveryStep[];
  isSimulatingRecovery: boolean;
  activeAttemptIndex: number;
  
  // Actions
  triggerAutonomousRecovery: () => Promise<void>;
  resetRecovery: () => void;
}

export const useRecoveryStore = create<RecoveryState>((set) => ({
  steps: MOCK_RECOVERY_STEPS,
  isSimulatingRecovery: false,
  activeAttemptIndex: 1,

  triggerAutonomousRecovery: async () => {
    set({ isSimulatingRecovery: true, activeAttemptIndex: 0 });
    await new Promise((r) => setTimeout(r, 600));
    set({ activeAttemptIndex: 1, isSimulatingRecovery: false });
  },

  resetRecovery: () => set({ steps: MOCK_RECOVERY_STEPS, isSimulatingRecovery: false, activeAttemptIndex: 1 })
}));
