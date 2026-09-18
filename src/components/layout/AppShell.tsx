import React from 'react';
import { useUIStore } from '../../stores/uiStore';
import { TopBar } from './TopBar';
import { ActivityBar } from './ActivityBar';
import { StatusBar } from './StatusBar';
import { ResizablePanel } from './ResizablePanel';
import { Explorer } from '../explorer/Explorer';
import { EditorArea } from '../editor/EditorArea';
import { AgentPanel } from '../agent/AgentPanel';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { ProjectIntelligenceView } from '../ProjectIntelligence';
import { ImpactAnalysisView } from '../impact/ImpactAnalysisView';
import { VerificationView } from '../verification/VerificationView';
import { RecoveryTimelineView } from '../recovery/RecoveryTimelineView';
import { GitView } from '../git/GitView';
import { SecurityView } from '../security/SecurityView';
import { WelcomeScreen } from '../welcome/WelcomeScreen';
import { SettingsModal } from '../settings/SettingsModal';
import { CommandPalette } from '../common/CommandPalette';
import { ToastContainer } from '../common/Toast';
import { PromptBar } from '../PromptBar/PromptBar';

export const AppShell: React.FC = () => {
  const {
    activeView,
    isAgentPanelOpen,
    explorerWidth,
    setExplorerWidth,
    agentPanelWidth,
    setAgentPanelWidth
  } = useUIStore();

  const renderMainContent = () => {
    switch (activeView) {
      case 'home':
        return <WelcomeScreen />;
      case 'intelligence':
        return <ProjectIntelligenceView />;
      case 'impact':
        return <ImpactAnalysisView />;
      case 'verification':
        return <VerificationView />;
      case 'recovery':
        return <RecoveryTimelineView />;
      case 'git':
        return <GitView />;
      case 'security':
        return <SecurityView />;
      case 'explorer':
      default:
        return <EditorArea />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#1E1E1E] text-[#CCCCCC] font-sans antialiased">
      {/* 1. Top Header Bar */}
      <TopBar />

      {/* Main Workspace Area (Activity Bar + Left Sidebar + Main Content + Right Agent Panel) */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0">
        {/* 2. Left Activity Bar */}
        <ActivityBar />

        {/* 3. Left File Explorer (Shown when in 'explorer' view) */}
        {activeView === 'explorer' && (
          <ResizablePanel
            direction="horizontal"
            position="left"
            initialSize={explorerWidth}
            minSize={180}
            maxSize={450}
            onResize={setExplorerWidth}
          >
            <Explorer />
          </ResizablePanel>
        )}

        {/* 4. Center Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#1E1E1E]">
          {/* Prompt Bar & Inline Compiler Panel */}
          <PromptBar />

          <div className="flex-1 flex overflow-hidden min-h-0">
            {renderMainContent()}
          </div>

          {/* 6. Bottom Terminal / Output Panel */}
          <TerminalPanel />
        </div>

        {/* 5. Right AI Agent Panel */}
        {isAgentPanelOpen && (
          <ResizablePanel
            direction="horizontal"
            position="right"
            initialSize={agentPanelWidth}
            minSize={280}
            maxSize={600}
            onResize={setAgentPanelWidth}
          >
            <AgentPanel />
          </ResizablePanel>
        )}
      </div>

      {/* 7. Bottom Status Bar */}
      <StatusBar />

      {/* Global Modals & Overlays */}
      <CommandPalette />
      <SettingsModal />
      <ToastContainer />
    </div>
  );
};
