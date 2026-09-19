import React, { useState } from 'react';
import { useGitHubStore } from '../../store/githubStore';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { GitHubRepo } from '../../types/api';
import {
  FolderGit2,
  Lock,
  Globe,
  Star,
  GitFork,
  Download,
  Search,
  RefreshCw,
  Folder,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { clsx } from 'clsx';

export const RepoBrowser: React.FC = () => {
  const {
    repos,
    fetchRepos,
    isLoadingRepos,
    isCloning,
    cloneProgress,
    cloneError,
    cloneRepository
  } = useGitHubStore();
  const { openProject } = useProjectStore();
  const { addToast } = useUIStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [targetPath, setTargetPath] = useState('');
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneSuccess, setCloneSuccess] = useState(false);

  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (repo.language && repo.language.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenCloneModal = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    const defaultFolder = `C:/Users/yogit/OneDrive/Desktop/mojor project/${repo.name}`;
    setTargetPath(defaultFolder);
    setCloneSuccess(false);
    setIsCloneModalOpen(true);
  };

  const handlePickDirectory = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.openFolder) {
      try {
        const folder = await window.electronAPI.openFolder();
        if (folder) {
          setTargetPath(`${folder}/${selectedRepo?.name || 'repo'}`);
        }
      } catch (err) {
        console.warn('Folder picker failed:', err);
      }
    }
  };

  const handleStartClone = async () => {
    if (!selectedRepo || !targetPath.trim()) return;

    const success = await cloneRepository(selectedRepo.clone_url, targetPath.trim());
    if (success) {
      setCloneSuccess(true);
      addToast({
        type: 'success',
        title: 'Repository Cloned',
        message: `Successfully cloned ${selectedRepo.full_name} to ${targetPath}`
      });
    } else {
      addToast({
        type: 'error',
        title: 'Clone Failed',
        message: cloneError || 'Could not clone repository.'
      });
    }
  };

  const handleOpenWorkspace = async () => {
    if (!targetPath) return;
    try {
      await openProject(targetPath);
      setIsCloneModalOpen(false);
      addToast({
        type: 'info',
        title: 'Workspace Loaded',
        message: `Opened project from ${targetPath}`
      });
    } catch (err) {
      console.warn('Failed to open cloned project:', err);
    }
  };

  const handleOpenExternal = (url: string) => {
    if (typeof window !== 'undefined') {
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Search and Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-2.5 top-2.5 text-[#858585]" />
          <input
            type="text"
            placeholder="Search repositories by name or language..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#181818] border border-[#2B2B2B] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#CCCCCC] placeholder-[#6E6E6E] focus:outline-none focus:border-[#007ACC]"
          />
        </div>

        <button
          onClick={() => fetchRepos(1)}
          disabled={isLoadingRepos}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-xs text-[#CCCCCC] transition-colors"
        >
          <RefreshCw size={13} className={clsx(isLoadingRepos && 'animate-spin')} />
          <span>Refresh Repos</span>
        </button>
      </div>

      {/* Grid of Repos */}
      {isLoadingRepos ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#858585] text-xs space-y-2">
          <RefreshCw size={18} className="animate-spin text-[#007ACC]" />
          <span>Fetching your GitHub repositories...</span>
        </div>
      ) : filteredRepos.length === 0 ? (
        <div className="p-8 rounded-xl bg-[#181818] border border-[#2B2B2B] text-center space-y-2">
          <FolderGit2 size={32} className="mx-auto text-[#858585]" />
          <h4 className="text-sm font-semibold text-white">No Repositories Found</h4>
          <p className="text-xs text-[#858585] max-w-sm mx-auto">
            {searchTerm
              ? 'No repositories match your search filter.'
              : 'No repositories found for this account. Ensure repo scope permissions are granted.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredRepos.map((repo) => (
            <div
              key={repo.id}
              className="p-4 rounded-xl bg-[#181818] border border-[#2B2B2B] hover:border-[#007ACC]/40 transition-colors flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FolderGit2 size={16} className="text-[#007ACC] shrink-0" />
                    <h3
                      onClick={() => handleOpenExternal(repo.html_url)}
                      className="text-xs font-bold text-white hover:text-[#007ACC] transition-colors cursor-pointer truncate max-w-[220px]"
                      title={repo.full_name}
                    >
                      {repo.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={clsx(
                        'px-1.5 py-0.2 rounded text-[10px] font-mono flex items-center gap-1 border',
                        repo.private
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      )}
                    >
                      {repo.private ? <Lock size={9} /> : <Globe size={9} />}
                      <span>{repo.private ? 'Private' : 'Public'}</span>
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#858585] line-clamp-2 leading-relaxed min-h-[2rem]">
                  {repo.description || 'No description provided.'}
                </p>
              </div>

              {/* Footer Meta & Clone Button */}
              <div className="pt-2 border-t border-[#252526] flex items-center justify-between text-[11px] text-[#6E6E6E] font-mono">
                <div className="flex items-center gap-3">
                  {repo.language && (
                    <span className="flex items-center gap-1 text-[#CCCCCC]">
                      <span className="w-2 h-2 rounded-full bg-[#007ACC]" />
                      <span>{repo.language}</span>
                    </span>
                  )}
                  {repo.stars > 0 && (
                    <span className="flex items-center gap-1">
                      <Star size={11} /> {repo.stars}
                    </span>
                  )}
                  {repo.forks > 0 && (
                    <span className="flex items-center gap-1">
                      <GitFork size={11} /> {repo.forks}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleOpenCloneModal(repo)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#252526] hover:bg-[#007ACC] text-[#CCCCCC] hover:text-white transition-colors cursor-pointer"
                >
                  <Download size={12} />
                  <span>Clone</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clone Modal Dialog */}
      {isCloneModalOpen && selectedRepo && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-[#1E1E1E] border border-[#2B2B2B] rounded-xl shadow-2xl p-5 space-y-4 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2B2B]">
              <div className="flex items-center gap-2">
                <Download size={18} className="text-[#007ACC]" />
                <h3 className="text-sm font-bold text-white">
                  Clone {selectedRepo.name}
                </h3>
              </div>
              <button
                onClick={() => !isCloning && setIsCloneModalOpen(false)}
                disabled={isCloning}
                className="text-[#858585] hover:text-white text-xs disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-[#858585] font-semibold">Repository Clone URL</label>
                <input
                  type="text"
                  readOnly
                  value={selectedRepo.clone_url}
                  className="w-full bg-[#181818] border border-[#2B2B2B] rounded px-2.5 py-1.5 font-mono text-[#858585]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-[#858585] font-semibold">Local Destination Path</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={targetPath}
                    onChange={(e) => setTargetPath(e.target.value)}
                    disabled={isCloning || cloneSuccess}
                    className="flex-1 bg-[#252526] border border-[#2B2B2B] rounded px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-[#007ACC]"
                    placeholder="/path/to/destination"
                  />
                  <button
                    type="button"
                    onClick={handlePickDirectory}
                    disabled={isCloning || cloneSuccess}
                    className="p-1.5 rounded bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC]"
                    title="Browse Folder"
                  >
                    <Folder size={14} />
                  </button>
                </div>
              </div>

              {/* Progress and status */}
              {isCloning && cloneProgress && (
                <div className="p-3 rounded-lg bg-[#181818] border border-[#2B2B2B] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#858585] flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin text-[#007ACC]" />
                      <span>{cloneProgress.stage}</span>
                    </span>
                    <span className="text-white font-bold">{cloneProgress.percent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#252526] overflow-hidden">
                    <div
                      className="h-full bg-[#007ACC] transition-all duration-300 rounded-full"
                      style={{ width: `${Math.max(cloneProgress.percent, 5)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#6E6E6E] font-mono truncate">{cloneProgress.message}</p>
                </div>
              )}

              {cloneError && (
                <div className="p-3 rounded-lg bg-[#F14C4C]/10 border border-[#F14C4C]/25 text-[#F14C4C] text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{cloneError}</span>
                </div>
              )}

              {cloneSuccess && (
                <div className="p-3 rounded-lg bg-[#89D185]/10 border border-[#89D185]/25 text-[#89D185] text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>Repository cloned successfully! Ready to open as project workspace.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2B2B2B]">
              <button
                onClick={() => setIsCloneModalOpen(false)}
                disabled={isCloning}
                className="px-3 py-1.5 rounded-md bg-[#252526] hover:bg-[#2A2D2E] text-xs text-[#858585] hover:text-white transition-colors"
              >
                Close
              </button>

              {cloneSuccess ? (
                <button
                  onClick={handleOpenWorkspace}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#89D185] text-black font-semibold text-xs shadow-sm transition-colors"
                >
                  <span>Open in Workspace</span>
                </button>
              ) : (
                <button
                  onClick={handleStartClone}
                  disabled={isCloning || !targetPath.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#007ACC] hover:bg-[#0066B8] disabled:opacity-50 text-white font-medium text-xs shadow-sm transition-colors cursor-pointer"
                >
                  {isCloning ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  <span>{isCloning ? 'Cloning...' : 'Start Clone'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
