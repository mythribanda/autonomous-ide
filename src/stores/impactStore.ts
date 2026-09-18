import { create } from 'zustand';
import { ImpactAnalysisResult } from '../types';
import { MOCK_IMPACT_ANALYSIS } from '../services/mockData';

interface ImpactState {
  impact: ImpactAnalysisResult;
  selectedFile: string | null;
  isPlanApproved: boolean;
  
  // Actions
  setSelectedFile: (file: string | null) => void;
  approveImpactPlan: () => void;
}

export const useImpactStore = create<ImpactState>((set) => ({
  impact: MOCK_IMPACT_ANALYSIS,
  selectedFile: 'backend/models/student_model.py',
  isPlanApproved: false,

  setSelectedFile: (file) => set({ selectedFile: file }),
  approveImpactPlan: () => set({ isPlanApproved: true })
}));
