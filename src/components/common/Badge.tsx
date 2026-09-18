import React from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'outline' | 'ghost' | 'blue' | 'success' | 'warning' | 'error';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'xs',
  className,
  dot
}) => {
  const variantStyles = {
    default: 'bg-[#252526] text-[#CCCCCC] border-[#2B2B2B]',
    cyan: 'bg-[#007ACC]/15 text-[#3794FF] border-[#007ACC]/40',
    blue: 'bg-[#007ACC]/15 text-[#3794FF] border-[#007ACC]/40',
    emerald: 'bg-[#89D185]/15 text-[#89D185] border-[#89D185]/40',
    success: 'bg-[#89D185]/15 text-[#89D185] border-[#89D185]/40',
    amber: 'bg-[#CCA700]/15 text-[#CCA700] border-[#CCA700]/40',
    warning: 'bg-[#CCA700]/15 text-[#CCA700] border-[#CCA700]/40',
    rose: 'bg-[#F14C4C]/15 text-[#F14C4C] border-[#F14C4C]/40',
    error: 'bg-[#F14C4C]/15 text-[#F14C4C] border-[#F14C4C]/40',
    indigo: 'bg-[#007ACC]/20 text-[#FFFFFF] border-[#007ACC]/50',
    outline: 'bg-transparent text-[#858585] border-[#2B2B2B]',
    ghost: 'bg-[#252526]/50 text-[#858585] border-transparent'
  };

  const sizeStyles = {
    xs: 'text-[11px] px-1.5 py-0.2 gap-1',
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-2'
  };

  const dotColors = {
    default: 'bg-[#858585]',
    cyan: 'bg-[#007ACC]',
    blue: 'bg-[#007ACC]',
    emerald: 'bg-[#89D185]',
    success: 'bg-[#89D185]',
    amber: 'bg-[#CCA700]',
    warning: 'bg-[#CCA700]',
    rose: 'bg-[#F14C4C]',
    error: 'bg-[#F14C4C]',
    indigo: 'bg-[#3794FF]',
    outline: 'bg-[#858585]',
    ghost: 'bg-[#858585]'
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-sm font-mono font-medium border select-none transition-colors',
        variantStyles[variant] || variantStyles.default,
        sizeStyles[size],
        className
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant] || 'bg-[#007ACC]')} />}
      {children}
    </span>
  );
};
