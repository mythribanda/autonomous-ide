import React, { useState, useEffect, useMemo } from 'react';
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Tag,
  Calendar,
  Bug,
  Lightbulb,
  Layers,
  ListTodo,
  FileText,
  RefreshCw,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../stores/uiStore';
import {
  getProjectMemories,
  createProjectMemory,
  deleteProjectMemory,
  ApiError
} from '../../lib/api';
import { ProjectMemoryItem, GroupedMemoriesResponse } from '../../types/api';

type TabType = 'all' | 'architecture' | 'decision' | 'bug' | 'requirement';

export const ProjectMemoryPanel: React.FC = () => {
  const { projectId, currentProject } = useProjectStore();
  const { setActiveView } = useUIStore();

  const [memories, setMemories] = useState<GroupedMemoriesResponse>({
    architecture: [],
    decision: [],
    bug: [],
    requirement: []
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newType, setNewType] = useState<'decision' | 'bug' | 'requirement' | 'architecture'>('decision');
  const [newContent, setNewContent] = useState<string>('');
  const [newTags, setNewTags] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchMemories = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectMemories(projectId);
      setMemories(data);
    } catch (err: any) {
      console.error('Failed to load project memories', err);
      setError(err?.message || 'Failed to load project memories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [projectId]);

  const handleDelete = async (memoryId: string) => {
    if (!projectId) return;
    if (!window.confirm('Are you sure you want to remove this memory item?')) return;

    try {
      await deleteProjectMemory(projectId, memoryId);
      // Remove from state directly
      setMemories((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = next[key].filter((m) => m.id !== memoryId);
        }
        return next;
      });
    } catch (err: any) {
      console.error('Failed to delete memory', err);
      alert(err?.message || 'Failed to delete memory');
    }
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newContent.trim()) return;

    setIsSaving(true);
    setModalError(null);
    try {
      const tagsList = newTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0);

      const created = await createProjectMemory(projectId, {
        type: newType,
        content: newContent.trim(),
        tags: tagsList
      });

      // Update local state
      setMemories((prev) => {
        const mType = created.memory_type || newType;
        const currentList = prev[mType] || [];
        return {
          ...prev,
          [mType]: [created, ...currentList]
        };
      });

      setIsAddModalOpen(false);
      setNewContent('');
      setNewTags('');
    } catch (err: any) {
      console.error('Failed to save memory', err);
      setModalError(err?.message || 'Failed to create memory');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Aggregated list of memories
  const allMemoriesList: ProjectMemoryItem[] = useMemo(() => {
    const list: ProjectMemoryItem[] = [];
    Object.values(memories).forEach((group) => {
      if (Array.isArray(group)) {
        list.push(...group);
      }
    });
    // Sort descending by created_at
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [memories]);

  // Filtered by tab and search
  const filteredMemories = useMemo(() => {
    let items: ProjectMemoryItem[] = [];
    if (activeTab === 'all') {
      items = allMemoriesList;
    } else {
      items = memories[activeTab] || [];
    }

    if (!searchQuery.trim()) return items;

    const q = searchQuery.toLowerCase().trim();
    return items.filter((m) => {
      const summaryMatch = (m.summary || '').toLowerCase().includes(q);
      const tagMatch = (m.tags || []).some((t) => t.toLowerCase().includes(q));
      const typeMatch = (m.memory_type || '').toLowerCase().includes(q);
      const detailMatch = JSON.stringify(m.details || {}).toLowerCase().includes(q);
      return summaryMatch || tagMatch || typeMatch || detailMatch;
    });
  }, [memories, activeTab, allMemoriesList, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: allMemoriesList.length,
      architecture: memories.architecture?.length || 0,
      decision: memories.decision?.length || 0,
      bug: memories.bug?.length || 0,
      requirement: memories.requirement?.length || 0
    };
  }, [memories, allMemoriesList]);

  const getTypeBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'decision':
        return {
          icon: <Lightbulb size={13} className="text-emerald-400" />,
          label: 'Decision',
          classes: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
        };
      case 'bug':
        return {
          icon: <Bug size={13} className="text-rose-400" />,
          label: 'Bug Fix',
          classes: 'bg-rose-950/60 text-rose-300 border-rose-700/60'
        };
      case 'requirement':
        return {
          icon: <ListTodo size={13} className="text-purple-400" />,
          label: 'Requirement',
          classes: 'bg-purple-950/60 text-purple-300 border-purple-700/60'
        };
      case 'architecture':
      default:
        return {
          icon: <Layers size={13} className="text-sky-400" />,
          label: 'Architecture',
          classes: 'bg-sky-950/60 text-sky-300 border-sky-700/60'
        };
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] text-[#CCCCCC] overflow-hidden">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-[#2B2B2B] bg-[#1E1E1E] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-sm">
            <Brain size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-zinc-100">Project Memory</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-800/60 font-mono">
                {counts.all} memories stored
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Cross-session intelligence: architectural decisions, resolved bugs, and requirements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchMemories}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border border-zinc-700 flex items-center gap-1.5 transition-colors"
            title="Refresh Memories"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 rounded bg-[#007ACC] hover:bg-[#0062a3] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Plus size={14} />
            <span>Add Memory</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 border-b border-[#2B2B2B] bg-[#1A1A1A] flex flex-wrap items-center justify-between gap-3 select-none">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-[#141414] p-1 rounded-md border border-[#2B2B2B]">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 text-xs rounded font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1 text-xs rounded font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'architecture'
                ? 'bg-sky-900/60 text-sky-200 border border-sky-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers size={13} />
            Architecture ({counts.architecture})
          </button>
          <button
            onClick={() => setActiveTab('decision')}
            className={`px-3 py-1 text-xs rounded font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'decision'
                ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Lightbulb size={13} />
            Decisions ({counts.decision})
          </button>
          <button
            onClick={() => setActiveTab('bug')}
            className={`px-3 py-1 text-xs rounded font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'bug'
                ? 'bg-rose-900/60 text-rose-200 border border-rose-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bug size={13} />
            Bugs Fixed ({counts.bug})
          </button>
          <button
            onClick={() => setActiveTab('requirement')}
            className={`px-3 py-1 text-xs rounded font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'requirement'
                ? 'bg-purple-900/60 text-purple-200 border border-purple-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ListTodo size={13} />
            Requirements ({counts.requirement})
          </button>
        </div>

        {/* Search Box */}
        <div className="relative min-w-[220px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories or #tags..."
            className="w-full bg-[#141414] border border-[#2B2B2B] rounded pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-500 space-y-3">
            <Loader2 size={24} className="animate-spin text-purple-400" />
            <span className="text-xs">Loading project memories...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300 flex items-center gap-3">
            <AlertCircle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-500">
              <Brain size={24} />
            </div>
            <h3 className="text-sm font-semibold text-zinc-300">
              {searchQuery ? 'No matching memories found' : 'No memories stored yet'}
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {searchQuery
                ? `No memories matched "${searchQuery}". Try a different keyword or tag.`
                : 'As the AI agent plans tasks, resolves runtime bugs, and completes features, it will automatically record permanent project context here. You can also manually add key architecture decisions.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-2 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs border border-zinc-700 flex items-center gap-1.5 transition-colors"
              >
                <Plus size={13} />
                <span>Add First Decision</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredMemories.map((mem) => {
              const badge = getTypeBadge(mem.memory_type);
              const isExpanded = !!expandedDetails[mem.id];
              const hasExtraDetails =
                mem.details &&
                (mem.details.affected_files?.length ||
                  mem.details.acceptance_criteria?.length ||
                  mem.details.context ||
                  mem.details.bug ||
                  mem.details.fix);

              return (
                <div
                  key={mem.id}
                  className="p-4 bg-[#1E1E1E] border border-[#2B2B2B] hover:border-zinc-700 rounded-md transition-all shadow-sm space-y-3"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 font-medium ${badge.classes}`}
                      >
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>

                      <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-500">
                        <Calendar size={11} />
                        {formatDate(mem.created_at)}
                      </span>

                      {mem.task_id && (
                        <button
                          onClick={() => setActiveView('tasks')}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 flex items-center gap-1 transition-colors"
                          title={`Linked Task: ${mem.task_id}`}
                        >
                          <FileText size={10} />
                          <span>Task {mem.task_id.slice(0, 8)}</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleDelete(mem.id)}
                      className="text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-zinc-800 transition-colors"
                      title="Delete Memory"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Summary Text */}
                  <p className="text-xs text-zinc-200 leading-relaxed font-sans">
                    {mem.summary}
                  </p>

                  {/* Tags */}
                  {mem.tags && mem.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {mem.tags.map((t, idx) => (
                        <span
                          key={idx}
                          onClick={() => setSearchQuery(t)}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#141414] hover:bg-zinc-800 text-zinc-400 hover:text-purple-300 border border-[#2B2B2B] cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <Tag size={9} />
                          <span>{t}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Collapsible Details Section */}
                  {hasExtraDetails && (
                    <div className="pt-2 border-t border-[#282828]">
                      <button
                        onClick={() => toggleExpand(mem.id)}
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono transition-colors"
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span>{isExpanded ? 'Hide Details' : 'View Details & Context'}</span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2.5 p-3 bg-[#141414] rounded border border-[#252525] space-y-2 text-xs">
                          {mem.details?.context && (
                            <div>
                              <span className="text-[10px] font-mono uppercase text-zinc-500">Rationale / Context:</span>
                              <p className="text-zinc-300 text-xs mt-0.5">{mem.details.context}</p>
                            </div>
                          )}

                          {mem.details?.bug && (
                            <div>
                              <span className="text-[10px] font-mono uppercase text-rose-400">Diagnosed Issue:</span>
                              <p className="text-zinc-300 text-xs mt-0.5">{mem.details.bug}</p>
                            </div>
                          )}

                          {mem.details?.fix && (
                            <div>
                              <span className="text-[10px] font-mono uppercase text-emerald-400">Applied Resolution:</span>
                              <p className="text-zinc-300 text-xs mt-0.5">{mem.details.fix}</p>
                            </div>
                          )}

                          {mem.details?.affected_files && mem.details.affected_files.length > 0 && (
                            <div>
                              <span className="text-[10px] font-mono uppercase text-zinc-500">Affected Files:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {mem.details.affected_files.map((file, fIdx) => (
                                  <span
                                    key={fIdx}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1E1E1E] text-sky-300 border border-zinc-800"
                                  >
                                    {file}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {mem.details?.acceptance_criteria && mem.details.acceptance_criteria.length > 0 && (
                            <div>
                              <span className="text-[10px] font-mono uppercase text-zinc-500">Acceptance Criteria:</span>
                              <ul className="list-disc list-inside text-zinc-300 text-[11px] mt-1 space-y-0.5">
                                {mem.details.acceptance_criteria.map((crit, cIdx) => (
                                  <li key={cIdx}>{crit}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Memory Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1E1E1E] border border-[#2B2B2B] rounded-lg shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#2B2B2B] pb-3">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-purple-400" />
                <h2 className="text-sm font-semibold text-zinc-100">Add Memory Item</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-800/80 rounded text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateMemory} className="space-y-4 text-xs">
              {/* Type Selector */}
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Memory Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType('decision')}
                    className={`p-2 rounded border text-left flex items-center gap-2 transition-all ${
                      newType === 'decision'
                        ? 'bg-emerald-950/70 border-emerald-500/80 text-emerald-200'
                        : 'bg-[#181818] border-[#2B2B2B] text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <Lightbulb size={14} className="text-emerald-400" />
                    <div>
                      <div className="font-semibold text-[11px]">Decision</div>
                      <div className="text-[9px] opacity-75">Design or tech choice</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewType('bug')}
                    className={`p-2 rounded border text-left flex items-center gap-2 transition-all ${
                      newType === 'bug'
                        ? 'bg-rose-950/70 border-rose-500/80 text-rose-200'
                        : 'bg-[#181818] border-[#2B2B2B] text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <Bug size={14} className="text-rose-400" />
                    <div>
                      <div className="font-semibold text-[11px]">Bug Fix</div>
                      <div className="text-[9px] opacity-75">Issue & resolution</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewType('architecture')}
                    className={`p-2 rounded border text-left flex items-center gap-2 transition-all ${
                      newType === 'architecture'
                        ? 'bg-sky-950/70 border-sky-500/80 text-sky-200'
                        : 'bg-[#181818] border-[#2B2B2B] text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <Layers size={14} className="text-sky-400" />
                    <div>
                      <div className="font-semibold text-[11px]">Architecture</div>
                      <div className="text-[9px] opacity-75">Structure & rules</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewType('requirement')}
                    className={`p-2 rounded border text-left flex items-center gap-2 transition-all ${
                      newType === 'requirement'
                        ? 'bg-purple-950/70 border-purple-500/80 text-purple-200'
                        : 'bg-[#181818] border-[#2B2B2B] text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <ListTodo size={14} className="text-purple-400" />
                    <div>
                      <div className="font-semibold text-[11px]">Requirement</div>
                      <div className="text-[9px] opacity-75">Business specification</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Content / Summary Input */}
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Memory Content / Decision</label>
                <textarea
                  required
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="e.g., We chose to use Zustand over Redux because of simpler store composition and zero boilerplate."
                  className="w-full bg-[#141414] border border-[#2B2B2B] rounded p-2 text-zinc-100 focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              {/* Tags Input */}
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="e.g., zustand, state, architecture"
                  className="w-full bg-[#141414] border border-[#2B2B2B] rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2B2B2B]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !newContent.trim()}
                  className="px-4 py-1.5 rounded bg-[#007ACC] hover:bg-[#0062a3] text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSaving && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Memory</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
