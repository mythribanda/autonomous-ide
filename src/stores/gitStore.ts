import { create } from 'zustand';
import { GitChange, GitCheckpoint } from '../types';
import {
  getGitStatus,
  createGitCheckpoint as apiCreateGitCheckpoint,
  rollbackGitCheckpoint as apiRollbackGitCheckpoint,
  listGitCheckpoints,
  getGitDiff,
  openProject,
  ApiError
} from '../lib/api';
import { GitStatusResponse, GitCheckpointResponse } from '../types/api';
import { useProjectStore } from '../store/projectStore';

interface GitState {
  currentBranch: string;
  changes: GitChange[];
  checkpoints: GitCheckpoint[];
  commitMessage: string;
  selectedDiffFile: GitChange | null;
  isDiffModalOpen: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setCommitMessage: (msg: string) => void;
  toggleStageChange: (file: string) => void;
  stageAll: () => void;
  unstageAll: () => void;
  commitChanges: () => Promise<void>;
  createCheckpoint: (message: string) => Promise<void>;
  rollbackToCheckpoint: (hash: string) => Promise<void>;
  openDiffModal: (change: GitChange) => Promise<void>;
  closeDiffModal: () => void;
  fetchGitStatus: () => Promise<void>;
}

function getProjectContext() {
  const projectStore = useProjectStore.getState();
  const projectPath = projectStore.projectPath || '.';
  const projectId = projectStore.projectId || projectStore.project?.id || '';
  return { projectPath, projectId };
}

function toGitCheckpoint(cp: GitCheckpointResponse): GitCheckpoint {
  return {
    id: cp.id,
    commitHash: cp.commit_hash || '',
    message: cp.message || '',
    timestamp: cp.created_at
      ? new Date(cp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : 'Just now',
    author: cp.author || 'AutonomousDev Agent',
    type: (cp.type as any) || 'ai_post_change',
    filesChanged: cp.files_changed || 0
  };
}

function mapStatusToChanges(statusRes: GitStatusResponse, existingChanges: GitChange[] = []): GitChange[] {
  const stagedSet = new Set(statusRes.staged_files || []);
  const modifiedSet = new Set(statusRes.modified_files || []);
  const untrackedSet = new Set(statusRes.untracked_files || []);
  const existingMap = new Map(existingChanges.map((c) => [c.file, c]));

  const allFiles = Array.from(
    new Set([...statusRes.modified_files, ...statusRes.untracked_files, ...statusRes.staged_files])
  );

  return allFiles.map((file) => {
    const existing = existingMap.get(file);
    const staged = stagedSet.has(file) || Boolean(existing?.staged);
    let status: 'M' | 'A' | 'D' | 'U' = 'M';
    if (untrackedSet.has(file)) status = 'U';
    else if (stagedSet.has(file) && !modifiedSet.has(file)) status = 'A';
    else status = 'M';

    return {
      file,
      status,
      staged,
      additions: existing?.additions || 0,
      deletions: existing?.deletions || 0,
      diff: existing?.diff || ''
    };
  });
}

export const useGitStore = create<GitState>((set, get) => ({
  currentBranch: 'main',
  changes: [],
  checkpoints: [],
  commitMessage: '',
  selectedDiffFile: null,
  isDiffModalOpen: false,
  isLoading: false,
  error: null,

  setCommitMessage: (commitMessage) => set({ commitMessage }),

  toggleStageChange: (file) => {
    set((state) => ({
      changes: state.changes.map((c) =>
        c.file === file ? { ...c, staged: !c.staged } : c
      )
    }));
  },

  stageAll: () => {
    set((state) => ({
      changes: state.changes.map((c) => ({ ...c, staged: true }))
    }));
  },

  unstageAll: () => {
    set((state) => ({
      changes: state.changes.map((c) => ({ ...c, staged: false }))
    }));
  },

  commitChanges: async () => {
    const { commitMessage } = get();
    if (!commitMessage.trim()) return;

    const { projectPath, projectId } = getProjectContext();
    set({ isLoading: true, error: null });

    let effectiveProjectId = projectId;
    if (!effectiveProjectId && projectPath) {
      try {
        const proj = await openProject(projectPath);
        effectiveProjectId = proj.id;
        useProjectStore.setState({ projectId: proj.id, project: proj });
      } catch {
        // Fallback
      }
    }

    try {
      const cpRes = await apiCreateGitCheckpoint({
        project_id: effectiveProjectId || 'default-project',
        project_path: projectPath,
        message: commitMessage,
        type: 'user_manual',
        author: 'User'
      });

      const newCp = toGitCheckpoint(cpRes);
      set((state) => ({
        checkpoints: [newCp, ...state.checkpoints],
        commitMessage: '',
        isLoading: false
      }));

      // Refresh working tree changes after commit
      get().fetchGitStatus();
    } catch (err: unknown) {
      const errMsg = err instanceof ApiError ? `[${err.code}] ${err.message}` : (err as Error).message;
      set({ isLoading: false, error: errMsg });
    }
  },

  createCheckpoint: async (message: string) => {
    const { projectPath, projectId } = getProjectContext();
    set({ isLoading: true, error: null });

    let effectiveProjectId = projectId;
    if (!effectiveProjectId && projectPath) {
      try {
        const proj = await openProject(projectPath);
        effectiveProjectId = proj.id;
        useProjectStore.setState({ projectId: proj.id, project: proj });
      } catch {
        // Fallback
      }
    }

    try {
      const cpRes = await apiCreateGitCheckpoint({
        project_id: effectiveProjectId || 'default-project',
        project_path: projectPath,
        message: message || 'Manual Checkpoint',
        type: 'ai_post_change',
        author: 'AutonomousDev Agent'
      });

      const newCp = toGitCheckpoint(cpRes);
      set((state) => ({
        checkpoints: [newCp, ...state.checkpoints],
        isLoading: false
      }));

      // Refresh working tree status
      get().fetchGitStatus();
    } catch (err: unknown) {
      const errMsg = err instanceof ApiError ? `[${err.code}] ${err.message}` : (err as Error).message;
      set({ isLoading: false, error: errMsg });
      throw err;
    }
  },

  rollbackToCheckpoint: async (hash: string) => {
    const { projectPath } = getProjectContext();
    set({ isLoading: true, error: null });

    try {
      await apiRollbackGitCheckpoint({
        project_path: projectPath,
        commit_hash: hash
      });

      set({
        commitMessage: `Reverted back to checkpoint: ${hash}`,
        isLoading: false
      });

      // Refresh status after rollback
      get().fetchGitStatus();
    } catch (err: unknown) {
      const errMsg = err instanceof ApiError ? `[${err.code}] ${err.message}` : (err as Error).message;
      set({ isLoading: false, error: errMsg });
    }
  },

  openDiffModal: async (change) => {
    set({ selectedDiffFile: change, isDiffModalOpen: true });
    const { projectPath } = getProjectContext();
    if (!projectPath) return;

    try {
      const diffRes = await getGitDiff(projectPath, change.file);
      if (diffRes && diffRes.diff) {
        const rawDiff = diffRes.diff;
        const additions = (rawDiff.match(/^\+[^+]/gm) || []).length;
        const deletions = (rawDiff.match(/^-[^-]/gm) || []).length;

        const updatedChange: GitChange = {
          ...change,
          diff: rawDiff,
          additions,
          deletions
        };

        set((state) => ({
          selectedDiffFile: updatedChange,
          changes: state.changes.map((c) => (c.file === change.file ? updatedChange : c))
        }));
      }
    } catch (err) {
      console.warn('Could not load git diff for file:', change.file, err);
    }
  },

  closeDiffModal: () => set({ isDiffModalOpen: false }),

  fetchGitStatus: async () => {
    const { projectPath, projectId } = getProjectContext();
    if (!projectPath) return;

    set({ isLoading: true, error: null });
    try {
      const statusRes = await getGitStatus(projectPath);
      const changes = mapStatusToChanges(statusRes, get().changes);

      let checkpoints = get().checkpoints;
      try {
        const cpRes = await listGitCheckpoints(projectId || undefined);
        if (cpRes && cpRes.length > 0) {
          checkpoints = cpRes.map(toGitCheckpoint);
        }
      } catch {
        // Silently preserve current checkpoints
      }

      set({
        currentBranch: statusRes.branch === 'none' ? 'main' : statusRes.branch,
        changes,
        checkpoints,
        isLoading: false
      });
    } catch (err: unknown) {
      const errMsg = err instanceof ApiError ? `[${err.code}] ${err.message}` : (err as Error).message;
      set({ isLoading: false, error: errMsg });
    }
  }
}));

// Automatically trigger initial git status sync
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useGitStore.getState().fetchGitStatus();
  }, 100);
}

