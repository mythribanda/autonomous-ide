import React, { useState, useEffect, useCallback } from 'react';
import { ScreenshotResult } from '../../types/api';
import {
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Download,
  Copy,
  Check,
  Camera
} from 'lucide-react';
import { clsx } from 'clsx';

interface ScreenshotGalleryProps {
  screenshots: ScreenshotResult[];
  className?: string;
}

export const ScreenshotGallery: React.FC<ScreenshotGalleryProps> = ({
  screenshots,
  className
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === 'Escape') {
        setSelectedIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex((prev) =>
          prev !== null && prev < screenshots.length - 1 ? prev + 1 : prev
        );
      }
    },
    [selectedIndex, screenshots.length]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const copyCurrentScreenshot = async () => {
    if (selectedIndex === null) return;
    const shot = screenshots[selectedIndex];
    if (!shot.screenshot_base64) return;
    try {
      const byteCharacters = atob(shot.screenshot_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/jpeg': blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      await navigator.clipboard.writeText(
        `data:image/jpeg;base64,${shot.screenshot_base64}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadCurrentScreenshot = () => {
    if (selectedIndex === null) return;
    const shot = screenshots[selectedIndex];
    if (!shot.screenshot_base64) return;
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${shot.screenshot_base64}`;
    link.download = `ui-step-${shot.step_index}-${shot.action}.jpg`;
    link.click();
  };

  if (!screenshots || screenshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-[#2B2B2B] rounded-lg">
        <Camera size={24} className="mb-2 text-zinc-600" />
        <p>No verification screenshots captured yet.</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Execute UI verification to capture automated browser frames.
        </p>
      </div>
    );
  }

  const activeShot = selectedIndex !== null ? screenshots[selectedIndex] : null;

  return (
    <div className={clsx('space-y-3', className)}>
      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {screenshots.map((shot, idx) => (
          <div
            key={shot.step_index || idx}
            onClick={() => setSelectedIndex(idx)}
            className="group relative rounded-lg border border-[#2B2B2B] bg-[#141414] overflow-hidden cursor-pointer hover:border-[#007ACC] hover:shadow-lg transition-all flex flex-col"
          >
            {/* Image Preview Container */}
            <div className="relative aspect-video w-full bg-black/60 flex items-center justify-center overflow-hidden">
              {shot.screenshot_base64 ? (
                <img
                  src={`data:image/jpeg;base64,${shot.screenshot_base64}`}
                  alt={shot.description}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
              ) : (
                <div className="flex items-center gap-1.5 text-zinc-600 text-[10px] font-mono">
                  <Camera size={14} />
                  <span>No preview</span>
                </div>
              )}

              {/* Status Badge Overlay */}
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                <span
                  className={clsx(
                    'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 shadow',
                    shot.passed
                      ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-800'
                      : 'bg-rose-950/90 text-rose-300 border border-rose-800'
                  )}
                >
                  {shot.passed ? (
                    <CheckCircle2 size={10} className="text-emerald-400" />
                  ) : (
                    <XCircle size={10} className="text-rose-400" />
                  )}
                  <span>{shot.passed ? 'PASS' : 'FAIL'}</span>
                </span>
              </div>

              {/* Hover overlay button */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <div className="p-1.5 rounded-full bg-[#007ACC] text-white shadow">
                  <Maximize2 size={14} />
                </div>
              </div>
            </div>

            {/* Description & Action Footer */}
            <div className="p-2 bg-[#181818] border-t border-[#2B2B2B] flex flex-col justify-between flex-1 gap-1 font-mono text-xs">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase font-bold text-[#007ACC]">
                  Step {shot.step_index}: {shot.action}
                </span>
              </div>
              <p
                className="text-[11px] text-zinc-300 truncate font-sans"
                title={shot.description}
              >
                {shot.description}
              </p>
              {shot.error && (
                <span
                  className="text-[10px] text-rose-400 truncate"
                  title={shot.error}
                >
                  {shot.error}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal with Keyboard Navigation */}
      {activeShot && selectedIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-5xl w-full bg-[#181818] border border-[#2B2B2B] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Top Toolbar */}
            <div className="px-4 py-2.5 bg-[#1E1E1E] border-b border-[#2B2B2B] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="font-bold text-white">
                  Step {activeShot.step_index} of {screenshots.length}:
                </span>
                <span className="text-[#007ACC] uppercase font-bold">
                  {activeShot.action}
                </span>
                <span className="text-zinc-400 font-sans truncate max-w-md">
                  — {activeShot.description}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyCurrentScreenshot}
                  className="px-2.5 py-1 rounded bg-[#252526] hover:bg-[#2e2e30] text-zinc-300 border border-[#3c3c3c] text-xs flex items-center gap-1.5 transition-colors"
                  title="Copy screenshot"
                >
                  {copied ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : (
                    <Copy size={12} />
                  )}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={downloadCurrentScreenshot}
                  className="px-2.5 py-1 rounded bg-[#252526] hover:bg-[#2e2e30] text-zinc-300 border border-[#3c3c3c] text-xs flex items-center gap-1.5 transition-colors"
                  title="Download image"
                >
                  <Download size={12} />
                  <span>Save</span>
                </button>

                <button
                  onClick={() => setSelectedIndex(null)}
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#252526] transition-colors ml-2"
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Main Image Area with Left/Right arrows */}
            <div className="relative flex-1 bg-black/90 flex items-center justify-center p-2 overflow-auto">
              {activeShot.screenshot_base64 ? (
                <img
                  src={`data:image/jpeg;base64,${activeShot.screenshot_base64}`}
                  alt={activeShot.description}
                  className="max-h-[70vh] w-auto object-contain rounded border border-[#2B2B2B] shadow-lg"
                />
              ) : (
                <div className="text-zinc-500 font-mono text-xs">
                  No screenshot captured for this step
                </div>
              )}

              {/* Prev / Next controls */}
              {selectedIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIndex(selectedIndex - 1);
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 border border-zinc-700 text-white hover:bg-black/90 transition-colors shadow-lg"
                  title="Previous Step (Left Arrow)"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {selectedIndex < screenshots.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIndex(selectedIndex + 1);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 border border-zinc-700 text-white hover:bg-black/90 transition-colors shadow-lg"
                  title="Next Step (Right Arrow)"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>

            {/* Error or Details banner if failed */}
            {activeShot.error && (
              <div className="px-4 py-2 bg-rose-950/40 border-t border-rose-800/60 text-rose-300 font-mono text-xs">
                <span className="font-bold">Error:</span> {activeShot.error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
