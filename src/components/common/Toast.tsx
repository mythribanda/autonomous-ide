import React from 'react';
import { useUIStore } from '../../stores/uiStore';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info, X } from 'lucide-react';
import { clsx } from 'clsx';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-8 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 size={16} className="text-[#89D185]" />,
          warning: <AlertTriangle size={16} className="text-[#CCA700]" />,
          error: <AlertOctagon size={16} className="text-[#F14C4C]" />,
          info: <Info size={16} className="text-[#3794FF]" />
        };

        const borderStyles = {
          success: 'border-[#2B2B2B] bg-[#181818]',
          warning: 'border-[#2B2B2B] bg-[#181818]',
          error: 'border-[#2B2B2B] bg-[#181818]',
          info: 'border-[#2B2B2B] bg-[#181818]'
        };

        return (
          <div
            key={toast.id}
            className={clsx(
              'pointer-events-auto p-3 rounded-sm border shadow-lg flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-150',
              borderStyles[toast.type]
            )}
          >
            <div className="mt-0.5">{icons[toast.type]}</div>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-semibold text-[#FFFFFF]">{toast.title}</h5>
              <p className="text-[11px] text-[#CCCCCC] mt-0.5 break-words">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#858585] hover:text-[#FFFFFF] p-0.5"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
