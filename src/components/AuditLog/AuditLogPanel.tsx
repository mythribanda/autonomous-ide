import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Download,
  RefreshCw,
  Filter,
  FileEdit,
  Trash2,
  Terminal,
  GitCommit,
  GitBranch,
  AlertTriangle,
  User,
  Clock
} from 'lucide-react';
import { clsx } from 'clsx';
import { useProjectStore } from '../../store/projectStore';
import { getAuditLog } from '../../lib/api';

interface AuditEntry {
  id: string;
  project_id: string;
  task_id: string | null;
  action_type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  timestamp: string;
  user_initiated: boolean;
}

interface AuditResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  entries: AuditEntry[];
}

const ACTION_META: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  file_write: { label: 'File Write', color: 'text-blue-400 bg-blue-900/30 border-blue-800', icon: FileEdit },
  file_delete: { label: 'File Delete', color: 'text-rose-400 bg-rose-900/30 border-rose-800', icon: Trash2 },
  command_run: { label: 'Command', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800', icon: Terminal },
  git_commit: { label: 'Git Commit', color: 'text-emerald-400 bg-emerald-900/30 border-emerald-800', icon: GitCommit },
  git_push: { label: 'Git Push', color: 'text-emerald-400 bg-emerald-900/30 border-emerald-800', icon: GitBranch },
  github_pr_create: { label: 'GitHub PR', color: 'text-purple-400 bg-purple-900/30 border-purple-800', icon: GitBranch },
  permission_override: { label: 'Permission', color: 'text-orange-400 bg-orange-900/30 border-orange-800', icon: AlertTriangle },
};

const ACTION_TYPES = ['all', 'file_write', 'file_delete', 'command_run', 'git_commit', 'git_push', 'github_pr_create', 'permission_override'];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}

function exportCSV(entries: AuditEntry[]) {
  const header = 'Timestamp,Action,Description,Task ID,User Initiated';
  const rows = entries.map(e =>
    [
      `"${e.timestamp}"`,
      `"${e.action_type}"`,
      `"${e.description.replace(/"/g, "'")}",`,
      `"${e.task_id ?? ''}"`,
      e.user_initiated ? 'Yes' : 'No'
    ].join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const AuditLogPanel: React.FC = () => {
  const { projectId } = useProjectStore();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('all');

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getAuditLog(
        projectId,
        page,
        50,
        filterType === 'all' ? undefined : filterType
      );
      setData(result as AuditResponse);
    } catch (e: any) {
      setError(e?.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, filterType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(fetchData, 30_000);
    return () => clearInterval(t);
  }, [fetchData]);

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-xs font-mono">
        No project open
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#181818] text-xs font-mono">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2B2B2B] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span className="font-bold text-zinc-100 uppercase tracking-wide">Audit Log</span>
          {data && (
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {data.total} entries
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center gap-1 text-zinc-400">
            <Filter size={12} />
            <select
              value={filterType}
              onChange={e => { setFilterType(e.target.value); setPage(1); }}
              className="bg-[#141414] border border-[#333] rounded px-2 py-1 text-zinc-200 focus:outline-none focus:border-[#007ACC] text-[11px]"
            >
              {ACTION_TYPES.map(t => (
                <option key={t} value={t}>{t === 'all' ? 'All Actions' : ACTION_META[t]?.label || t}</option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded hover:bg-[#252526] text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Export CSV */}
          <button
            onClick={() => data && exportCSV(data.entries)}
            disabled={!data || data.entries.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#252526] hover:bg-[#2e2e30] text-zinc-300 border border-[#3c3c3c] text-[11px] transition-colors disabled:opacity-40"
          >
            <Download size={12} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="m-4 p-3 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {!error && data?.entries.length === 0 && (
          <div className="flex items-center justify-center h-32 text-zinc-500">
            No audit entries yet. Agent actions will appear here.
          </div>
        )}

        {data && data.entries.length > 0 && (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[#1E1E1E] border-b border-[#2B2B2B] text-[10px] text-zinc-400 uppercase">
              <tr>
                <th className="py-2 px-4">Timestamp</th>
                <th className="py-2 px-4">Action</th>
                <th className="py-2 px-4">Description</th>
                <th className="py-2 px-4">Task</th>
                <th className="py-2 px-4 text-center">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2B2B2B]">
              {data.entries.map(entry => {
                const meta = ACTION_META[entry.action_type];
                const Icon = meta?.icon ?? ShieldCheck;
                return (
                  <tr key={entry.id} className="hover:bg-[#252526]/40 transition-colors">
                    <td className="py-2.5 px-4 text-zinc-400 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock size={10} className="text-zinc-600 shrink-0" />
                        {formatTimestamp(entry.timestamp)}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={clsx(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold',
                        meta?.color || 'text-zinc-400 bg-zinc-800 border-zinc-700'
                      )}>
                        <Icon size={10} />
                        {meta?.label || entry.action_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-200 max-w-xs truncate">
                      {entry.description}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-500">
                      {entry.task_id ? (
                        <span className="font-mono text-[10px] text-zinc-400">
                          {entry.task_id.substring(0, 8)}&hellip;
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {entry.user_initiated ? (
                        <span title="User action" className="text-amber-400 inline-flex justify-center">
                          <User size={12} />
                        </span>
                      ) : (
                        <span title="Agent action" className="text-blue-400 font-mono text-[10px]">AI</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="px-4 py-2 border-t border-[#2B2B2B] flex items-center justify-between text-zinc-400 shrink-0">
          <span className="text-[10px]">
            Page {data.page} of {data.pages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-2 py-1 rounded bg-[#252526] hover:bg-[#2e2e30] disabled:opacity-40 text-[11px]"
            >← Prev</button>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage(p => p + 1)}
              className="px-2 py-1 rounded bg-[#252526] hover:bg-[#2e2e30] disabled:opacity-40 text-[11px]"
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  );
};
