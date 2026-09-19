import { create } from 'zustand';
import {
  GitHubRepo,
  GitHubIssue,
  GitHubCIStatus,
  GitHubPushResult,
  GitHubPullResult,
  GitHubPRRequest,
  GitHubPRResult
} from '../types/api';
import {
  getGitHubStatus,
  getGitHubAuthStart,
  disconnectGitHub as apiDisconnectGitHub,
  getGitHubRepos,
  cloneGitHubRepo,
  pushGitHubBranch,
  pullGitHubRemote,
  createGitHubPR,
  getGitHubIssues,
  getGitHubCIStatus
} from '../lib/api';

export interface CloneProgressInfo {
  stage: string;
  cur_count?: number;
  max_count?: number;
  percent: number;
  message: string;
}

interface GitHubState {
  connected: boolean;
  username: string | null;
  avatar_url: string | null;
  repos: GitHubRepo[];
  issues: GitHubIssue[];
  ciStatus: GitHubCIStatus | null;
  isLoadingStatus: boolean;
  isLoadingRepos: boolean;
  isLoadingIssues: boolean;
  isLoadingCI: boolean;
  isCloning: boolean;
  cloneProgress: CloneProgressInfo | null;
  cloneError: string | null;
  activeTab: 'repos' | 'issues' | 'pr' | 'ci';

  // Actions
  setActiveTab: (tab: 'repos' | 'issues' | 'pr' | 'ci') => void;
  checkStatus: () => Promise<void>;
  startAuthFlow: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  fetchRepos: (page?: number) => Promise<void>;
  cloneRepository: (cloneUrl: string, targetPath: string) => Promise<boolean>;
  fetchIssues: (projectId: string) => Promise<void>;
  fetchCIStatus: (projectId: string, commitSha?: string) => Promise<void>;
  pushBranch: (projectId: string, branch: string) => Promise<GitHubPushResult>;
  pullRemote: (projectId: string) => Promise<GitHubPullResult>;
  createPullRequest: (projectId: string, data: GitHubPRRequest) => Promise<GitHubPRResult>;
}

export const useGitHubStore = create<GitHubState>((set, get) => ({
  connected: false,
  username: null,
  avatar_url: null,
  repos: [],
  issues: [],
  ciStatus: null,
  isLoadingStatus: false,
  isLoadingRepos: false,
  isLoadingIssues: false,
  isLoadingCI: false,
  isCloning: false,
  cloneProgress: null,
  cloneError: null,
  activeTab: 'repos',

  setActiveTab: (tab) => set({ activeTab: tab }),

  checkStatus: async () => {
    set({ isLoadingStatus: true });
    try {
      const res = await getGitHubStatus();
      set({
        connected: res.connected,
        username: res.username || null,
        avatar_url: res.avatar_url || null
      });
      if (res.connected) {
        get().fetchRepos(1);
      }
    } catch {
      set({ connected: false, username: null, avatar_url: null });
    } finally {
      set({ isLoadingStatus: false });
    }
  },

  startAuthFlow: async () => {
    try {
      const { auth_url } = await getGitHubAuthStart();
      if (!auth_url) return null;

      // Try opening via electronAPI or standard window.open
      if (typeof window !== 'undefined') {
        if (window.electronAPI?.openExternal) {
          await window.electronAPI.openExternal(auth_url);
        } else {
          window.open(auth_url, '_blank', 'width=600,height=700');
        }

        // Set up listener for callback message
        const handleAuthMsg = (e: MessageEvent) => {
          if (e.data?.type === 'GITHUB_AUTH_SUCCESS') {
            get().checkStatus();
            window.removeEventListener('message', handleAuthMsg);
          }
        };
        window.addEventListener('message', handleAuthMsg);
      }
      return auth_url;
    } catch (err) {
      console.warn('Failed to start GitHub auth flow:', err);
      return null;
    }
  },

  disconnect: async () => {
    try {
      await apiDisconnectGitHub();
    } finally {
      set({
        connected: false,
        username: null,
        avatar_url: null,
        repos: [],
        issues: [],
        ciStatus: null
      });
    }
  },

  fetchRepos: async (page = 1) => {
    set({ isLoadingRepos: true });
    try {
      const repos = await getGitHubRepos(page);
      set({ repos });
    } catch (err) {
      console.warn('Failed to fetch repos:', err);
    } finally {
      set({ isLoadingRepos: false });
    }
  },

  cloneRepository: async (cloneUrl: string, targetPath: string) => {
    const sessionId = `clone_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set({
      isCloning: true,
      cloneError: null,
      cloneProgress: { stage: 'Initializing clone...', percent: 0, message: 'Connecting to remote...' }
    });

    // Establish WebSocket for live progress
    let ws: WebSocket | null = null;
    try {
      const wsUrl = `ws://localhost:8000/ws/github/clone/${sessionId}`;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'clone_progress') {
            set({
              cloneProgress: {
                stage: data.stage || 'Cloning',
                cur_count: data.cur_count,
                max_count: data.max_count,
                percent: data.percent ?? 0,
                message: data.message || `${data.stage} (${data.percent}%)`
              }
            });
          } else if (data.type === 'clone_complete') {
            set({
              cloneProgress: { stage: 'Completed', percent: 100, message: 'Clone completed!' }
            });
          }
        } catch {
          // ignore parsing error
        }
      };
    } catch (err) {
      console.warn('Could not connect to clone WebSocket:', err);
    }

    try {
      const result = await cloneGitHubRepo({
        clone_url: cloneUrl,
        target_path: targetPath,
        session_id: sessionId
      });

      if (result.success) {
        set({
          isCloning: false,
          cloneProgress: { stage: 'Done', percent: 100, message: result.message }
        });
        return true;
      } else {
        set({
          isCloning: false,
          cloneError: result.message || 'Clone failed'
        });
        return false;
      }
    } catch (err: any) {
      set({
        isCloning: false,
        cloneError: err?.message || 'Error occurred during clone'
      });
      return false;
    } finally {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
  },

  fetchIssues: async (projectId: string) => {
    if (!projectId) return;
    set({ isLoadingIssues: true });
    try {
      const issues = await getGitHubIssues(projectId);
      set({ issues });
    } catch (err) {
      console.warn('Failed to fetch issues:', err);
    } finally {
      set({ isLoadingIssues: false });
    }
  },

  fetchCIStatus: async (projectId: string, commitSha?: string) => {
    if (!projectId) return;
    set({ isLoadingCI: true });
    try {
      const ciStatus = await getGitHubCIStatus(projectId, commitSha);
      set({ ciStatus });
    } catch (err) {
      console.warn('Failed to fetch CI status:', err);
    } finally {
      set({ isLoadingCI: false });
    }
  },

  pushBranch: async (projectId: string, branch: string) => {
    return await pushGitHubBranch(projectId, branch);
  },

  pullRemote: async (projectId: string) => {
    return await pullGitHubRemote(projectId);
  },

  createPullRequest: async (projectId: string, data: GitHubPRRequest) => {
    return await createGitHubPR(projectId, data);
  }
}));
