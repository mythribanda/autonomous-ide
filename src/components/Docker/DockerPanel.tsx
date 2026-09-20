import React, { useState, useEffect, useRef } from 'react';
import {
  Boxes,
  Container,
  Play,
  Square,
  RefreshCw,
  Terminal,
  FileCode2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Layers,
  Save,
  X,
  Copy,
  Check,
  ChevronRight,
  Activity,
  Server
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../stores/uiStore';
import {
  getDockerConfig,
  generateDockerfile,
  generateCompose,
  saveDockerFile,
  buildDockerImage,
  startDockerContainer,
  stopDockerContainer,
  getDockerLogs,
  getDockerContainers,
  ApiError
} from '../../lib/api';
import {
  DockerConfig,
  BuildResult,
  ContainerResult,
  ContainerInfo
} from '../../types/api';

export const DockerPanel: React.FC = () => {
  const { projectId, currentProject, projectPath } = useProjectStore();
  const { addToast } = useUIStore();

  // State
  const [config, setConfig] = useState<DockerConfig>({
    has_dockerfile: false,
    has_compose: false,
    compose_services: [],
    dockerfile_base_image: null,
    is_daemon_running: false
  });
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loadingConfig, setLoadingConfig] = useState<boolean>(false);
  const [loadingContainers, setLoadingContainers] = useState<boolean>(false);

  // Generation Modal State
  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    title: string;
    filename: string;
    content: string;
    isGenerating: boolean;
  }>({
    open: false,
    title: '',
    filename: 'Dockerfile',
    content: '',
    isGenerating: false
  });
  const [savingFile, setSavingFile] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Build State
  const [buildTag, setBuildTag] = useState<string>('app:latest');
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const buildTerminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Run Container Form State
  const [runImageTag, setRunImageTag] = useState<string>('');
  const [runHostPort, setRunHostPort] = useState<string>('3000');
  const [runContainerPort, setRunContainerPort] = useState<string>('3000');
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Container Logs Modal
  const [logsModal, setLogsModal] = useState<{
    open: boolean;
    containerId: string;
    containerName: string;
    logs: string;
    loading: boolean;
    tail: number;
    autoRefresh: boolean;
  }>({
    open: false,
    containerId: '',
    containerName: '',
    logs: '',
    loading: false,
    tail: 100,
    autoRefresh: false
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch Docker Config
  const loadConfig = async () => {
    if (!projectId) return;
    setLoadingConfig(true);
    try {
      const data = await getDockerConfig(projectId);
      setConfig(data);
    } catch (err: any) {
      console.error('Failed to load docker config', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Fetch Running Containers
  const loadContainers = async () => {
    if (!projectId) return;
    setLoadingContainers(true);
    try {
      const list = await getDockerContainers(projectId);
      setContainers(list);
    } catch (err: any) {
      console.error('Failed to fetch containers', err);
    } finally {
      setLoadingContainers(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadConfig();
      loadContainers();
      const projName = (typeof currentProject === 'string' && currentProject.trim())
        ? currentProject.toLowerCase().replace(/\s+/g, '-')
        : 'app';
      setBuildTag(`${projName}:latest`);
      setRunImageTag(`${projName}:latest`);
    }
  }, [projectId]);

  // WebSocket for real-time build streaming
  useEffect(() => {
    if (!projectId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:8000';
    const wsUrl = `${protocol}//${host}/ws/docker/build/${projectId}`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'build_log' && payload.data) {
            setBuildLogs((prev) => [...prev, payload.data]);
            if (buildTerminalRef.current) {
              buildTerminalRef.current.scrollTop = buildTerminalRef.current.scrollHeight;
            }
          } else if (payload.type === 'build_complete' && payload.result) {
            setBuildResult(payload.result);
          }
        } catch {
          // ignore non-json
        }
      };

      socket.onerror = (e) => {
        console.debug('Docker build WS disconnected or not reachable:', e);
      };

      return () => {
        socket.close();
      };
    } catch (e) {
      console.debug('WS init error', e);
    }
  }, [projectId]);

  // Handle Generate Dockerfile
  const handleGenerateDockerfile = async () => {
    if (!projectId) return;
    setPreviewModal({
      open: true,
      title: 'Generate Production Dockerfile',
      filename: 'Dockerfile',
      content: '',
      isGenerating: true
    });

    try {
      const res = await generateDockerfile(projectId);
      setPreviewModal((prev) => ({
        ...prev,
        content: res.dockerfile,
        isGenerating: false
      }));
    } catch (err: any) {
      setPreviewModal((prev) => ({
        ...prev,
        content: `# Failed to generate Dockerfile: ${err?.message || 'Error'}`,
        isGenerating: false
      }));
      addToast({
        type: 'error',
        title: 'Dockerfile Generation Failed',
        message: err?.message || 'Unable to generate Dockerfile'
      });
    }
  };

  // Handle Generate Compose
  const handleGenerateCompose = async () => {
    if (!projectId) return;
    setPreviewModal({
      open: true,
      title: 'Generate docker-compose.yml',
      filename: 'docker-compose.yml',
      content: '',
      isGenerating: true
    });

    try {
      const res = await generateCompose(projectId);
      setPreviewModal((prev) => ({
        ...prev,
        content: res.compose_yaml,
        isGenerating: false
      }));
    } catch (err: any) {
      setPreviewModal((prev) => ({
        ...prev,
        content: `# Failed to generate compose: ${err?.message || 'Error'}`,
        isGenerating: false
      }));
      addToast({
        type: 'error',
        title: 'Compose Generation Failed',
        message: err?.message || 'Unable to generate compose specification'
      });
    }
  };

  // Save Generated File
  const handleSaveFile = async () => {
    if (!projectId || !previewModal.content) return;
    setSavingFile(true);
    try {
      await saveDockerFile(projectId, previewModal.filename, previewModal.content);
      addToast({
        type: 'success',
        title: 'File Saved',
        message: `Successfully created ${previewModal.filename} in workspace.`
      });
      setPreviewModal((prev) => ({ ...prev, open: false }));
      loadConfig();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: err?.message || 'Could not save file to disk'
      });
    } finally {
      setSavingFile(false);
    }
  };

  // Build Docker Image
  const handleBuildImage = async () => {
    if (!projectId || isBuilding) return;
    setIsBuilding(true);
    setBuildLogs([`Starting build for tag: ${buildTag}...\n`]);
    setBuildResult(null);

    try {
      const result = await buildDockerImage(projectId, buildTag);
      setBuildResult(result);
      if (result.success) {
        addToast({
          type: 'success',
          title: 'Docker Image Built',
          message: `Successfully built ${result.tag} in ${result.build_time_seconds}s`
        });
      } else {
        addToast({
          type: 'error',
          title: 'Build Failed',
          message: result.error || 'Docker image build failed'
        });
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Build execution failed';
      setBuildLogs((prev) => [...prev, `\n[FATAL ERROR]: ${errorMsg}\n`]);
      setBuildResult({
        success: false,
        tag: buildTag,
        build_time_seconds: 0,
        error: errorMsg
      });
      addToast({
        type: 'error',
        title: 'Build Error',
        message: errorMsg
      });
    } finally {
      setIsBuilding(false);
      loadContainers();
    }
  };

  // Quick Run Container
  const handleStartContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !runImageTag.trim() || isStarting) return;

    setIsStarting(true);
    try {
      const ports: Record<string, string> = {};
      if (runHostPort.trim() && runContainerPort.trim()) {
        ports[runHostPort.trim()] = runContainerPort.trim();
      }

      const res = await startDockerContainer(projectId, runImageTag.trim(), ports);
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Container Started',
          message: `Container ${res.container_name || res.container_id} is running.`
        });
        loadContainers();
      } else {
        addToast({
          type: 'error',
          title: 'Failed to Start Container',
          message: res.error || 'Check port collisions or image availability.'
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Execution Error',
        message: err?.message || 'Could not launch container'
      });
    } finally {
      setIsStarting(false);
    }
  };

  // Stop Container
  const handleStopContainer = async (containerId: string) => {
    if (!projectId) return;
    try {
      await stopDockerContainer(projectId, containerId);
      addToast({
        type: 'info',
        title: 'Container Stopped',
        message: `Container ${containerId} has been stopped.`
      });
      loadContainers();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Stop Failed',
        message: err?.message || 'Unable to stop container'
      });
    }
  };

  // View Logs
  const handleOpenLogs = async (containerId: string, containerName: string) => {
    setLogsModal({
      open: true,
      containerId,
      containerName,
      logs: 'Loading container logs...',
      loading: true,
      tail: 100,
      autoRefresh: false
    });

    try {
      const res = await getDockerLogs(projectId!, containerId, 100);
      setLogsModal((prev) => ({
        ...prev,
        logs: res.logs || '(No log output available)',
        loading: false
      }));
    } catch (err: any) {
      setLogsModal((prev) => ({
        ...prev,
        logs: `Error fetching logs: ${err?.message || 'Unknown error'}`,
        loading: false
      }));
    }
  };

  // Refresh Logs
  const handleRefreshLogs = async () => {
    if (!projectId || !logsModal.containerId) return;
    try {
      const res = await getDockerLogs(projectId, logsModal.containerId, logsModal.tail);
      setLogsModal((prev) => ({
        ...prev,
        logs: res.logs || '(No log output available)'
      }));
    } catch (err: any) {
      console.error('Failed to refresh logs', err);
    }
  };

  // Auto-refresh interval for logs
  useEffect(() => {
    let interval: any = null;
    if (logsModal.open && logsModal.autoRefresh && logsModal.containerId) {
      interval = setInterval(() => {
        handleRefreshLogs();
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [logsModal.open, logsModal.autoRefresh, logsModal.containerId, logsModal.tail]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#181818] flex flex-col font-sans select-none text-xs">
      {/* Top Action & Status Bar */}
      <div className="p-4 border-b border-[#2B2B2B] bg-[#1E1E1E] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#007ACC]/20 border border-[#007ACC]/50 flex items-center justify-center text-[#007ACC] shadow-sm">
            <Container size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-100 font-mono tracking-wide">
                DOCKER & CONTAINERS
              </h2>
              {config.is_daemon_running ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-950 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Daemon Active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-950 text-amber-300 border border-amber-700/60 flex items-center gap-1">
                  <AlertTriangle size={10} />
                  Daemon Offline
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Automated containerization, multi-stage image builds, and runtime lifecycle orchestration.
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateDockerfile}
            disabled={loadingConfig}
            className="px-3 py-1.5 rounded bg-[#252526] hover:bg-[#2e2e30] text-zinc-200 border border-[#3c3c3c] font-medium flex items-center gap-1.5 shadow-sm transition-colors text-xs"
          >
            <FileCode2 size={13} className="text-[#007ACC]" />
            <span>Generate Dockerfile</span>
          </button>

          <button
            onClick={handleGenerateCompose}
            disabled={loadingConfig}
            className="px-3 py-1.5 rounded bg-[#252526] hover:bg-[#2e2e30] text-zinc-200 border border-[#3c3c3c] font-medium flex items-center gap-1.5 shadow-sm transition-colors text-xs"
          >
            <Layers size={13} className="text-emerald-400" />
            <span>Generate Compose</span>
          </button>

          <button
            onClick={() => {
              loadConfig();
              loadContainers();
            }}
            className="p-1.5 rounded bg-[#252526] hover:bg-[#2e2e30] text-zinc-300 border border-[#3c3c3c] transition-colors"
            title="Refresh Status"
          >
            <RefreshCw size={13} className={loadingConfig || loadingContainers ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Daemon Warning Notice if stopped */}
      {!config.is_daemon_running && (
        <div className="mx-5 mt-4 p-3 bg-amber-950/40 border border-amber-800/60 rounded-md text-amber-200 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-xs text-amber-100">Docker Daemon is Not Running</span>
            <p className="text-[11px] text-amber-300/80">
              Start Docker Desktop or your local docker service to enable image builds, container deployments, and log streaming. You can still generate and review Dockerfiles without the daemon.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="p-5 space-y-5">
        {/* Status Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Dockerfile */}
          <div className="p-3.5 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Dockerfile</span>
              <div className="flex items-center gap-1.5">
                {config.has_dockerfile ? (
                  <>
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    <span className="font-mono text-xs font-semibold text-zinc-100">Configured</span>
                  </>
                ) : (
                  <>
                    <XCircle size={15} className="text-zinc-500" />
                    <span className="font-mono text-xs text-zinc-400">Missing</span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-zinc-500 block truncate max-w-[150px]">
                {config.dockerfile_base_image ? `Base: ${config.dockerfile_base_image}` : 'No base image'}
              </span>
            </div>
            <FileCode2 size={24} className={config.has_dockerfile ? 'text-emerald-400/30' : 'text-zinc-700'} />
          </div>

          {/* Card 2: Docker Compose */}
          <div className="p-3.5 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Compose Services</span>
              <div className="flex items-center gap-1.5">
                {config.has_compose ? (
                  <>
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    <span className="font-mono text-xs font-semibold text-zinc-100">
                      {config.compose_services.length} {config.compose_services.length === 1 ? 'Service' : 'Services'}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle size={15} className="text-zinc-500" />
                    <span className="font-mono text-xs text-zinc-400">Missing</span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-zinc-500 block truncate max-w-[150px]">
                {config.compose_services.length > 0 ? config.compose_services.join(', ') : 'No compose file'}
              </span>
            </div>
            <Layers size={24} className={config.has_compose ? 'text-emerald-400/30' : 'text-zinc-700'} />
          </div>

          {/* Card 3: Running Containers */}
          <div className="p-3.5 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Active Containers</span>
              <div className="flex items-center gap-1.5">
                <Activity size={15} className={containers.length > 0 ? 'text-[#007ACC]' : 'text-zinc-500'} />
                <span className="font-mono text-xs font-semibold text-zinc-100">
                  {containers.length} Running
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 block">
                Local daemon containers
              </span>
            </div>
            <Container size={24} className={containers.length > 0 ? 'text-[#007ACC]/30' : 'text-zinc-700'} />
          </div>

          {/* Card 4: Daemon Engine */}
          <div className="p-3.5 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Engine Engine</span>
              <div className="flex items-center gap-1.5">
                <Server size={15} className={config.is_daemon_running ? 'text-emerald-400' : 'text-amber-400'} />
                <span className="font-mono text-xs font-semibold text-zinc-100">
                  {config.is_daemon_running ? 'Online' : 'Stopped'}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 block">
                Docker Desktop v29+
              </span>
            </div>
            <Boxes size={24} className={config.is_daemon_running ? 'text-emerald-400/30' : 'text-zinc-700'} />
          </div>
        </div>

        {/* Section: Image Builder & Quick Run */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Builder Card (2 cols) */}
          <div className="lg:col-span-2 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-[#2B2B2B] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-[#007ACC]" />
                <h3 className="text-xs font-semibold text-zinc-200 font-mono uppercase tracking-wider">
                  BUILD DOCKER IMAGE
                </h3>
              </div>
              {buildResult && (
                <div className="flex items-center gap-1.5">
                  {buildResult.success ? (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                      ✓ Built in {buildResult.build_time_seconds}s
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
                      ✗ Build Failed
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Build Controls */}
            <div className="p-3.5 bg-[#252526]/50 border-b border-[#2B2B2B] flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="text-[11px] text-zinc-400 font-mono">Tag:</span>
                <input
                  type="text"
                  value={buildTag}
                  onChange={(e) => setBuildTag(e.target.value)}
                  placeholder="app:latest"
                  className="flex-1 bg-[#181818] border border-[#3c3c3c] rounded px-2.5 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#007ACC]"
                />
              </div>

              <button
                onClick={handleBuildImage}
                disabled={isBuilding || !config.is_daemon_running}
                className="px-4 py-1.5 rounded bg-[#007ACC] hover:bg-[#0062a3] text-white font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 text-xs"
              >
                <Play size={12} className={isBuilding ? 'animate-spin' : 'fill-white'} />
                <span>{isBuilding ? 'Building Image...' : 'Build Image'}</span>
              </button>
            </div>

            {/* Streaming Build Console */}
            <div
              ref={buildTerminalRef}
              className="p-3 font-mono text-[11px] leading-relaxed bg-[#121212] text-zinc-300 min-h-[160px] max-h-[240px] overflow-y-auto space-y-0.5"
            >
              {buildLogs.length === 0 ? (
                <div className="text-zinc-600 italic py-4 text-center">
                  Configure an image tag and click "Build Image" to view live streaming Docker build output.
                </div>
              ) : (
                buildLogs.map((log, idx) => (
                  <div key={idx} className="whitespace-pre-wrap font-mono">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Container Launcher Card (1 col) */}
          <div className="rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] flex flex-col p-4 space-y-3.5">
            <div className="flex items-center gap-2 pb-2 border-b border-[#2B2B2B]">
              <Play size={14} className="text-emerald-400" />
              <h3 className="text-xs font-semibold text-zinc-200 font-mono uppercase tracking-wider">
                QUICK RUN CONTAINER
              </h3>
            </div>

            <form onSubmit={handleStartContainer} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 uppercase font-mono">Image Tag</label>
                <input
                  type="text"
                  value={runImageTag}
                  onChange={(e) => setRunImageTag(e.target.value)}
                  placeholder="app:latest"
                  required
                  className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#007ACC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Host Port</label>
                  <input
                    type="text"
                    value={runHostPort}
                    onChange={(e) => setRunHostPort(e.target.value)}
                    placeholder="3000"
                    className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#007ACC]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Container Port</label>
                  <input
                    type="text"
                    value={runContainerPort}
                    onChange={(e) => setRunContainerPort(e.target.value)}
                    placeholder="3000"
                    className="w-full bg-[#181818] border border-[#3c3c3c] rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#007ACC]"
                  />
                </div>
              </div>

              <p className="text-[10px] text-zinc-500">
                Maps port {runHostPort}:{runContainerPort} in background detached mode.
              </p>

              <button
                type="submit"
                disabled={isStarting || !config.is_daemon_running}
                className="w-full py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 text-xs"
              >
                <Play size={12} className="fill-white" />
                <span>{isStarting ? 'Launching...' : 'Run Container'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Section: Running Containers Table */}
        <div className="rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] overflow-hidden">
          <div className="p-3.5 border-b border-[#2B2B2B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Container size={14} className="text-[#007ACC]" />
              <h3 className="text-xs font-semibold text-zinc-200 font-mono uppercase tracking-wider">
                RUNNING CONTAINERS
              </h3>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#252526] text-zinc-300">
                {containers.length}
              </span>
            </div>

            <button
              onClick={loadContainers}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={11} className={loadingContainers ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {containers.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 flex flex-col items-center gap-2">
              <Container size={32} className="text-zinc-700" />
              <p className="text-xs">No active Docker containers running</p>
              <span className="text-[11px] text-zinc-600">
                Containers launched from the CLI or Quick Run panel will appear here.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#2B2B2B] bg-[#252526]/40 text-zinc-400 text-[10px] uppercase">
                    <th className="py-2.5 px-4">Container Name</th>
                    <th className="py-2.5 px-4">ID</th>
                    <th className="py-2.5 px-4">Image</th>
                    <th className="py-2.5 px-4">Ports</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2B2B2B] text-zinc-300">
                  {containers.map((c) => (
                    <tr key={c.id} className="hover:bg-[#252526]/50 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-zinc-100 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {c.name}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-400 text-[11px]">{c.id}</td>
                      <td className="py-2.5 px-4 text-zinc-300 truncate max-w-[180px]" title={c.image}>
                        {c.image}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-400 text-[11px]">
                        {Object.entries(c.ports).length > 0 ? (
                          Object.entries(c.ports)
                            .map(([k, v]) => `${k} -> ${v}`)
                            .join(', ')
                        ) : (
                          <span className="text-zinc-600">None</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenLogs(c.id, c.name)}
                            className="px-2 py-1 rounded bg-[#252526] hover:bg-[#323233] text-zinc-200 border border-[#3c3c3c] flex items-center gap-1 text-[11px] transition-colors"
                          >
                            <Terminal size={11} className="text-[#007ACC]" />
                            <span>Logs</span>
                          </button>

                          <button
                            onClick={() => handleStopContainer(c.id)}
                            className="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 border border-rose-800/50 flex items-center gap-1 text-[11px] transition-colors"
                          >
                            <Square size={11} className="fill-rose-400 text-rose-400" />
                            <span>Stop</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Code Review / Generation Modal */}
      {previewModal.open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-[#3c3c3c] rounded-lg shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-3.5 border-b border-[#2B2B2B] bg-[#252526] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 size={16} className="text-[#007ACC]" />
                <h3 className="text-xs font-bold text-zinc-100 font-mono uppercase">
                  {previewModal.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewModal((prev) => ({ ...prev, open: false }))}
                className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-[#323233]"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex-1 overflow-y-auto flex flex-col space-y-3">
              {previewModal.isGenerating ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
                  <RefreshCw size={24} className="animate-spin text-[#007ACC]" />
                  <span className="font-mono text-xs">Analyzing project stack and generating multi-stage config...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>
                      Target path:{' '}
                      <code className="text-[#007ACC] font-mono">{previewModal.filename}</code>
                    </span>
                    <button
                      onClick={() => copyToClipboard(previewModal.content)}
                      className="flex items-center gap-1 hover:text-zinc-200 transition-colors"
                    >
                      {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>

                  <textarea
                    value={previewModal.content}
                    onChange={(e) =>
                      setPreviewModal((prev) => ({ ...prev, content: e.target.value }))
                    }
                    className="flex-1 min-h-[300px] bg-[#121212] border border-[#2B2B2B] rounded-md p-3 font-mono text-xs text-zinc-200 focus:outline-none focus:border-[#007ACC] leading-relaxed resize-y"
                  />
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-[#2B2B2B] bg-[#252526] flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">
                You can manually fine-tune the contents before saving to disk.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewModal((prev) => ({ ...prev, open: false }))}
                  className="px-3 py-1.5 rounded bg-[#2B2B2B] hover:bg-[#3c3c3c] text-zinc-300 font-medium text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFile}
                  disabled={savingFile || previewModal.isGenerating}
                  className="px-4 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 text-xs"
                >
                  <Save size={13} />
                  <span>{savingFile ? 'Saving...' : `Save ${previewModal.filename}`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Container Logs Viewer */}
      {logsModal.open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E1E1E] border border-[#3c3c3c] rounded-lg shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Logs Header */}
            <div className="p-3.5 border-b border-[#2B2B2B] bg-[#252526] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-[#007ACC]" />
                <h3 className="text-xs font-bold text-zinc-100 font-mono">
                  Container Logs: <span className="text-[#007ACC]">{logsModal.containerName}</span> ({logsModal.containerId})
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={logsModal.autoRefresh}
                    onChange={(e) =>
                      setLogsModal((prev) => ({ ...prev, autoRefresh: e.target.checked }))
                    }
                    className="rounded border-[#3c3c3c] text-[#007ACC] focus:ring-0"
                  />
                  <span>Live Stream (2s)</span>
                </label>

                <button
                  onClick={handleRefreshLogs}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-[#323233]"
                  title="Refresh Logs"
                >
                  <RefreshCw size={13} className={logsModal.loading ? 'animate-spin' : ''} />
                </button>

                <button
                  onClick={() => setLogsModal((prev) => ({ ...prev, open: false }))}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-[#323233]"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Logs Body */}
            <div className="p-3.5 bg-[#121212] font-mono text-[11px] text-zinc-300 flex-1 overflow-y-auto leading-relaxed whitespace-pre-wrap select-text">
              {logsModal.logs}
              <div ref={logsEndRef} />
            </div>

            {/* Logs Footer */}
            <div className="p-2.5 border-t border-[#2B2B2B] bg-[#252526] flex items-center justify-between text-[11px] text-zinc-400">
              <span>Showing stdout and stderr output</span>
              <button
                onClick={() => copyToClipboard(logsModal.logs)}
                className="flex items-center gap-1 hover:text-zinc-200 transition-colors"
              >
                {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedCode ? 'Copied' : 'Copy All Logs'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
