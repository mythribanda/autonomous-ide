import React from 'react';
import { EvaluationTimelineItem } from '../../types/api';

export interface TaskCompletionTimelineProps {
  timeline: EvaluationTimelineItem[];
}

export const TaskCompletionTimeline: React.FC<TaskCompletionTimelineProps> = ({ timeline }) => {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-[#5A5A5A] text-xs font-mono">
        No task timeline data available yet.
      </div>
    );
  }

  // Dimensions
  const svgWidth = 640;
  const svgHeight = 220;
  const padding = { top: 25, right: 30, bottom: 40, left: 45 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Max value for Y
  const maxTasks = Math.max(
    ...timeline.map((d) => (d.cumulative_completed || 0) + (d.cumulative_failed || 0)),
    5
  );

  const getX = (index: number) => {
    if (timeline.length <= 1) return padding.left + graphWidth / 2;
    return padding.left + (index / (timeline.length - 1)) * graphWidth;
  };

  const getY = (val: number) => {
    return padding.top + graphHeight - (val / maxTasks) * graphHeight;
  };

  // Build SVG path points
  const completedPoints = timeline.map((d, i) => `${getX(i)},${getY(d.cumulative_completed)}`).join(' ');
  const totalPoints = timeline.map((d, i) => `${getX(i)},${getY(d.cumulative_completed + d.cumulative_failed)}`).join(' ');

  // Polygon area for completed tasks
  const completedArea = `
    ${getX(0)},${getY(0)}
    ${completedPoints}
    ${getX(timeline.length - 1)},${getY(0)}
  `;

  // Polygon area for failed tasks (stacked between completed and total)
  const failedArea = `
    ${getX(0)},${getY(timeline[0].cumulative_completed)}
    ${totalPoints}
    ${timeline.map((_, i) => `${getX(timeline.length - 1 - i)},${getY(timeline[timeline.length - 1 - i].cumulative_completed)}`).join(' ')}
  `;

  return (
    <div className="w-full space-y-2 select-none">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[#CCCCCC]">Cumulative Autonomous Task Execution Timeline</span>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#89D185]" />
            <span className="text-[#858585]">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#F14C4C]" />
            <span className="text-[#858585]">Failed / Interrupted</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-[#141414] border border-[#2B2B2B] p-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-48 overflow-visible"
        >
          <defs>
            <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#89D185" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#89D185" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F14C4C" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#F14C4C" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = padding.top + graphHeight * (1 - pct);
            const val = Math.round(maxTasks * pct);
            return (
              <g key={pct}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + graphWidth}
                  y2={y}
                  stroke="#262626"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#5A5A5A"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Failed tasks area band (on top of completed) */}
          <polygon points={failedArea} fill="url(#failedGrad)" />

          {/* Completed tasks area */}
          <polygon points={completedArea} fill="url(#completedGrad)" />

          {/* Lines */}
          <polyline
            fill="none"
            stroke="#F14C4C"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            points={totalPoints}
          />
          <polyline
            fill="none"
            stroke="#89D185"
            strokeWidth="2.5"
            points={completedPoints}
          />

          {/* Data Points */}
          {timeline.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.cumulative_completed);
            const isSuccess = d.status === 'completed';

            return (
              <g key={i} className="group">
                <circle
                  cx={cx}
                  cy={cy}
                  r="3.5"
                  fill={isSuccess ? '#89D185' : '#F14C4C'}
                  stroke="#141414"
                  strokeWidth="2"
                  className="cursor-pointer transition-transform hover:scale-150"
                />
                <title>{`Task ${d.task_index}: ${d.title} (${d.status})`}</title>

                {/* X-axis labels for key indices */}
                {(timeline.length <= 8 || i % Math.ceil(timeline.length / 6) === 0 || i === timeline.length - 1) && (
                  <text
                    x={cx}
                    y={padding.top + graphHeight + 18}
                    textAnchor="middle"
                    fill="#6E6E6E"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    T{d.task_index}
                  </text>
                )}
              </g>
            );
          })}

          {/* Axis Labels */}
          <text
            x={padding.left + graphWidth / 2}
            y={svgHeight - 6}
            textAnchor="middle"
            fill="#5A5A5A"
            fontSize="10"
            fontFamily="sans-serif"
          >
            Chronological Task Sequence
          </text>
        </svg>
      </div>
    </div>
  );
};
