import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useProjectStore } from '../../store/projectStore';
import { getModelLatency, getModelHealth, getProjectModelConfig } from '../../lib/api';
import { ModelLatencyStats, ModelHealthData } from '../../types/api';

export const ModelStatus: React.FC = () => {
  const { openSettings } = useSettingsStore();
  const { projectId } = useProjectStore();

  const [connected, setConnected] = useState<boolean>(true);
  const [modelName, setModelName] = useState<string>('llama3.1:8b');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const fetchStatus = async () => {
    // 1. Fetch latency & health
    try {
      const data = await getModelHealth();
      setConnected(data.health.connected);
      if (data.stats && data.stats.avg_ms > 0) {
        setLatencyMs(Math.round(data.stats.avg_ms));
      } else if (data.health.latency_ms) {
        setLatencyMs(Math.round(data.health.latency_ms));
      }
    } catch {
      try {
        const stats = await getModelLatency();
        if (stats.avg_ms > 0) {
          setLatencyMs(Math.round(stats.avg_ms));
        }
        setConnected(true);
      } catch {
        setConnected(false);
      }
    }

    // 2. Fetch project model name if project is open
    if (projectId) {
      try {
        const cfg = await getProjectModelConfig(projectId);
        if (cfg.planning_model) {
          setModelName(cfg.planning_model);
        }
      } catch {}
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [projectId]);

  const latencyText = latencyMs !== null ? `~${latencyMs}ms` : '<500ms';

  return (
    <button
      onClick={openSettings}
      className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-white/15 rounded-xs transition-colors font-mono text-[11px] text-[#FFFFFF]"
      title={`LLM Provider: Ollama | Model: ${modelName} | Latency: ${latencyText}. Click to open Model Settings.`}
    >
      <span
        className={`w-2 h-2 rounded-full inline-block ${
          connected ? 'bg-emerald-400 shadow-xs shadow-emerald-400' : 'bg-rose-400'
        }`}
      />
      <span className="font-sans font-medium">Ollama</span>
      <span className="text-white/70">|</span>
      <span className="truncate max-w-[120px]">{modelName}</span>
      <span className="text-white/70">|</span>
      <span className="text-white/90">{latencyText}</span>
    </button>
  );
};
