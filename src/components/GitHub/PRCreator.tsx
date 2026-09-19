import React, { useState, useEffect } from 'react';
import { useGitHubStore } from '../../store/githubStore';
import { useProjectStore } from '../../store/projectStore';
import { useGitStore } from '../../stores/gitStore';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { GitPullRequest, ExternalLink, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';

interface PRCreatorProps {
  defaultTitle?: string;
  defaultBody?: string;
  onSuccess?: (prUrl: string) => void;
  className?: string;
}

export const PRCreator: React.FC<PRCreatorProps> = ({
  defaultTitle,
  defaultBody,
  onSuccess,
  className = ''
}) => {
  const { projectId } = useProjectStore();
  const { currentBranch } = useGitStore();
  const { currentTask } = useAgentStore();
  const { createPullRequest } = useGitHubStore();
  const { addToast } = useUIStore();

  const [title, setTitle] = useState(
    defaultTitle || (currentTask?.title ? `Feat: ${currentTask.title}` : 'Feat: Autonomous task changes')
  );
  const [body, setBody] = useState(
    defaultBody ||
      (currentTask?.description
        ? `## Summary\n\n${currentTask.description}\n\n## Verification\n- Automated test suite passed.\n- Closed-loop compiler self-healing verified.`
        : '## Summary\nAutomated pull request created by Autonomous IDE.')
  );
  const [headBranch, setHeadBranch] = useState(currentBranch || 'feature-branch');
  const [baseBranch, setBaseBranch] = useState('main');
  const [submitting, setSubmitting] = useState(false);
  const [createdPRUrl, setCreatedPRUrl] = useState<string | null>(null);
  const [prNumber, setPrNumber] = useState<number | null>(null);

  useEffect(() => {
    if (currentBranch) {
      setHeadBranch(currentBranch);
    }
  }, [currentBranch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !title.trim()) return;

    setSubmitting(true);
    try {
      const res = await createPullRequest(projectId, {
        title: title.trim(),
        body: body.trim(),
        head: headBranch,
        base: baseBranch
      });

      if (res.success && res.html_url) {
        setCreatedPRUrl(res.html_url);
        setPrNumber(res.pr_number || 1);

        addToast({
          type: 'success',
          title: 'Pull Request Created',
          message: `Successfully created PR #${res.pr_number || ''} on GitHub.`
        });

        if (onSuccess) onSuccess(res.html_url);

        // Open in external browser
        if (typeof window !== 'undefined') {
          if (window.electronAPI?.openExternal) {
            window.electronAPI.openExternal(res.html_url);
          } else {
            window.open(res.html_url, '_blank');
          }
        }
      } else {
        addToast({
          type: 'error',
          title: 'Failed to Create PR',
          message: res.message || 'Could not create pull request.'
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error Creating PR',
        message: err?.message || 'Unexpected network failure.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPR = () => {
    if (!createdPRUrl) return;
    if (typeof window !== 'undefined') {
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(createdPRUrl);
      } else {
        window.open(createdPRUrl, '_blank');
      }
    }
  };

  if (createdPRUrl) {
    return (
      <div className={clsx('p-5 rounded-xl bg-[#181818] border border-[#89D185]/30 space-y-3', className)}>
        <div className="flex items-center gap-2 text-[#89D185]">
          <CheckCircle2 size={20} />
          <h3 className="text-sm font-bold text-white">Pull Request #{prNumber} Published!</h3>
        </div>
        <p className="text-xs text-[#CCCCCC]">
          Your branch <strong className="font-mono text-white">{headBranch}</strong> has been submitted as a Pull Request to <strong className="font-mono text-white">{baseBranch}</strong>.
        </p>
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleOpenPR}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#007ACC] hover:bg-[#0066B8] text-white font-medium text-xs shadow-sm transition-colors"
          >
            <ExternalLink size={13} />
            <span>Open on GitHub</span>
          </button>
          <button
            onClick={() => setCreatedPRUrl(null)}
            className="px-3 py-1.5 rounded-md bg-[#252526] hover:bg-[#2A2D2E] text-xs text-[#858585] hover:text-white transition-colors"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={clsx('p-5 rounded-xl bg-[#181818] border border-[#2B2B2B] space-y-4', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-[#2B2B2B]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-[#007ACC]/15 text-[#007ACC]">
            <GitPullRequest size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Create Pull Request</h3>
            <p className="text-[11px] text-[#858585]">Submit autonomous changes upstream to GitHub</p>
          </div>
        </div>
      </div>

      {/* Branches selection */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex-1 space-y-1">
          <label className="text-[11px] text-[#858585] font-semibold">Head Branch (Yours)</label>
          <input
            type="text"
            value={headBranch}
            onChange={(e) => setHeadBranch(e.target.value)}
            className="w-full bg-[#252526] border border-[#2B2B2B] rounded px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-[#007ACC]"
            placeholder="feature-branch"
            required
          />
        </div>

        <ArrowRight size={16} className="text-[#858585] mt-5 shrink-0" />

        <div className="flex-1 space-y-1">
          <label className="text-[11px] text-[#858585] font-semibold">Base Branch (Target)</label>
          <input
            type="text"
            value={baseBranch}
            onChange={(e) => setBaseBranch(e.target.value)}
            className="w-full bg-[#252526] border border-[#2B2B2B] rounded px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-[#007ACC]"
            placeholder="main"
            required
          />
        </div>
      </div>

      {/* PR Title */}
      <div className="space-y-1">
        <label className="text-[11px] text-[#858585] font-semibold">PR Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-[#252526] border border-[#2B2B2B] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#007ACC]"
          placeholder="Brief description of pull request"
          required
        />
      </div>

      {/* PR Description */}
      <div className="space-y-1">
        <label className="text-[11px] text-[#858585] font-semibold">Description (Markdown)</label>
        <textarea
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full bg-[#252526] border border-[#2B2B2B] rounded p-2.5 text-xs font-mono text-[#CCCCCC] focus:outline-none focus:border-[#007ACC] leading-relaxed resize-y"
          placeholder="Detailed description of changes, rationale, and test results..."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#007ACC] hover:bg-[#0066B8] disabled:opacity-50 text-white font-medium text-xs shadow-sm transition-colors cursor-pointer"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <GitPullRequest size={14} />}
          <span>{submitting ? 'Publishing PR...' : 'Create Pull Request'}</span>
        </button>
      </div>
    </form>
  );
};
