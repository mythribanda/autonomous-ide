import React from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { AuditLogEntry } from '../../types';
import { Clock } from 'lucide-react';
import { Badge } from '../common/Badge';

export const AuditLogTable: React.FC = () => {
  const { auditLogs } = useSettingsStore();

  const getVerdictBadge = (verdict: AuditLogEntry['verdict']) => {
    switch (verdict) {
      case 'Allowed':
        return <Badge variant="emerald" size="xs" dot>Allowed</Badge>;
      case 'Blocked':
        return <Badge variant="rose" size="xs" dot>Blocked</Badge>;
      case 'Prompted':
        return <Badge variant="amber" size="xs" dot>Prompted</Badge>;
    }
  };

  return (
    <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2.5 font-mono text-xs select-none">
      <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
        <div className="flex items-center gap-1.5">
          <Clock size={14} className="text-[#007ACC]" />
          <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase tracking-wider">
            SECURITY AUDIT LOG
          </h3>
        </div>
        <span className="text-[10px] text-[#858585]">Policy Enforcement</span>
      </div>

      <div className="space-y-1.5">
        {auditLogs.map((log) => (
          <div
            key={log.id}
            className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[#858585] text-[10px]">{log.timestamp}</span>
              <Badge variant="blue" size="xs">{log.action}</Badge>
              <span className="font-semibold text-[#CCCCCC] truncate text-xs">{log.target}</span>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-[11px] text-[#858585] font-sans hidden md:inline truncate max-w-xs">
                {log.reason}
              </span>
              {getVerdictBadge(log.verdict)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
