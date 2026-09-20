import React, { useState, useEffect } from 'react';
import {
  UIVerificationResult,
  ScreenshotResult
} from '../../types/api';
import { verifyAgentUI, getUIVerification } from '../../lib/api';
import { useAgentStore } from '../../stores/agentStore';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { ScreenshotGallery } from './ScreenshotGallery';
import {
  Play,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Camera,
  AlertTriangle,
  Globe,
  Sliders,
  Maximize2
} from 'lucide-react';
import { clsx } from 'clsx';

export const UITestViewer: React.FC = () => {
  const { currentTask } = useAgentStore();
  const { projectId } = useProjectStore();
  const { addToast } = useUIStore();

  const [loading, setLoading] = useState<boolean>(false);
  const [headless, setHeadless] = useState<boolean>(true);
  const [appUrl, setAppUrl] = useState<string>('http://localhost:5173');
  const [verificationData, setVerificationData] = useState<UIVerificationResult | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotResult | null>(null);
  const [activeTab, setActiveTab] = useState<'steps' | 'gallery'>('steps');

  // Attempt to load existing UI verification if taskId exists
  useEffect(() => {
    if (!currentTask?.id) return;
    let isMounted = true;
    getUIVerification(currentTask.id)
      .then((res) => {
        if (isMounted && res) {
          setVerificationData(res);
          if (res.app_url) setAppUrl(res.app_url);
          if (res.screenshots && res.screenshots.length > 0) {
            setSelectedScreenshot(res.screenshots[res.screenshots.length - 1]);
          }
        }
      })
      .catch(() => {
        // Not run yet or no data stored
      });
    return () => {
      isMounted = false;
    };
  }, [currentTask?.id]);

  const handleRunUIVerification = async () => {
    if (!currentTask?.id) {
      addToast({
        type: 'warning',
        title: 'No Active Task',
        message: 'Please initiate or select an agent task to run UI verification.'
      });
      return;
    }

    setLoading(true);
    try {
      addToast({
        type: 'info',
        title: 'Browser Verification Started',
        message: `Running Playwright tests (${headless ? 'Headless' : 'Visible Browser'})...`
      });

      const res = await verifyAgentUI(currentTask.id, {
        app_url: appUrl || undefined,
        headless: headless
      });

      setVerificationData(res);
      if (res.app_url) setAppUrl(res.app_url);
      if (res.screenshots && res.screenshots.length > 0) {
        setSelectedScreenshot(res.screenshots[res.screenshots.length - 1]);
      }

      if (res.overall_passed) {
        addToast({
          type: 'success',
          title: 'UI Verification Passed',
          message: `All ${res.steps_passed} automated browser test steps completed successfully.`
        });
      } else {
        addToast({
          type: 'error',
          title: 'UI Verification Failed',
          message: `${res.steps_failed} out of ${res.steps_passed + res.steps_failed} test steps failed.`
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'UI Verification Failed',
        message: err?.message || 'Could not execute Playwright verification.'
      });
    } finally {
      setLoading(false);
    }
  };

  const screenshots = verificationData?.screenshots || [];

  return (
    <div className="flex flex-col h-full bg-[#181818] font-sans text-xs select-none">
      {/* 1. Header Toolbar */}
      <div className="p-3 border-b border-[#2B2B2B] bg-[#1E1E1E] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-[#007ACC] flex items-center justify-center text-white font-bold">
            <Globe size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white font-mono tracking-wide">
                BROWSER UI VERIFICATION
              </h2>
              {verificationData && (
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 border',
                    verificationData.overall_passed
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      : 'bg-rose-950/80 text-rose-300 border-rose-800'
                  )}
                >
                  {verificationData.overall_passed ? (
                    <CheckCircle2 size={11} className="text-emerald-400" />
                  ) : (
                    <XCircle size={11} className="text-rose-400" />
                  )}
                  <span>
                    {verificationData.overall_passed ? 'ALL PASSED' : 'STEP FAILED'}
                  </span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400">
              Automated Playwright Chromium testing & step-by-step visual snapshot auditing.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Target URL input */}
          <div className="flex items-center gap-1.5 bg-[#141414] border border-[#333333] px-2 py-1 rounded">
            <span className="text-[10px] text-zinc-500 font-mono">App URL:</span>
            <input
              type="text"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="http://localhost:5173"
              className="bg-transparent text-zinc-200 font-mono text-[11px] focus:outline-none w-44"
            />
          </div>

          {/* Show Browser Toggle */}
          <button
            onClick={() => setHeadless(!headless)}
            className={clsx(
              'px-2.5 py-1.5 rounded border text-xs font-mono flex items-center gap-1.5 transition-colors',
              !headless
                ? 'bg-[#007ACC]/20 border-[#007ACC] text-[#007ACC] font-bold'
                : 'bg-[#252526] border-[#333333] text-zinc-400 hover:text-zinc-200'
            )}
            title="Toggle visible browser window for interactive demonstration"
          >
            {!headless ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>{!headless ? 'Browser: Visible' : 'Browser: Headless'}</span>
          </button>

          {/* Run Verification Button */}
          <button
            onClick={handleRunUIVerification}
            disabled={loading}
            className="px-3.5 py-1.5 rounded bg-[#007ACC] hover:bg-[#0062a3] text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            <span>{loading ? 'Running Tests...' : 'Run UI Verification'}</span>
          </button>
        </div>
      </div>

      {/* 2. Secondary Tab Switcher */}
      <div className="px-4 py-1.5 bg-[#141414] border-b border-[#2B2B2B] flex items-center justify-between text-xs font-mono shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('steps')}
            className={clsx(
              'px-3 py-1 rounded transition-colors',
              activeTab === 'steps'
                ? 'bg-[#252526] text-white font-bold text-[#007ACC]'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            Live Execution & Preview ({screenshots.length} steps)
          </button>
          <button
            onClick={() => setActiveTab('gallery')}
            className={clsx(
              'px-3 py-1 rounded transition-colors',
              activeTab === 'gallery'
                ? 'bg-[#252526] text-white font-bold text-[#007ACC]'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            Screenshot Gallery ({screenshots.length})
          </button>
        </div>

        {verificationData && (
          <div className="text-[11px] text-zinc-400 flex items-center gap-3">
            <span className="text-emerald-400">
              ✓ {verificationData.steps_passed} passed
            </span>
            {verificationData.steps_failed > 0 && (
              <span className="text-rose-400">
                ✗ {verificationData.steps_failed} failed
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Main Body */}
      <div className="flex-1 overflow-hidden p-4">
        {activeTab === 'gallery' ? (
          <div className="h-full overflow-y-auto pr-1">
            <ScreenshotGallery screenshots={screenshots} />
          </div>
        ) : (
          <div className="h-full flex flex-col md:flex-row gap-4 overflow-hidden">
            {/* Left: Step Execution Timeline */}
            <div className="w-full md:w-5/12 h-full flex flex-col rounded-lg border border-[#2B2B2B] bg-[#141414] overflow-hidden">
              <div className="px-3 py-2 border-b border-[#2B2B2B] bg-[#1E1E1E] font-mono font-bold text-zinc-300 flex items-center justify-between shrink-0">
                <span>TEST EXECUTION STEPS</span>
                {screenshots.length > 0 && (
                  <span className="text-[10px] text-zinc-500">
                    Click step to view frame
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {screenshots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-zinc-500 font-mono text-center p-4">
                    <Sliders size={20} className="mb-2 text-zinc-600" />
                    <span>No UI test run recorded.</span>
                    <span className="text-[10px] text-zinc-600 mt-1">
                      Click "Run UI Verification" to generate Playwright tests and execute.
                    </span>
                  </div>
                ) : (
                  screenshots.map((shot, idx) => {
                    const isSelected = selectedScreenshot?.step_index === shot.step_index;
                    return (
                      <div
                        key={shot.step_index || idx}
                        onClick={() => setSelectedScreenshot(shot)}
                        className={clsx(
                          'p-2.5 rounded border cursor-pointer transition-colors flex items-start gap-2.5 font-mono text-xs',
                          isSelected
                            ? 'bg-[#252526] border-[#007ACC] text-white shadow-sm'
                            : 'bg-[#181818] border-[#2B2B2B] text-zinc-300 hover:bg-[#1E1E1E]'
                        )}
                      >
                        <div className="mt-0.5 shrink-0">
                          {shot.passed ? (
                            <CheckCircle2 size={14} className="text-emerald-400" />
                          ) : (
                            <XCircle size={14} className="text-rose-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#007ACC] uppercase text-[11px]">
                              Step {shot.step_index}: {shot.action}
                            </span>
                            <span
                              className={clsx(
                                'text-[9px] px-1 rounded',
                                shot.passed
                                  ? 'bg-emerald-950 text-emerald-300'
                                  : 'bg-rose-950 text-rose-300'
                              )}
                            >
                              {shot.passed ? 'PASSED' : 'FAILED'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-300 font-sans leading-snug">
                            {shot.description}
                          </p>
                          {shot.error && (
                            <p className="text-[10px] text-rose-400 font-mono break-all pt-1">
                              {shot.error}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Selected Step Visual Frame & Screenshot Strip */}
            <div className="w-full md:w-7/12 h-full flex flex-col rounded-lg border border-[#2B2B2B] bg-[#141414] overflow-hidden">
              <div className="px-3 py-2 border-b border-[#2B2B2B] bg-[#1E1E1E] flex items-center justify-between shrink-0 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <Camera size={13} className="text-[#007ACC]" />
                  <span className="font-bold text-zinc-200">ACTIVE SNAPSHOT</span>
                  {selectedScreenshot && (
                    <span className="text-[10px] text-zinc-400">
                      (Step {selectedScreenshot.step_index}: {selectedScreenshot.action})
                    </span>
                  )}
                </div>

                {selectedScreenshot?.screenshot_base64 && (
                  <button
                    onClick={() => setActiveTab('gallery')}
                    className="text-[11px] text-[#007ACC] hover:underline flex items-center gap-1"
                  >
                    <span>Expand Gallery</span>
                    <Maximize2 size={11} />
                  </button>
                )}
              </div>

              {/* Main Viewport */}
              <div className="flex-1 bg-black/80 flex items-center justify-center p-3 overflow-hidden">
                {selectedScreenshot?.screenshot_base64 ? (
                  <img
                    src={`data:image/jpeg;base64,${selectedScreenshot.screenshot_base64}`}
                    alt={selectedScreenshot.description}
                    className="max-h-full max-w-full object-contain rounded border border-[#2B2B2B] shadow-2xl"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-600 font-mono text-xs text-center p-4">
                    <Camera size={28} className="mb-2 text-zinc-700" />
                    <span>No frame selected or captured.</span>
                  </div>
                )}
              </div>

              {/* Bottom Thumbnail Strip */}
              {screenshots.length > 0 && (
                <div className="p-2 bg-[#181818] border-t border-[#2B2B2B] flex items-center gap-2 overflow-x-auto shrink-0">
                  {screenshots.map((shot, idx) => {
                    const isSelected = selectedScreenshot?.step_index === shot.step_index;
                    return (
                      <div
                        key={shot.step_index || idx}
                        onClick={() => setSelectedScreenshot(shot)}
                        className={clsx(
                          'relative w-20 h-12 rounded border shrink-0 overflow-hidden cursor-pointer transition-all',
                          isSelected
                            ? 'border-[#007ACC] ring-2 ring-[#007ACC]/50 scale-105'
                            : 'border-[#2B2B2B] opacity-70 hover:opacity-100'
                        )}
                        title={`Step ${shot.step_index}: ${shot.description}`}
                      >
                        {shot.screenshot_base64 ? (
                          <img
                            src={`data:image/jpeg;base64,${shot.screenshot_base64}`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-[9px] font-mono text-zinc-600">
                            Frame
                          </div>
                        )}
                        <div className="absolute bottom-0.5 right-0.5">
                          {shot.passed ? (
                            <CheckCircle2 size={10} className="text-emerald-400 bg-black/60 rounded-full" />
                          ) : (
                            <XCircle size={10} className="text-rose-400 bg-black/60 rounded-full" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
