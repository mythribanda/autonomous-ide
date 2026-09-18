import React from 'react';
import { clsx } from 'clsx';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  trend?: string;
  accentColor?: 'cyan' | 'emerald' | 'amber' | 'indigo' | 'rose' | 'default';
  className?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  accentColor = 'default',
  className,
  onClick
}) => {
  const iconBg = {
    cyan: 'bg-[#007ACC]/10 text-[#007ACC] border-[#007ACC]/25',
    emerald: 'bg-[#89D185]/10 text-[#89D185] border-[#89D185]/25',
    amber: 'bg-[#CCA700]/10 text-[#CCA700] border-[#CCA700]/25',
    indigo: 'bg-[#3794FF]/10 text-[#3794FF] border-[#3794FF]/25',
    rose: 'bg-[#F14C4C]/10 text-[#F14C4C] border-[#F14C4C]/25',
    default: 'bg-[#252526] text-[#858585] border-[#2B2B2B]'
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'p-3.5 rounded-sm border border-[#2B2B2B] bg-[#181818] hover:bg-[#252526] transition-all group',
        onClick && 'cursor-pointer hover:border-[#3C3C3C]',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] text-[#858585] font-mono uppercase tracking-wider">{label}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-bold text-[#FFFFFF] font-mono tracking-tight">{value}</h3>
            {trend && <span className="text-[11px] text-[#89D185] font-mono">{trend}</span>}
          </div>
          {subtext && <p className="text-[10px] text-[#858585] font-mono">{subtext}</p>}
        </div>
        {Icon && (
          <div className={clsx('p-2 rounded-sm border flex items-center justify-center', iconBg[accentColor])}>
            <Icon size={16} />
          </div>
        )}
      </div>
    </div>
  );
};
