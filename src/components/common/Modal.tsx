import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = '2xl'
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-6xl w-full'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-none animate-in fade-in duration-100">
      <div
        className={`w-full ${maxWidthClasses[maxWidth]} bg-[#1E1E1E] border border-[#2B2B2B] rounded-sm shadow-2xl flex flex-col max-h-[85vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-[#2B2B2B] flex items-center justify-between bg-[#181818]">
          <div>
            <h2 className="text-sm font-semibold text-[#FFFFFF]">{title}</h2>
            {subtitle && <p className="text-xs text-[#858585] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm text-[#858585] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 text-[#CCCCCC]">{children}</div>
      </div>
    </div>
  );
};
