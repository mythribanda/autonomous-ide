import React from 'react';
import { TaskStatus } from '../../types/api';
import {
  Clock,
  Brain,
  Zap,
  FlaskConical,
  Wrench,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Archive,
  Ban
} from 'lucide-react';
import { clsx } from 'clsx';

interface TaskStatusBadgeProps {
  status: TaskStatus | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({
  status,
  className,
  size = 'md',
  showLabel = true
}) => {
  const normStatus = (status || '').toLowerCase().trim();

  let icon = <Clock size={12} />;
  let label = 'Queued';
  let colorStyles = 'text-zinc-400 bg-zinc-800/60 border-zinc-700/50';

  switch (normStatus) {
    case 'queued':
      icon = <Clock size={12} className="text-zinc-400" />;
      label = 'Queued';
      colorStyles = 'text-zinc-300 bg-zinc-800/70 border-zinc-700';
      break;

    case 'planning':
      icon = <Brain size={12} className="text-blue-400 animate-pulse" />;
      label = 'Planning';
      colorStyles = 'text-blue-300 bg-blue-950/40 border-blue-800/60';
      break;

    case 'executing':
    case 'running':
      icon = <Zap size={12} className="text-amber-400 fill-amber-400/20 animate-bounce" />;
      label = 'Executing';
      colorStyles = 'text-amber-300 bg-amber-950/40 border-amber-800/60';
      break;

    case 'testing':
      icon = <FlaskConical size={12} className="text-purple-400 animate-spin" />;
      label = 'Testing';
      colorStyles = 'text-purple-300 bg-purple-950/40 border-purple-800/60';
      break;

    case 'recovering':
      icon = <Wrench size={12} className="text-yellow-400 animate-spin" />;
      label = 'Recovering';
      colorStyles = 'text-yellow-300 bg-yellow-950/40 border-yellow-800/60';
      break;

    case 'completed':
      icon = <CheckCircle2 size={12} className="text-emerald-400" />;
      label = 'Completed';
      colorStyles = 'text-emerald-300 bg-emerald-950/40 border-emerald-800/60';
      break;

    case 'failed':
      icon = <XCircle size={12} className="text-rose-400" />;
      label = 'Failed';
      colorStyles = 'text-rose-300 bg-rose-950/40 border-rose-800/60';
      break;

    case 'waiting_approval':
      icon = <PauseCircle size={12} className="text-yellow-400 animate-pulse" />;
      label = 'Waiting Approval';
      colorStyles = 'text-yellow-300 bg-yellow-950/50 border-yellow-600/70';
      break;

    case 'superseded':
      icon = <Archive size={12} className="text-slate-400" />;
      label = 'Superseded';
      colorStyles = 'text-slate-400 bg-slate-900/50 border-slate-700/50';
      break;

    case 'cancelled':
    case 'stopped':
      icon = <Ban size={12} className="text-zinc-400" />;
      label = 'Cancelled';
      colorStyles = 'text-zinc-400 bg-zinc-900/60 border-zinc-800';
      break;

    default:
      icon = <Clock size={12} className="text-zinc-400" />;
      label = status || 'Unknown';
      colorStyles = 'text-zinc-400 bg-zinc-800/50 border-zinc-700/40';
      break;
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-[11px] px-2 py-0.5 gap-1.5',
    lg: 'text-xs px-2.5 py-1 gap-2'
  }[size];

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full border shadow-sm select-none',
        sizeClasses,
        colorStyles,
        className
      )}
    >
      {icon}
      {showLabel && <span className="capitalize">{label}</span>}
    </span>
  );
};
