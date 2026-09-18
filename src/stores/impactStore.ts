import { create } from 'zustand';
import { ImpactReport } from '../types/api';
import { getImpactAnalysis, openProject, ApiError } from '../lib/api';
import { useProjectStore } from '../store/projectStore';

export interface ImpactState {
  report: ImpactReport | null;
  task: string;
  selectedFile: string | null;
  isPlanApproved: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchImpactAnalysis: (requirement: string, projectId?: string) => Promise<ImpactReport | null>;
  setSelectedFile: (file: string | null) => void;
  approveImpactPlan: () => void;
  setTask: (task: string) => void;
  clearImpact: () => void;
}

export const useImpactStore = create<ImpactState>((set, get) => ({
  report: null,
  task: '',
  selectedFile: null,
  isPlanApproved: false,
  isLoading: false,
  error: null,

  fetchImpactAnalysis: async (requirement: string, projectId?: string) => {
    if (!requirement.trim()) return null;

    set({ isLoading: true, error: null, task: requirement });

    let effectiveProjectId = projectId || useProjectStore.getState().projectId;
    const projectPath = useProjectStore.getState().projectPath;

    if (!effectiveProjectId && projectPath) {
      try {
        const proj = await openProject(projectPath);
        effectiveProjectId = proj.id;
        useProjectStore.setState({ projectId: proj.id, project: proj });
      } catch {
        // Fallback
      }
    }

    if (!effectiveProjectId) {
      set({
        isLoading: false,
        error: 'No active project opened. Please open a project first.'
      });
      return null;
    }

    try {
      const report = await getImpactAnalysis(effectiveProjectId, requirement);
      const firstFile = report.directly_affected_files[0] || report.transitively_affected_files[0] || null;
      set({
        report,
        isLoading: false,
        isPlanApproved: false,
        selectedFile: firstFile
      });
      useProjectStore.setState({ impactReport: report });
      return report;
    } catch (err: unknown) {
      const errMsg = err instanceof ApiError ? `[${err.code}] ${err.message}` : (err as Error).message;
      set({ isLoading: false, error: errMsg });
      return null;
    }
  },

  setSelectedFile: (selectedFile) => set({ selectedFile }),
  approveImpactPlan: () => set({ isPlanApproved: true }),
  setTask: (task) => set({ task }),
  clearImpact: () => set({ report: null, task: '', selectedFile: null, isPlanApproved: false, error: null })
}));

