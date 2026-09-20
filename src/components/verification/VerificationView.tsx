import React, { useState } from 'react';
import { useTestStore } from '../../stores/testStore';
import { useUIStore } from '../../stores/uiStore';
import { useAgentStore } from '../../stores/agentStore';
import { TestItem } from './TestItem';
import { MetricCard } from '../common/MetricCard';
import { Badge } from '../common/Badge';
import { UITestViewer } from '../UIVerification';
import {
  CheckCircle2,
  Play,
  RotateCcw,
  ShieldCheck,
  Cpu,
  Layers,
  Activity,
  History,
  AlertTriangle,
  Globe
} from 'lucide-react';
import { clsx } from 'clsx';

export const VerificationView: React.FC = () => {
  const { testSummary, isRunningTests, runAllTests, injectSimulatedFailure, resolveFailure, filter, setFilter } =
    useTestStore();
  const { currentTask } = useAgentStore();
  const { setActiveView, addToast } = useUIStore();
  const [verificationSubTab, setVerificationSubTab] = useState<'tests' | 'ui'>('ui');

  const handleAnalyzeError = () => {
    setActiveView('recovery');
    addToast({
      type: 'info',
      title: 'Autonomous Error Analysis Triggered',
      message: 'Agent AST inspection localized root cause in theme hydration state.'
    });
  };

  const filteredTests = testSummary.tests.filter((t) => {
    if (filter === 'passed') return t.status === 'passed';
    if (filter === 'failed') return t.status === 'failed';
    return true;
  });

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1E1E1E] p-5 space-y-4 font-sans text-xs">
      {/* Header */}
      <div className="border-b border-[#2B2B2B] pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-sm bg-[#007ACC] flex items-center justify-center text-[#FFFFFF]">
            <CheckCircle2 size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#FFFFFF] font-mono">
                TESTING & VERIFICATION
              </h1>
              <Badge variant={testSummary.overall === 'PASSED' ? 'emerald' : 'rose'} size="xs">
                {testSummary.overall}
              </Badge>
              <Badge variant="amber" size="xs">
                Simulation Mode • Not Connected
              </Badge>
            </div>
            <p className="text-xs text-[#858585] mt-0.5">
              Task:{' '}
              <span className="text-[#CCCCCC] font-mono">"{currentTask.title}"</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {testSummary.overall === 'FAILED' ? (
            <button
              onClick={resolveFailure}
              className="px-3 py-1.5 rounded-sm bg-[#89D185]/15 hover:bg-[#89D185]/25 border border-[#89D185]/40 text-[#89D185] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw size={12} />
              <span>Resolve & Pass</span>
            </button>
          ) : (
            <button
              onClick={injectSimulatedFailure}
              className="px-2.5 py-1 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#F14C4C] text-xs font-mono transition-colors"
              title="Simulate a test failure to demo self-recovery"
            >
              Simulate Test Failure
            </button>
          )}

          <button
            onClick={() => setActiveView('recovery')}
            className="px-3 py-1.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <History size={12} />
            <span>Recovery Timeline</span>
          </button>

          <button
            onClick={runAllTests}
            disabled={isRunningTests}
            className="px-3.5 py-1.5 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] text-[#FFFFFF] font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <Play size={12} />
            <span>{isRunningTests ? 'Executing...' : 'Run All Tests'}</span>
          </button>
        </div>
      </div>

      {/* Sub-tab Switcher: Unit Tests vs Browser UI Verification */}
      <div className="flex items-center gap-2 border-b border-[#2B2B2B] pb-2 font-mono text-xs">
        <button
          onClick={() => setVerificationSubTab('ui')}
          className={clsx(
            'px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors',
            verificationSubTab === 'ui'
              ? 'bg-[#007ACC] text-white font-bold'
              : 'bg-[#252526] text-zinc-400 hover:text-zinc-200'
          )}
        >
          <Globe size={13} />
          <span>Browser UI Verification (Playwright)</span>
        </button>

        <button
          onClick={() => setVerificationSubTab('tests')}
          className={clsx(
            'px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors',
            verificationSubTab === 'tests'
              ? 'bg-[#007ACC] text-white font-bold'
              : 'bg-[#252526] text-zinc-400 hover:text-zinc-200'
          )}
        >
          <CheckCircle2 size={13} />
          <span>Unit & Integration Tests</span>
        </button>
      </div>

      {verificationSubTab === 'ui' ? (
        <div className="flex-1 min-h-[500px] rounded-lg border border-[#2B2B2B] overflow-hidden">
          <UITestViewer />
        </div>
      ) : (
        <>
          {/* Not connected notice banner */}
          <div className="p-3 rounded-sm bg-[#2A2312] border border-[#CCA700]/30 flex items-start gap-2.5 text-[#CCA700]">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-[#CCA700]" />
            <div className="text-xs space-y-0.5">
              <div className="font-bold">Test Runner Backend Service Not Connected</div>
              <div className="text-[#CCCCCC]">
                Structured test runner endpoints are not implemented on this branch. This view runs in interactive simulation mode. You can execute real test suites directly via the integrated Terminal.
              </div>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <MetricCard
              label="Build Status"
              value={testSummary.build}
              icon={Cpu}
              accentColor={testSummary.build === 'Passed' ? 'emerald' : 'rose'}
            />
            <MetricCard
              label="Unit Tests"
              value={`${testSummary.unit.passed} / ${testSummary.unit.total}`}
              icon={CheckCircle2}
              accentColor={testSummary.unit.failed > 0 ? 'rose' : 'emerald'}
            />
            <MetricCard
              label="Integration"
              value={`${testSummary.integration.passed} / ${testSummary.integration.total}`}
              icon={Layers}
              accentColor="cyan"
            />
            <MetricCard
              label="E2E Tests"
              value={`${testSummary.e2e.passed} / ${testSummary.e2e.total}`}
              icon={Activity}
              accentColor="indigo"
            />
            <MetricCard
              label="Static Analysis"
              value={testSummary.staticAnalysis}
              icon={ShieldCheck}
              accentColor="emerald"
            />
          </div>

          {/* Test Suites List */}
          <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
              <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
                EXECUTED TEST SUITES
              </h3>

              <div className="flex items-center gap-1 bg-[#1E1E1E] p-0.5 rounded-sm border border-[#2B2B2B] text-xs font-mono">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2 py-0.2 rounded-xs ${
                    filter === 'all' ? 'bg-[#264F78] text-[#FFFFFF]' : 'text-[#858585]'
                  }`}
                >
                  All ({testSummary.tests.length})
                </button>
                <button
                  onClick={() => setFilter('passed')}
                  className={`px-2 py-0.2 rounded-xs ${
                    filter === 'passed' ? 'bg-[#264F78] text-[#89D185]' : 'text-[#858585]'
                  }`}
                >
                  Passed
                </button>
                <button
                  onClick={() => setFilter('failed')}
                  className={`px-2 py-0.2 rounded-xs ${
                    filter === 'failed' ? 'bg-[#264F78] text-[#F14C4C]' : 'text-[#858585]'
                  }`}
                >
                  Failed ({testSummary.unit.failed})
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {filteredTests.map((test) => (
                <TestItem key={test.id} test={test} onAnalyze={handleAnalyzeError} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
