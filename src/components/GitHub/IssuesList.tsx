import React, { useEffect, useState } from 'react';
import { useGitHubStore } from '../../store/githubStore';
import { useProjectStore } from '../../store/projectStore';
import { usePromptStore } from '../../store/promptStore';
import { useUIStore } from '../../stores/uiStore';
import { GitHubIssue } from '../../types/api';
import {
  AlertCircle,
  MessageSquare,
  ExternalLink,
  Play,
  Search,
  RefreshCw,
  Sparkles,
  Tag
} from 'lucide-react';
import { clsx } from 'clsx';

export const IssuesList: React.FC = () => {
  const { projectId } = useProjectStore();
  const { issues, fetchIssues, isLoadingIssues } = useGitHubStore();
  const { setRequirement, setIsPanelOpen } = usePromptStore();
  const { addToast } = useUIStore();
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (projectId) {
      fetchIssues(projectId);
    }
  }, [projectId, fetchIssues]);

  const handleWorkOnIssue = (issue: GitHubIssue) => {
    const formattedPrompt = `Work on GitHub Issue #${issue.number}: ${issue.title}\n\nDescription:\n${issue.body || 'No description provided.'}`;
    setRequirement(formattedPrompt);
    setIsPanelOpen(true);

    addToast({
      type: 'info',
      title: `Issue #${issue.number} Loaded`,
      message: 'Prefilled requirement prompt bar. Press Enter or click compile to start.'
    });
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

  const filteredIssues = issues.filter(
    (issue) =>
      issue.title.toLowerCase().includes(filterText.toLowerCase()) ||
      (issue.body && issue.body.toLowerCase().includes(filterText.toLowerCase())) ||
      issue.labels.some((l) => l.toLowerCase().includes(filterText.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-2.5 top-2.5 text-[#858585]" />
          <input
            type="text"
            placeholder="Search open issues or labels..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full bg-[#181818] border border-[#2B2B2B] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#CCCCCC] placeholder-[#6E6E6E] focus:outline-none focus:border-[#007ACC]"
          />
        </div>

        <button
          onClick={() => projectId && fetchIssues(projectId)}
          disabled={isLoadingIssues}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-xs text-[#CCCCCC] transition-colors"
        >
          <RefreshCw size={13} className={clsx(isLoadingIssues && 'animate-spin')} />
          <span>Refresh Issues</span>
        </button>
      </div>

      {/* Issues List */}
      {isLoadingIssues ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#858585] text-xs space-y-2">
          <RefreshCw size={18} className="animate-spin text-[#007ACC]" />
          <span>Loading GitHub issues...</span>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="p-8 rounded-xl bg-[#181818] border border-[#2B2B2B] text-center space-y-2">
          <AlertCircle size={28} className="mx-auto text-[#858585]" />
          <h4 className="text-sm font-semibold text-white">No Open Issues Found</h4>
          <p className="text-xs text-[#858585] max-w-sm mx-auto">
            {filterText
              ? 'No issues match your search query.'
              : 'There are no open issues for this repository, or the project is not linked to GitHub.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredIssues.map((issue) => (
            <div
              key={issue.id}
              className="p-3.5 rounded-xl bg-[#181818] border border-[#2B2B2B] hover:border-[#007ACC]/50 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-3 group"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-[#89D185]">
                    #{issue.number}
                  </span>
                  <h4 className="text-xs font-semibold text-white hover:text-[#007ACC] transition-colors cursor-pointer truncate max-w-md">
                    {issue.title}
                  </h4>
                  {issue.labels.map((lbl) => (
                    <span
                      key={lbl}
                      className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#007ACC]/15 text-[#9CDCFE] border border-[#007ACC]/25 flex items-center gap-1"
                    >
                      <Tag size={9} />
                      <span>{lbl}</span>
                    </span>
                  ))}
                </div>

                {issue.body && (
                  <p className="text-xs text-[#858585] line-clamp-2 leading-relaxed">
                    {issue.body}
                  </p>
                )}

                <div className="flex items-center gap-4 text-[11px] text-[#6E6E6E] font-mono">
                  {issue.user_login && <span>Opened by @{issue.user_login}</span>}
                  {issue.comments_count > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare size={11} />
                      {issue.comments_count} comments
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                <button
                  onClick={() => handleOpenExternal(issue.html_url)}
                  className="p-1.5 rounded-md hover:bg-[#252526] text-[#858585] hover:text-white transition-colors"
                  title="View on GitHub"
                >
                  <ExternalLink size={14} />
                </button>

                <button
                  onClick={() => handleWorkOnIssue(issue)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#007ACC] hover:bg-[#0066B8] text-white font-medium text-xs shadow-sm transition-colors cursor-pointer"
                >
                  <Sparkles size={13} />
                  <span>Work on Issue</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
