import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Server,
  Activity,
  Download,
  Check,
  AlertCircle,
  RefreshCw,
  Zap,
  Sliders,
  Layers,
  Terminal as TerminalIcon,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useTerminalStore } from '../../stores/terminalStore';
import {
  getOllamaHealth,
  getModelLatency,
  getModelHealth,
  getProjectModelConfig,
  updateProjectModelConfig
} from '../../lib/api';
import { ModelConfig, ModelLatencyStats, ModelHealthData } from '../../types/api';

export const ModelSettings: React.FC = () => {
  const { projectId } = useProjectStore();
  const { executeCommand, setOpen } = useTerminalStore();

  const [config, setConfig] = useState<ModelConfig>({
    planning_model: 'llama3.1:8b',
    coding_model: 'codellama:13b',
    diagnosis_model: 'llama3.1:8b',
    summarization_model: 'llama3.1:8b',
    ollama_base_url: 'http://localhost:11434',
    temperature: 0.2,
    max_tokens: 2000
  });

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelHealth, setModelHealth] = useState<ModelHealthData | null>(null);
  const [latencyStats, setLatencyStats] = useState<ModelLatencyStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [pullModelName, setPullModelName] = useState<string>('');
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      // 1. Load project model config if project is open
      if (projectId) {
        try {
          const cfg = await getProjectModelConfig(projectId);
          setConfig(cfg);
        } catch (e) {
          console.warn('Could not fetch project model config', e);
        }
      }

      // 2. Fetch available models from Ollama health
      try {
        const ollamaRes = await getOllamaHealth();
        if (ollamaRes.connected && ollamaRes.models) {
          setAvailableModels(ollamaRes.models);
        }
      } catch (e) {
        console.warn('Could not fetch ollama models', e);
      }

      // 3. Fetch model health & latency stats
      try {
        const healthData = await getModelHealth();
        setModelHealth(healthData.health);
        setLatencyStats(healthData.stats);
      } catch (e) {
        // Fallback to latency only
        try {
          const stats = await getModelLatency();
          setLatencyStats(stats);
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [projectId]);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionMessage(null);
    try {
      const res = await getOllamaHealth();
      if (res.connected) {
        setConnectionMessage(`Connected successfully! Found ${res.models?.length || 0} models.`);
        if (res.models) setAvailableModels(res.models);
      } else {
        setConnectionMessage(`Connection failed: ${res.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setConnectionMessage(`Connection error: ${e?.message || 'Host unreachable'}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateProjectModelConfig(projectId, config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      alert(`Failed to save model configuration: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePullModel = () => {
    const target = pullModelName.trim();
    if (!target) return;
    setOpen(true);
    executeCommand(`ollama pull ${target}`);
    setPullModelName('');
  };

  const allModelOptions = Array.from(
    new Set([
      ...availableModels,
      config.planning_model,
      config.coding_model,
      config.diagnosis_model,
      config.summarization_model,
      'llama3.2:latest',
      'llama3.1:8b',
      'codellama:13b',
      'qwen2.5-coder:14b',
      'deepseek-coder:16b'
    ].filter(Boolean))
  );

  return (
    <div className="space-y-5 text-xs text-[#CCCCCC]">
      {/* 1. Health & Latency Card */}
      <div className="p-3.5 bg-[#181818] border border-[#2B2B2B] rounded-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu size={15} className="text-purple-400" />
            <span className="font-semibold text-zinc-200">Model Runtime & Telemetry</span>
          </div>
          <button
            onClick={loadAll}
            className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono text-[10px]"
            title="Refresh status"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-[11px] pt-2 border-t border-[#252525]">
          <div className="space-y-1">
            <span className="text-zinc-500 text-[10px] block">RUNTIME STATUS</span>
            <div className="flex items-center gap-1.5 font-sans font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  modelHealth?.connected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-rose-500'
                }`}
              />
              <span className={modelHealth?.connected ? 'text-emerald-300' : 'text-rose-300'}>
                {modelHealth?.connected ? 'Ollama Online' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-zinc-500 text-[10px] block">AVG INFERENCE</span>
            <div className="flex items-center gap-1 text-sky-300">
              <Zap size={11} className="text-sky-400" />
              <span>{latencyStats?.avg_ms ? `~${Math.round(latencyStats.avg_ms)} ms` : 'N/A'}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-zinc-500 text-[10px] block">LATENCY (P50 / P95)</span>
            <span className="text-purple-300">
              {latencyStats?.p50_ms ? `${Math.round(latencyStats.p50_ms)}ms / ${Math.round(latencyStats.p95_ms)}ms` : 'N/A'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-zinc-500 text-[10px] block">SAMPLES (ROLLING)</span>
            <span className="text-zinc-300">{latencyStats?.count ?? 0} calls</span>
          </div>
        </div>
      </div>

      {/* 2. Ollama Connection URL */}
      <div className="space-y-2">
        <label className="text-[10px] text-[#858585] uppercase tracking-wider block font-mono">
          OLLAMA CONNECTION URL
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Server size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={config.ollama_base_url}
              onChange={(e) => setConfig({ ...config, ollama_base_url: e.target.value })}
              placeholder="http://localhost:11434"
              className="w-full bg-[#181818] border border-[#2B2B2B] rounded pl-8 pr-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#007ACC]"
            />
          </div>
          <button
            type="button"
            disabled={testingConnection}
            onClick={handleTestConnection}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium flex items-center gap-1.5 transition-colors"
          >
            {testingConnection && <Loader2 size={12} className="animate-spin" />}
            <span>Test URL</span>
          </button>
        </div>
        {connectionMessage && (
          <p
            className={`text-[11px] ${
              connectionMessage.includes('successfully') ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {connectionMessage}
          </p>
        )}
      </div>

      {/* 3. Role-Based Model Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-[#858585] uppercase tracking-wider block font-mono">
            ROLE-BASED MODEL ROUTING
          </label>
          <span className="text-[10px] text-zinc-500 font-mono">
            Route distinct tasks to specialized LLMs
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Planning Model */}
          <div className="p-3 bg-[#181818] border border-[#2B2B2B] rounded-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-zinc-200">Planning Model</span>
              <span className="text-[10px] font-mono text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-900/60">
                planning
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">Used for requirements extraction and step decomposition.</p>
            <select
              value={config.planning_model}
              onChange={(e) => setConfig({ ...config, planning_model: e.target.value })}
              className="w-full bg-[#141414] border border-[#2B2B2B] rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#007ACC]"
            >
              {allModelOptions.map((m) => (
                <option key={`plan-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Coding Model */}
          <div className="p-3 bg-[#181818] border border-[#2B2B2B] rounded-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-zinc-200">Coding Model</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-900/60">
                coding
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">Used for code synthesis, editing, and tool execution.</p>
            <select
              value={config.coding_model}
              onChange={(e) => setConfig({ ...config, coding_model: e.target.value })}
              className="w-full bg-[#141414] border border-[#2B2B2B] rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#007ACC]"
            >
              {allModelOptions.map((m) => (
                <option key={`code-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Diagnosis Model */}
          <div className="p-3 bg-[#181818] border border-[#2B2B2B] rounded-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-zinc-200">Diagnosis Model</span>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-900/60">
                diagnosis
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">Used for runtime error analysis and self-recovery.</p>
            <select
              value={config.diagnosis_model}
              onChange={(e) => setConfig({ ...config, diagnosis_model: e.target.value })}
              className="w-full bg-[#141414] border border-[#2B2B2B] rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#007ACC]"
            >
              {allModelOptions.map((m) => (
                <option key={`diag-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Summarization Model */}
          <div className="p-3 bg-[#181818] border border-[#2B2B2B] rounded-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-zinc-200">Summarization Model</span>
              <span className="text-[10px] font-mono text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-900/60">
                summarization
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">Used for knowledge graph context and evaluation summaries.</p>
            <select
              value={config.summarization_model}
              onChange={(e) => setConfig({ ...config, summarization_model: e.target.value })}
              className="w-full bg-[#141414] border border-[#2B2B2B] rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#007ACC]"
            >
              {allModelOptions.map((m) => (
                <option key={`sum-${m}`} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Generation Hyperparameters */}
      <div className="space-y-3">
        <label className="text-[10px] text-[#858585] uppercase tracking-wider block font-mono">
          GENERATION HYPERPARAMETERS
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#181818] p-3.5 rounded-sm border border-[#2B2B2B]">
          {/* Temperature Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-300 font-medium">Temperature</span>
              <span className="font-mono text-purple-300 font-bold">{config.temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={config.temperature}
              onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <span className="text-[10px] text-zinc-500 block">
              Lower values (0.1–0.3) provide deterministic structured code generation.
            </span>
          </div>

          {/* Max Tokens Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-300 font-medium">Max Tokens</span>
              <span className="font-mono text-sky-300 font-bold">{config.max_tokens}</span>
            </div>
            <input
              type="range"
              min="500"
              max="8192"
              step="100"
              value={config.max_tokens}
              onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <span className="text-[10px] text-zinc-500 block">
              Maximum token limit allocated per model completion response.
            </span>
          </div>
        </div>
      </div>

      {/* 5. Pull Model via Terminal */}
      <div className="space-y-2">
        <label className="text-[10px] text-[#858585] uppercase tracking-wider block font-mono">
          DOWNLOAD NEW MODEL
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={pullModelName}
            onChange={(e) => setPullModelName(e.target.value)}
            placeholder="e.g., llama3.1:8b, codellama:13b, qwen2.5-coder:7b"
            className="flex-1 bg-[#181818] border border-[#2B2B2B] rounded px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#007ACC]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePullModel();
            }}
          />
          <button
            type="button"
            disabled={!pullModelName.trim()}
            onClick={handlePullModel}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Download size={13} />
            <span>Pull Model</span>
          </button>
        </div>
        <p className="text-[10px] text-zinc-500">
          Runs <span className="font-mono text-zinc-400">ollama pull &lt;model&gt;</span> in the integrated terminal to stream download progress.
        </p>
      </div>

      {/* 6. Save Configuration Button */}
      <div className="pt-3 border-t border-[#2B2B2B] flex items-center justify-between">
        <span className="text-[11px] text-zinc-500 font-mono">
          {projectId ? 'Configuration saves to project config.json' : 'Open a project to persist configuration'}
        </span>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <CheckCircle2 size={13} />
              <span>Saved!</span>
            </span>
          )}
          <button
            type="button"
            disabled={saving || !projectId}
            onClick={handleSave}
            className="px-4 py-1.5 rounded bg-[#007ACC] hover:bg-[#0062a3] text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    </div>
  );
};
