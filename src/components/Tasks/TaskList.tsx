import React, { useState, useEffect } from 'react';
import { useTaskStore } from '../../store/taskStore';
import { useProjectStore } from '../../store/projectStore';
import { TaskStatusBadge } from './TaskStatusBadge';
import {
  ChevronDown,
  ChevronRight,
  ListTodo,
  Trash2,
  Clock,
  Filter,
  Plus,
  RefreshCw
} from 'lucide-react';
import { clsx } from 'clsx';

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 15) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface TaskListProps {
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  onSelectTask?: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  isCollapsible = true,
  defaultExpanded = true,
  className,
  onSelectTask
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  const { project } = useProjectStore();
  const {
    tasks,
    selectedTaskId,
    selectTask,
    deleteTask,
    fetchTasks,
    isLoading
  } = useTaskStore();

  useEffect(() => {
    if (project?.id) {
      fetchTasks(project.id);
    }
  }, [project?.id, fetchTasks]);

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') {
      return ['queued', 'planning', 'executing', 'running', 'testing', 'recovering', 'waiting_approval'].includes(t.status);
    }
    if (statusFilter === 'completed') return t.status === 'completed';
    if (statusFilter === 'failed') return t.status === 'failed';
    return true;
  });

  const handleDelete = async (e: React.MouseEvent, taskId: string, taskStatus: string) => {
    e.stopPropagation();
    const executing = ['executing', 'running', 'planning', 'testing', 'recovering', 'waiting_approval'].includes(taskStatus.toLowerCase());
    if (executing) {
      alert('Cannot delete executing tasks. Please stop the agent first.');
      return;
    }
    if (window.confirm('Delete this task and its history?')) {
      await deleteTask(taskId);
    }
  };

  const handleTaskClick = (taskId: string) => {
    selectTask(taskId);
    if (onSelectTask) {
      onSelectTask(taskId);
    }
  };

  return (
    <div className={clsx('flex flex-col bg-[#181818] border-b border-[#2B2B2B] select-none', className)}>
      {/* Header Bar */}
      <div
        onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
        className={clsx(
          'flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#969696] hover:text-[#CCCCCC] transition-colors',
          isCollapsible ? 'cursor-pointer hover:bg-[#202020]' : ''
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isCollapsible && (
            isExpanded ? <ChevronDown size={14} className="text-[#858585]" /> : <ChevronRight size={14} className="text-[#858585]" />
          )}
          <ListTodo size={14} className="text-[#007ACC] shrink-0" />
          <span className="truncate">Tasks</span>
          <span className="text-[10px] bg-[#2A2A2A] text-[#858585] px-1.5 py-0.2 rounded-full font-mono font-normal">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => project?.id && fetchTasks(project.id)}
            title="Refresh tasks"
            className="p-1 rounded hover:bg-[#2A2A2A] text-[#858585] hover:text-[#FFFFFF] transition-colors"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="flex flex-col pb-1">
          {/* Quick Filter Pill Buttons */}
          {tasks.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#252526] bg-[#141414] overflow-x-auto">
              {(['all', 'active', 'completed', 'failed'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={clsx(
                    'px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-colors',
                    statusFilter === filter
                      ? 'bg-[#007ACC]/20 text-[#389FD6] border border-[#007ACC]/40 font-semibold'
                      : 'text-[#858585] hover:text-[#CCCCCC] hover:bg-[#202020]'
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}

          {/* Empty State */}
          {tasks.length === 0 ? (
            <div className="px-4 py-8 text-center flex flex-col items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-[#242424] flex items-center justify-center text-[#6E6E6E] mb-2">
                <ListTodo size={18} />
              </div>
              <p className="text-xs text-[#858585] font-medium">0 tasks yet</p>
              <p className="text-[11px] text-[#5A5A5A] mt-0.5">type a requirement above</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-[#777777]">
              No {statusFilter} tasks found
            </div>
          ) : (
            /* Task Rows */
            <div className="flex flex-col max-h-[360px] overflow-y-auto divide-y divide-[#232323]">
              {filteredTasks.map((task) => {
                const isSelected = selectedTaskId === task.id;
                const isExecuting = ['executing', 'running', 'planning', 'testing', 'recovering', 'waiting_approval'].includes(task.status.toLowerCase());

                return (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task.id)}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    className={clsx(
                      'group flex flex-col px-3 py-2 cursor-pointer transition-colors relative border-l-2',
                      isSelected
                        ? 'bg-[#2A2D2E] border-[#007ACC] text-[#FFFFFF]'
                        : 'border-transparent hover:bg-[#1F1F1F] text-[#CCCCCC]'
                    )}
                  >
                    {/* Top row: Status Badge + Elapsed Time + Action Buttons */}
                    <div className="flex items-center justify-between gap-1 text-[10px]">
                      <TaskStatusBadge status={task.status} size="sm" />

                      <div className="flex items-center gap-1.5 text-[#6E6E6E]">
                        <span className="font-mono text-[10px]" title={task.created_at}>
                          {formatRelativeTime(task.created_at)}
                        </span>

                        {/* Delete action button */}
                        {!isExecuting && (
                          <button
                            onClick={(e) => handleDelete(e, task.id, task.status)}
                            title="Delete task"
                            className={clsx(
                              'p-0.5 rounded hover:text-rose-400 hover:bg-rose-950/40 transition-opacity',
                              hoveredTaskId === task.id || isSelected ? 'opacity-100' : 'opacity-0'
                            )}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Requirement preview */}
                    <p
                      className={clsx(
                        'text-xs mt-1.5 line-clamp-2 leading-relaxed font-sans break-words',
                        isSelected ? 'text-[#FFFFFF] font-medium' : 'text-[#BBBBBB]'
                      )}
                      title={task.requirement}
                    >
                      {task.requirement}
                    </p>

                    {/* Execution Stats Footer (if present) */}
                    {(task.files_changed > 0 || task.tests_passed > 0 || task.execution_time_seconds) && (
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] text-[#7E7E7E] font-mono">
                        {task.execution_time_seconds != null && (
                          <span>{task.execution_time_seconds.toFixed(1)}s</span>
                        )}
                        {task.files_changed > 0 && (
                          <span>{task.files_changed} files</span>
                        )}
                        {task.tests_passed > 0 && (
                          <span className="text-emerald-400">{task.tests_passed} passed</span>
                        )}
                        {task.tests_failed > 0 && (
                          <span className="text-rose-400">{task.tests_failed} failed</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
