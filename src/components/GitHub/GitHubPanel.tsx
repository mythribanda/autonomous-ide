import React, { useEffect, useState } from 'react';
import { useGitHubStore } from '../../store/githubStore';
import { useProjectStore } from '../../store/projectStore';
import { useGitStore } from '../../stores/gitStore';
import { useUIStore } from '../../stores/uiStore';
import { RepoBrowser } from './RepoBrowser';
import { IssuesList } from './IssuesList';
import { PRCreator } from './PRCreator';
import { CIStatus } from './CIStatus';
import { GithubIcon } from './GithubIcon';
import {
  FolderGit2,
  AlertCircle,
  GitPullRequest,
  ShieldCheck,
  LogOut,
  ExternalLink,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { clsx } from 'clsx';

export const GitHubPanel: React.FC = () => {
  const { projectId } = useProjectStore();
  const { currentBranch } = useGitStore();
  const { addToast } = useUIStore();
  const {
    connected,
    username,
    avatar_url,
    checkStatus,
    startAuthFlow,
    disconnect,
    activeTab,
    setActiveTab,
    pushBranch,
    pullRemote
  } = useGitHubStore();

  const [connecting, setConnecting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await startAuthFlow();
    } finally {
      setConnecting(false);
    }
  };

  const handlePush = async () => {
    if (!projectId || !currentBranch) return;
    setPushing(true);
    try {
      const res = await pushBranch(projectId, currentBranch);
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Pushed to GitHub',
          message: `Branch '${currentBranch}' successfully pushed to remote.`
        });
      } else {
        addToast({
          type: 'error',
          title: 'Push Failed',
          message: res.message || 'Push rejected by remote.'
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Push Error',
        message: err?.message || 'Network error occurred.'
      });
    } finally {
      setPushing(false);
    }
  };

  const handlePull = async () => {
    if (!projectId) return;
    setPulling(true);
    try {
      const res = await pullRemote(projectId);
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Pulled from Remote',
          message: res.message || 'Working directory up-to-date.'
        });
      } else {
        addToast({
          type: 'error',
          title: 'Pull Failed',
          message: res.message || 'Merge conflict or pull error.'
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Pull Error',
        message: err?.message || 'Network error occurred.'
      });
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1E1E1E] text-[#CCCCCC] font-sans select-text">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Top Header Card */}
        <div className="p-5 rounded-xl bg-[#181818] border border-[#2B2B2B] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#252526] border border-[#2B2B2B] flex items-center justify-center text-white">
              <GithubIcon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">GitHub Integration</h2>
                {connected && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#89D185]/15 text-[#89D185] border border-[#89D185]/30">
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-[#858585]">
                Manage repositories, sync code, open pull requests, and resolve GitHub issues.
              </p>
            </div>
          </div>

          {/* Connect / Disconnect Buttons */}
          <div className="flex items-center gap-2 self-start md:self-center">
            {connected ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#252526] border border-[#2B2B2B]">
                  <img
                    src={avatar_url || 'https://github.com/identicons/default.png'}
                    alt={username || 'GitHub'}
                    className="w-5 h-5 rounded-full border border-[#007ACC]"
                  />
                  <span className="text-xs font-mono font-semibold text-white">@{username}</span>
                </div>

                <button
                  onClick={disconnect}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#252526] hover:bg-[#F14C4C]/15 hover:text-[#F14C4C] border border-[#2B2B2B] text-xs text-[#858585] transition-colors cursor-pointer"
                  title="Disconnect GitHub"
                >
                  <LogOut size={13} />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#007ACC] hover:bg-[#0066B8] disabled:opacity-50 text-white font-medium text-xs shadow-md transition-colors cursor-pointer"
              >
                {connecting ? <Loader2 size={14} className="animate-spin" /> : <GithubIcon size={14} />}
                <span>Connect GitHub Account</span>
              </button>
            )}
          </div>
        </div>

        {/* Not connected state banner */}
        {!connected && (
          <div className="p-8 rounded-xl bg-[#181818] border border-[#2B2B2B] text-center space-y-3">
            <GithubIcon size={40} className="mx-auto text-[#858585]" />
            <h3 className="text-sm font-bold text-white">Connect GitHub to unlock full automation</h3>
            <p className="text-xs text-[#858585] max-w-md mx-auto leading-relaxed">
              Connect your account to clone repositories, sync commits, view open issues with one-click autonomous fixing, and create Pull Requests directly from tasks.
            </p>
            <div className="pt-2">
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#007ACC] hover:bg-[#0066B8] text-white font-medium text-xs shadow-md transition-colors"
              >
                <GithubIcon size={14} />
                <span>Connect with GitHub</span>
              </button>
            </div>
          </div>
        )}

        {/* Connected state */}
        {connected && (
          <div className="space-y-4">
            {/* Action Bar (Pull / Push buttons for active project) */}
            {projectId && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[#141414] border border-[#2B2B2B]">
                <div className="flex items-center gap-2 text-xs font-mono text-[#858585]">
                  <span>Active Branch:</span>
                  <span className="text-white font-bold">{currentBranch}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePull}
                    disabled={pulling}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-xs text-[#CCCCCC] transition-colors"
                  >
                    {pulling ? <Loader2 size={13} className="animate-spin" /> : <DownloadCloud size={13} />}
                    <span>Pull from Remote</span>
                  </button>

                  <button
                    onClick={handlePush}
                    disabled={pushing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#007ACC] hover:bg-[#0066B8] text-white text-xs font-medium transition-colors"
                  >
                    {pushing ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                    <span>Push to Origin</span>
                  </button>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-[#2B2B2B] pb-px">
              <button
                onClick={() => setActiveTab('repos')}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-md transition-colors border-b-2 -mb-px cursor-pointer',
                  activeTab === 'repos'
                    ? 'border-[#007ACC] text-white bg-[#252526]'
                    : 'border-transparent text-[#858585] hover:text-[#CCCCCC]'
                )}
              >
                <FolderGit2 size={14} />
                <span>Repositories</span>
              </button>

              <button
                onClick={() => setActiveTab('issues')}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-md transition-colors border-b-2 -mb-px cursor-pointer',
                  activeTab === 'issues'
                    ? 'border-[#007ACC] text-white bg-[#252526]'
                    : 'border-transparent text-[#858585] hover:text-[#CCCCCC]'
                )}
              >
                <AlertCircle size={14} />
                <span>Issues & Bugs</span>
              </button>

              <button
                onClick={() => setActiveTab('pr')}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-md transition-colors border-b-2 -mb-px cursor-pointer',
                  activeTab === 'pr'
                    ? 'border-[#007ACC] text-white bg-[#252526]'
                    : 'border-transparent text-[#858585] hover:text-[#CCCCCC]'
                )}
              >
                <GitPullRequest size={14} />
                <span>Pull Requests</span>
              </button>

              <button
                onClick={() => setActiveTab('ci')}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-md transition-colors border-b-2 -mb-px cursor-pointer',
                  activeTab === 'ci'
                    ? 'border-[#007ACC] text-white bg-[#252526]'
                    : 'border-transparent text-[#858585] hover:text-[#CCCCCC]'
                )}
              >
                <ShieldCheck size={14} />
                <span>CI Status</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="pt-2">
              {activeTab === 'repos' && <RepoBrowser />}
              {activeTab === 'issues' && <IssuesList />}
              {activeTab === 'pr' && <PRCreator />}
              {activeTab === 'ci' && <CIStatus compact={false} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
