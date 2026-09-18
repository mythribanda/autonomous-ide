import React from 'react';
import { useRecoveryStore } from '../../stores/recoveryStore';
import { Badge } from '../common/Badge';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ArrowDown,
  Wrench,
  Search,
  Bot
} from 'lucide-react';
import { clsx } from 'clsx';

export const RecoveryTimelineView: React.FC = () => {
  const { steps, isSimulatingRecovery, triggerAutonomousRecovery } = useRecoveryStore();

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1E1E1E] p-5 space-y-4 font-sans text-xs">
      {/* Header */}
      <div className="border-b border-[#2B2B2B] pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-sm bg-[#007ACC] flex items-center justify-center text-[#FFFFFF]">
            <RefreshCw size={14} className={isSimulatingRecovery ? 'animate-spin' : ''} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#FFFFFF] font-mono">
                SELF-RECOVERY TIMELINE
              </h1>
              <Badge variant="amber" size="xs">
                Not connected • Simulated Data
              </Badge>
            </div>
            <p className="text-xs text-[#858585] mt-0.5">
              Automated failure diagnosis, AST root-cause localization, patch generation, and regression verification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={triggerAutonomousRecovery}
            disabled={isSimulatingRecovery}
            className="px-3.5 py-1.5 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] text-[#FFFFFF] font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <Bot size={13} />
            <span>{isSimulatingRecovery ? 'Diagnosing & Repairing...' : 'Simulate Recovery Loop'}</span>
          </button>
        </div>
      </div>

      {/* Not connected notice banner */}
      <div className="p-3 rounded-sm bg-[#2A2312] border border-[#CCA700]/30 flex items-start gap-2.5 text-[#CCA700]">
        <AlertTriangle size={15} className="shrink-0 mt-0.5 text-[#CCA700]" />
        <div className="text-xs space-y-0.5">
          <div className="font-bold">Self-Recovery Backend Service Not Connected</div>
          <div className="text-[#CCCCCC]">
            Autonomous self-healing backend endpoints are not implemented on this branch. Operating with simulated recovery data for demonstration purposes.
          </div>
        </div>
      </div>

      {/* Recovery Summary Cards */}
      <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2">
        <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
          RECOVERY SUMMARY
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B]">
            <span className="text-[10px] font-mono text-[#858585] uppercase">Initial Failures</span>
            <div className="text-base font-bold font-mono text-[#F14C4C] mt-0.5">1 Test Suite</div>
          </div>
          <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B]">
            <span className="text-[10px] font-mono text-[#858585] uppercase">Recovery Attempts</span>
            <div className="text-base font-bold font-mono text-[#CCA700] mt-0.5">1 Automated Cycle</div>
          </div>
          <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B]">
            <span className="text-[10px] font-mono text-[#858585] uppercase">Final Verdict</span>
            <div className="text-base font-bold font-mono text-[#89D185] mt-0.5">SUCCESS (100% Passed)</div>
          </div>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="space-y-4 relative before:absolute before:left-5 before:top-3 before:bottom-3 before:w-[2px] before:bg-[#2B2B2B]">
        {steps.map((step, idx) => {
          const isSuccess = step.status === 'success';

          return (
            <div key={idx} className="relative pl-11 select-none">
              {/* Timeline Marker */}
              <div
                className={clsx(
                  'absolute left-3.5 top-3 w-4 h-4 rounded-full -translate-x-1/2 flex items-center justify-center z-10 border',
                  isSuccess
                    ? 'bg-[#1E1E1E] border-[#89D185] text-[#89D185]'
                    : 'bg-[#1E1E1E] border-[#F14C4C] text-[#F14C4C]'
                )}
              >
                {isSuccess ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
              </div>

              {/* Step Card */}
              <div
                className={clsx(
                  'p-3.5 rounded-sm border transition-all space-y-3',
                  isSuccess
                    ? 'bg-[#181818] border-[#89D185]/30'
                    : 'bg-[#181818] border-[#F14C4C]/30'
                )}
              >
                <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
                  <div className="flex items-center gap-2 font-mono">
                    <Badge variant={isSuccess ? 'emerald' : 'rose'} size="sm">
                      ATTEMPT {step.attemptNumber}
                    </Badge>
                    <span className="text-xs font-semibold text-[#FFFFFF]">{step.title}</span>
                  </div>
                  <span
                    className={clsx(
                      'text-[10px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-xs',
                      isSuccess ? 'bg-[#89D185]/15 text-[#89D185]' : 'bg-[#F14C4C]/15 text-[#F14C4C]'
                    )}
                  >
                    {step.status}
                  </span>
                </div>

                {/* Flow Details */}
                <div className="space-y-2 text-xs font-mono">
                  {!isSuccess && (
                    <>
                      <div className="p-2 rounded-sm bg-[#1E1E1E] border border-[#F14C4C]/20 space-y-0.5">
                        <span className="text-[10px] text-[#858585] uppercase flex items-center gap-1">
                          <Search size={11} className="text-[#F14C4C]" /> Error Identified
                        </span>
                        <div className="text-[#F14C4C] font-medium">{step.errorIdentified}</div>
                      </div>

                      <div className="flex justify-center text-[#858585]">
                        <ArrowDown size={12} />
                      </div>

                      <div className="p-2 rounded-sm bg-[#1E1E1E] border border-[#CCA700]/20 space-y-0.5">
                        <span className="text-[10px] text-[#858585] uppercase flex items-center gap-1">
                          <AlertTriangle size={11} className="text-[#CCA700]" /> Root Cause Localization
                        </span>
                        <div className="text-[#CCCCCC]">{step.rootCause}</div>
                      </div>

                      <div className="flex justify-center text-[#858585]">
                        <ArrowDown size={12} />
                      </div>

                      <div className="p-2 rounded-sm bg-[#1E1E1E] border border-[#007ACC]/20 space-y-1.5">
                        <span className="text-[10px] text-[#858585] uppercase flex items-center gap-1">
                          <Wrench size={11} className="text-[#007ACC]" /> Automated Code Repair Applied
                        </span>
                        <div className="text-[#CCCCCC]">{step.repairApplied}</div>
                        <div className="p-2 rounded-sm bg-[#181818] border border-[#2B2B2B] text-[11px] overflow-x-auto whitespace-pre">
                          {step.diffSnippet}
                        </div>
                      </div>
                    </>
                  )}

                  {isSuccess && (
                    <div className="p-2 rounded-sm bg-[#1E1E1E] border border-[#89D185]/20 space-y-1.5">
                      <span className="text-[10px] text-[#858585] uppercase flex items-center gap-1">
                        <CheckCircle2 size={11} className="text-[#89D185]" /> Verification Result
                      </span>
                      <div className="text-[#CCCCCC]">{step.result}</div>
                      <div className="p-2 rounded-sm bg-[#181818] border border-[#2B2B2B] text-[11px] text-[#89D185] overflow-x-auto whitespace-pre">
                        {step.diffSnippet}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
