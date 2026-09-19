import React from 'react';
import { Plus, X, Terminal } from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore';

export const TerminalTabs: React.FC = () => {
  const { sessions, activeSessionId, addSession, closeSession, setActiveSession } =
    useTerminalStore();

  return (
    <div className="flex items-center h-7 bg-[#0D0D0D] border-b border-[#1E1E1E] overflow-x-auto no-scrollbar">
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        return (
          <div
            key={session.id}
            onClick={() => setActiveSession(session.id)}
            className={`
              group flex items-center gap-1.5 h-full px-3 border-r border-[#1E1E1E]
              cursor-pointer select-none shrink-0 transition-colors text-[11px]
              font-['JetBrains_Mono',_Consolas,_monospace]
              ${isActive
                ? 'bg-[#181818] text-[#CCCCCC] border-t border-t-[#007ACC]'
                : 'text-[#5A5A5A] hover:text-[#9D9D9D] hover:bg-[#141414]'
              }
            `}
          >
            <Terminal className="w-3 h-3 shrink-0 text-[#007ACC]" />
            <span className="max-w-[80px] truncate">{session.name}</span>

            {/* Close button — always visible when active, hover when not */}
            {sessions.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(session.id);
                }}
                className={`
                  ml-0.5 rounded-sm p-0.5 transition-colors shrink-0
                  ${isActive
                    ? 'text-[#858585] hover:text-[#CCCCCC] hover:bg-[#2D2D2D]'
                    : 'text-transparent group-hover:text-[#858585] hover:text-[#CCCCCC] hover:bg-[#2D2D2D]'
                  }
                `}
                title="Close terminal"
                tabIndex={-1}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}

      {/* New terminal button */}
      <button
        onClick={addSession}
        className="h-full px-2 text-[#5A5A5A] hover:text-[#CCCCCC] hover:bg-[#141414] transition-colors shrink-0"
        title="New terminal"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
