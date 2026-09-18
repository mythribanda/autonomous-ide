import { create } from 'zustand';
import { GitChange, GitCheckpoint } from '../types';
import { MOCK_GIT_CHANGES, MOCK_GIT_CHECKPOINTS } from '../services/mockData';
import { AutonomousAPI } from '../services/api';

interface GitState {
  currentBranch: string;
  changes: GitChange[];
  checkpoints: GitCheckpoint[];
  commitMessage: string;
  selectedDiffFile: GitChange | null;
  isDiffModalOpen: boolean;
  
  // Actions
  setCommitMessage: (msg: string) => void;
  toggleStageChange: (file: string) => void;
  stageAll: () => void;
  unstageAll: () => void;
  commitChanges: () => void;
  createCheckpoint: (message: string) => Promise<void>;
  rollbackToCheckpoint: (hash: string) => void;
  openDiffModal: (change: GitChange) => void;
  closeDiffModal: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  currentBranch: 'ai/dark-mode',
  changes: MOCK_GIT_CHANGES,
  checkpoints: MOCK_GIT_CHECKPOINTS,
  commitMessage: 'feat(theme): implement dark mode support and theme toggle component',
  selectedDiffFile: MOCK_GIT_CHANGES[0],
  isDiffModalOpen: false,

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

  commitChanges: () => {
    const { commitMessage, checkpoints } = get();
    if (!commitMessage.trim()) return;
    const newCp: GitCheckpoint = {
      id: `cp-${Date.now()}`,
      commitHash: Math.random().toString(16).substring(2, 9),
      message: commitMessage,
      timestamp: 'Just now',
      author: 'Prof. Mythri',
      type: 'user_manual',
      filesChanged: get().changes.filter((c) => c.staged).length || get().changes.length
    };
    set({
      changes: [],
      checkpoints: [newCp, ...checkpoints],
      commitMessage: ''
    });
  },

  createCheckpoint: async (message) => {
    const cp = await AutonomousAPI.createGitCheckpoint(message);
    set((state) => ({
      checkpoints: [cp, ...state.checkpoints]
    }));
  },

  rollbackToCheckpoint: (hash) => {
    // Reset changes simulation
    set((state) => ({
      changes: state.changes.map((c) => ({ ...c, staged: false })),
      commitMessage: `Reverted back to checkpoint: ${hash}`
    }));
  },

  openDiffModal: (change) => set({ selectedDiffFile: change, isDiffModalOpen: true }),
  closeDiffModal: () => set({ isDiffModalOpen: false })
}));
