import React, { useState, useRef, useEffect } from 'react';
import { useTerminalStore } from '../../stores/terminalStore';
import { Trash2 } from 'lucide-react';

export const InteractiveShell: React.FC = () => {
  const { lines, executeCommand, clearTerminal } = useTerminalStore();
  const [inputVal, setInputVal] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    executeCommand(inputVal.trim());
    setInputVal('');
  };

  return (
    <div className="h-full flex flex-col font-mono text-xs text-[#CCCCCC] select-text bg-[#181818]">
      {/* Lines display */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1 no-scrollbar font-mono leading-relaxed">
        {lines.map((line) => {
          if (line.type === 'system') {
            return (
              <div key={line.id} className="text-[#858585]">
                {line.content}
              </div>
            );
          }

          if (line.type === 'input') {
            return (
              <div key={line.id} className="flex items-center gap-2 text-[#FFFFFF] pt-0.5">
                <span className="text-[#89D185]">PS C:\Projects\EduSim&gt;</span>
                <span>{line.content}</span>
              </div>
            );
          }

          if (line.type === 'error') {
            return (
              <div key={line.id} className="text-[#F14C4C] whitespace-pre-wrap pl-2">
                {line.content}
              </div>
            );
          }

          return (
            <div key={line.id} className="text-[#CCCCCC] whitespace-pre-wrap pl-2">
              {line.content}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <form
        onSubmit={handleSubmit}
        className="h-7 px-2.5 border-t border-[#2B2B2B] bg-[#181818] flex items-center gap-2"
      >
        <span className="text-[#89D185] select-none text-xs">PS C:\Projects\EduSim&gt;</span>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder=""
          className="flex-1 bg-transparent text-[#FFFFFF] focus:outline-none font-mono text-xs"
        />
        <button
          type="button"
          onClick={clearTerminal}
          className="p-1 text-[#858585] hover:text-[#FFFFFF] transition-colors"
          title="Clear Terminal"
        >
          <Trash2 size={12} />
        </button>
      </form>
    </div>
  );
};
