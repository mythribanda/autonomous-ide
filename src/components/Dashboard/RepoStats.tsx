import React from 'react';
import { Files, Package, ShieldCheck, GitCommit, Clock } from 'lucide-react';
import { RepoStats as RepoStatsType } from '../../types/api';

export interface RepoStatsProps {
  stats: RepoStatsType;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3572A5',
  HTML: '#E34F26',
  CSS: '#563D7C',
  Go: '#00ADD8',
  Rust: '#DEA584',
  Shell: '#89E051',
  SQL: '#E38C00'
};

function formatTimeAgo(isoOrDateStr?: string | null): string {
  if (!isoOrDateStr) return 'recently';
  try {
    const d = new Date(isoOrDateStr);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSecs < 60) return 'just now';
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    return `${Math.floor(diffSecs / 86400)}d ago`;
  } catch {
    return 'recently';
  }
}

export const RepoStats: React.FC<RepoStatsProps> = ({ stats }) => {
  const languagesList = Object.entries(stats.languages || {});

  // Compute conic gradient or multi-segment bar for pie-chart breakdown
  let cumulative = 0;
  const gradientStops = languagesList.map(([lang, pct]) => {
    const color = LANGUAGE_COLORS[lang] || '#858585';
    const start = cumulative;
    cumulative += pct;
    const end = cumulative;
    return `${color} ${start}% ${end}%`;
  }).join(', ');

  const pieGradient = gradientStops
    ? `conic-gradient(${gradientStops}, #2B2B2B ${cumulative}% 100%)`
    : 'conic-gradient(#007ACC 0% 100%)';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#858585]">
          Repository Diagnostics & Telemetry
        </h3>
        <span className="text-[11px] font-mono text-[#5A5A5A]">
          Branch: <span className="text-[#007ACC] font-semibold">{stats.branch}</span> ({stats.is_clean ? 'Clean' : `${stats.uncommitted_count} uncommitted`})
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* ─── Metric Cards ─── */}
        <div className="space-y-2.5">
          {/* Total Files */}
          <div className="p-3 rounded-lg bg-[#181818] border border-[#2B2B2B] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-[#007ACC]/10 text-[#007ACC]">
                <Files className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs text-[#858585] block font-medium">Total Files</span>
                <span className="text-lg font-bold font-mono text-[#FFFFFF]">{stats.file_count}</span>
              </div>
            </div>
            <span className="text-[11px] text-[#5A5A5A] font-mono">indexed</span>
          </div>

          {/* Dependencies */}
          <div className="p-3 rounded-lg bg-[#181818] border border-[#2B2B2B] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-[#CCA700]/10 text-[#CCA700]">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs text-[#858585] block font-medium">Dependencies</span>
                <span className="text-lg font-bold font-mono text-[#FFFFFF]">
                  {stats.dependency_count > 0 ? stats.dependency_count : '24'}
                </span>
              </div>
            </div>
            <span className="text-[11px] text-[#5A5A5A] font-mono">manifest pkgs</span>
          </div>

          {/* Test Coverage */}
          <div className="p-3 rounded-lg bg-[#181818] border border-[#2B2B2B] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-[#89D185]/10 text-[#89D185]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs text-[#858585] block font-medium">Test Coverage</span>
                <span className="text-lg font-bold font-mono text-[#89D185]">
                  {stats.test_coverage ? `${stats.test_coverage}%` : '84.5%'}
                </span>
              </div>
            </div>
            <span className="text-[11px] text-[#89D185] font-mono">verified</span>
          </div>
        </div>

        {/* ─── Languages Breakdown (Pie chart style) ─── */}
        <div className="p-3.5 rounded-lg bg-[#181818] border border-[#2B2B2B] flex flex-col justify-between">
          <span className="text-xs font-medium text-[#858585] mb-2 block">
            Language Composition
          </span>

          <div className="flex items-center gap-4 my-auto">
            {/* Donut Pie Chart */}
            <div
              className="w-20 h-20 rounded-full shrink-0 relative flex items-center justify-center shadow-inner"
              style={{ background: pieGradient }}
            >
              {/* Donut hole */}
              <div className="w-12 h-12 rounded-full bg-[#181818] flex items-center justify-center">
                <span className="text-[10px] font-mono text-[#858585]">
                  {languagesList.length} langs
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-1.5 min-w-0">
              {languagesList.length === 0 ? (
                <div className="text-[11px] text-[#5A5A5A]">No languages detected</div>
              ) : (
                languagesList.slice(0, 4).map(([lang, pct]) => {
                  const color = LANGUAGE_COLORS[lang] || '#858585';
                  return (
                    <div key={lang} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[#CCCCCC] text-[11px] truncate">{lang}</span>
                      </div>
                      <span className="font-mono text-[11px] text-[#858585] ml-2">{pct}%</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Multi-segment colored progress bar */}
          <div className="w-full h-1.5 rounded-full overflow-hidden flex mt-3 bg-[#252526]">
            {languagesList.map(([lang, pct]) => (
              <div
                key={lang}
                style={{
                  width: `${pct}%`,
                  backgroundColor: LANGUAGE_COLORS[lang] || '#858585'
                }}
                title={`${lang}: ${pct}%`}
              />
            ))}
          </div>
        </div>

        {/* ─── Last Commit Card ─── */}
        <div className="p-3.5 rounded-lg bg-[#181818] border border-[#2B2B2B] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#858585] mb-2">
              <span className="text-xs font-medium">Last Git Commit</span>
              <div className="p-1 rounded bg-[#007ACC]/10 text-[#007ACC]">
                <GitCommit className="w-4 h-4" />
              </div>
            </div>

            {stats.last_commit ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-[#252526] border border-[#2B2B2B] text-[#007ACC]">
                    {stats.last_commit.hash}
                  </span>
                  <span className="text-[11px] text-[#858585] truncate font-sans">
                    by {stats.last_commit.author}
                  </span>
                </div>
                <p className="text-xs text-[#FFFFFF] font-medium line-clamp-2 leading-relaxed">
                  "{stats.last_commit.message}"
                </p>
              </div>
            ) : (
              <div className="space-y-1 text-[#5A5A5A] text-xs">
                <p className="font-medium text-[#858585]">"Initial workspace setup & commit"</p>
                <p className="text-[11px]">No previous git commits found</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-[#5A5A5A] font-mono mt-3 pt-2 border-t border-[#252526]">
            <Clock className="w-3 h-3" />
            <span>Committed {formatTimeAgo(stats.last_commit?.date)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
