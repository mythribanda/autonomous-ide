import React, { useState } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { AutonomyLevel } from '../../types';
import {
  Sparkles,
  Send,
  Paperclip,
  Sliders,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Check,
  CheckSquare,
  Square,
  Edit3,
  Bot,
  ArrowRight,
  HelpCircle,
  Layers,
  X
} from 'lucide-react';
import { Badge } from '../common/Badge';

export type ComposerState =
  | 'idle'
  | 'typing'
  | 'analyzing'
  | 'compiled'
  | 'needs_clarification'
  | 'ambiguous'
  | 'executing';

export interface InlineSpecification {
  title: string;
  intent: string;
  affectedAreas: string[];
  requirements: string[];
  acceptanceCriteria: { id: string; text: string; completed: boolean }[];
  assumptions: string[];
  confidence: number;
  missingInformation?: string[];
  suggestedPrompt?: string;
  isVague?: boolean;
}

export const InlinePromptComposer: React.FC = () => {
  const { currentTask, startNewTask, setAutonomyLevel } = useAgentStore();
  const { addToast } = useUIStore();

  const [inputText, setInputText] = useState('');
  const [composerState, setComposerState] = useState<ComposerState>('idle');
  const [showAutonomyDropdown, setShowAutonomyDropdown] = useState(false);
  const [isEditingSpec, setIsEditingSpec] = useState(false);
  const [compiledSpec, setCompiledSpec] = useState<InlineSpecification | null>(null);

  const autonomyLabels: Record<AutonomyLevel, { label: string; desc: string; color: 'cyan' | 'emerald' | 'amber' }> = {
    autonomous: { label: 'Autonomous', desc: 'Auto-executes code & tests within boundary', color: 'cyan' },
    guided: { label: 'Guided', desc: 'Asks approval before write operations', color: 'emerald' },
    assist: { label: 'Assist', desc: 'Suggests changes, developer triggers execution', color: 'amber' }
  };

  const currentAutonomy = autonomyLabels[currentTask.autonomyLevel];

  // Handle typing input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (composerState === 'compiled' || composerState === 'needs_clarification' || composerState === 'ambiguous') {
      // If user starts modifying after compile
      setComposerState('typing');
      setCompiledSpec(null);
    } else if (val.trim()) {
      setComposerState('typing');
    } else {
      setComposerState('idle');
    }
  };

  // Compile prompt in place
  const handleCompile = async () => {
    const raw = inputText.trim();
    if (!raw) return;

    setComposerState('analyzing');

    // Simulate smart AST & NLP compilation
    await new Promise((r) => setTimeout(r, 650));

    const lower = raw.toLowerCase();

    // Check if the request is vague (State 5: Vague Request Handling)
    const isVague =
      lower === 'make the app better' ||
      lower === 'improve app' ||
      lower === 'fix it' ||
      lower === 'make it better' ||
      lower === 'clean code' ||
      lower.length < 12;

    if (isVague) {
      setCompiledSpec({
        title: raw,
        intent: 'General optimization / quality improvement request',
        affectedAreas: ['Whole codebase / unknown'],
        requirements: ['Undefined scope'],
        acceptanceCriteria: [],
        assumptions: [],
        confidence: 34,
        isVague: true,
        missingInformation: [
          'What specific component or subsystem of the application?',
          'What should be improved? UI, functionality, performance, or code quality?',
          'Are there performance thresholds or layout guidelines?'
        ],
        suggestedPrompt: 'Improve the dashboard UI and reduce loading time.'
      });
      setComposerState('needs_clarification');
      return;
    }

    // Check if the request is ambiguous (State 6: Ambiguous / Assumptions)
    const isAmbiguous =
      lower.includes('auth') ||
      lower.includes('login') ||
      lower.includes('user management');

    if (isAmbiguous && !lower.includes('dark mode') && !lower.includes('theme')) {
      setCompiledSpec({
        title: raw,
        intent: 'Add authentication and session management to the application',
        affectedAreas: [
          'backend/routers/auth.py',
          'backend/services/user_service.py',
          'frontend/src/services/authService.ts',
          'frontend/src/pages/Login.tsx'
        ],
        requirements: [
          'Add JWT session token generation and verification',
          'Implement secure login endpoint with password hashing',
          'Persist auth credentials in browser local storage',
          'Protect academic simulation routes from unauthenticated users'
        ],
        acceptanceCriteria: [
          { id: 'ac-1', text: 'Valid credentials return JWT token and 200 OK', completed: true },
          { id: 'ac-2', text: 'Invalid credentials return 401 Unauthorized', completed: true },
          { id: 'ac-3', text: 'Auth state persists across browser page reloads', completed: false }
        ],
        assumptions: [
          'Authentication will use the existing FastAPI backend',
          'Existing user model and schema in database will be reused',
          'Login and session revocation endpoints will be included'
        ],
        confidence: 84
      });
      setComposerState('ambiguous');
      return;
    }

    // Standard high-confidence compiled specification (State 4: Compiled)
    setCompiledSpec({
      title: raw,
      intent: `Modify the EduSim codebase to implement "${raw}".`,
      affectedAreas: [
        'Dashboard components (Dashboard.tsx, Header.tsx)',
        'Theme configuration and Zustand store (theme.ts)',
        'Global styling and Tailwind utility classes'
      ],
      requirements: [
        'Add application-wide dark mode',
        'Add theme toggle component with icon indicators',
        'Persist user preference in local storage'
      ],
      acceptanceCriteria: [
        { id: 'ac-1', text: 'Theme switches instantly without page reload', completed: true },
        { id: 'ac-2', text: 'Theme preference persists across browser restarts', completed: true },
        { id: 'ac-3', text: 'Color contrast complies with developer UI standards', completed: true }
      ],
      assumptions: [
        'Existing dashboard uses centralized Zustand theme store',
        'Tailwind dark class variant is enabled on HTML root element'
      ],
      confidence: 92
    });
    setComposerState('compiled');
  };

  // Run compiled specification with the Autonomous Agent
  const handleRunAgent = () => {
    const taskTitle = compiledSpec?.title || inputText.trim() || 'Custom Autonomous Task';
    setComposerState('executing');

    setTimeout(() => {
      startNewTask(taskTitle);
      addToast({
        type: 'success',
        title: 'Agent Executing Specification',
        message: `Autonomous workflow launched for "${taskTitle}".`
      });
      setInputText('');
      setCompiledSpec(null);
      setComposerState('idle');
      setIsEditingSpec(false);
    }, 450);
  };

  const handleDirectSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleRunAgent();
  };

  const handleUseSuggestion = (suggested: string) => {
    setInputText(suggested);
    setTimeout(() => {
      setCompiledSpec({
        title: suggested,
        intent: 'Improve dashboard layout aesthetics and optimize simulation load times.',
        affectedAreas: [
          'frontend/src/pages/Dashboard.tsx',
          'frontend/src/services/courseService.ts',
          'frontend/src/components/Header.tsx'
        ],
        requirements: [
          'Optimize card rendering and state synchronization',
          'Refactor dashboard metrics layout to modern compact density',
          'Reduce bundle size and remove redundant effect hooks'
        ],
        acceptanceCriteria: [
          { id: 'ac-1', text: 'Dashboard initial render under 200ms', completed: true },
          { id: 'ac-2', text: 'All 4 metric cards update asynchronously without layout shift', completed: true }
        ],
        assumptions: [
          'Existing backend courseService REST API remains unchanged'
        ],
        confidence: 90
      });
      setComposerState('compiled');
    }, 100);
  };

  return (
    <div className="border-t border-[#2B2B2B] bg-[#181818] p-2.5 font-sans text-xs select-none">
      {/* Container with smooth transition */}
      <div className="rounded-sm border border-[#2B2B2B] bg-[#1E1E1E] focus-within:border-[#007ACC] transition-all duration-200 overflow-hidden shadow-sm">
        {/* Expanded Specification View (States 4, 5, 6) */}
        {compiledSpec && (composerState === 'compiled' || composerState === 'ambiguous' || composerState === 'needs_clarification') && (
          <div className="p-3 border-b border-[#2B2B2B] bg-[#181818] space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Spec Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-[#2B2B2B]">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#007ACC]" />
                <span className="text-[11px] font-bold text-[#FFFFFF] uppercase tracking-wider font-mono">
                  {composerState === 'needs_clarification' ? 'CLARIFICATION REQUIRED' : 'ENGINEERING SPECIFICATION'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#858585]">Confidence</span>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    compiledSpec.confidence >= 80 ? 'text-[#89D185]' : 'text-[#CCA700]'
                  }`}
                >
                  {compiledSpec.confidence}%
                </span>
                <button
                  onClick={() => {
                    setCompiledSpec(null);
                    setComposerState(inputText ? 'typing' : 'idle');
                  }}
                  className="p-0.5 rounded-sm text-[#858585] hover:text-[#FFFFFF] hover:bg-[#2A2D2E]"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Vague Request Handling Content */}
            {composerState === 'needs_clarification' && compiledSpec.isVague && (
              <div className="space-y-2.5">
                <div className="p-2 rounded-sm bg-[#CCA700]/10 border border-[#CCA700]/30 text-[#CCA700] text-xs flex items-start gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Requirement needs clarification</div>
                    <div className="text-[11px] text-[#CCCCCC] mt-0.5">
                      The prompt is too ambiguous for deterministic autonomous execution without assumptions.
                    </div>
                  </div>
                </div>

                {compiledSpec.missingInformation && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-[#858585] uppercase tracking-wider">
                      Missing Information:
                    </span>
                    <ul className="space-y-1 text-xs text-[#CCCCCC] pl-1">
                      {compiledSpec.missingInformation.map((miss, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-[#CCA700]">•</span>
                          <span>{miss}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {compiledSpec.suggestedPrompt && (
                  <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1.5">
                    <span className="text-[10px] font-mono text-[#858585] uppercase tracking-wider">
                      Suggested Requirement:
                    </span>
                    <div className="text-xs text-[#FFFFFF] font-mono">
                      "{compiledSpec.suggestedPrompt}"
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleUseSuggestion(compiledSpec.suggestedPrompt!)}
                        className="px-3 py-1 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] text-[#FFFFFF] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Check size={12} />
                        <span>Use Suggestion</span>
                      </button>
                      <button
                        onClick={() => {
                          setCompiledSpec(null);
                          setComposerState('typing');
                        }}
                        className="px-2.5 py-1 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#CCCCCC] text-xs border border-[#2B2B2B] transition-colors"
                      >
                        Clarify
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Standard Compiled Specification Content */}
            {composerState !== 'needs_clarification' && (
              <div className="space-y-2.5 text-xs max-h-80 overflow-y-auto pr-1">
                {/* Intent */}
                <div>
                  <span className="text-[10px] font-mono text-[#858585] uppercase tracking-wider block mb-0.5">
                    Intent
                  </span>
                  <p className="text-[#CCCCCC] leading-relaxed">{compiledSpec.intent}</p>
                </div>

                {/* Affected Areas */}
                <div>
                  <span className="text-[10px] font-mono text-[#858585] uppercase tracking-wider block mb-0.5">
                    Affected Areas
                  </span>
                  <ul className="space-y-0.5 text-[#CCCCCC] font-mono text-[11px]">
                    {compiledSpec.affectedAreas.map((area, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#007ACC]">•</span>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Requirements */}
                <div>
                  <span className="text-[10px] font-mono text-[#858585] uppercase tracking-wider block mb-0.5">
                    Requirements
                  </span>
                  <ul className="space-y-1 text-[#CCCCCC]">
                    {compiledSpec.requirements.map((req, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#89D185] font-bold">✓</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Acceptance Criteria */}
                {compiledSpec.acceptanceCriteria.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono text-[#858585] uppercase tracking-wider block mb-0.5">
                      Acceptance Criteria
                    </span>
                    <ul className="space-y-1 text-[#CCCCCC]">
                      {compiledSpec.acceptanceCriteria.map((ac) => (
                        <li key={ac.id} className="flex items-start gap-1.5">
                          <span className="text-[#89D185] font-bold">✓</span>
                          <span>{ac.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Assumptions (Ambiguity state highlight) */}
                {compiledSpec.assumptions.length > 0 && (
                  <div className="p-2 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1">
                    <span className="text-[10px] font-mono text-[#CCA700] uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle size={11} /> Assumptions
                    </span>
                    <ul className="space-y-0.5 text-[11px] text-[#CCCCCC]">
                      {compiledSpec.assumptions.map((assump, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-[#CCA700]">•</span>
                          <span>{assump}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bottom Spec Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-[#2B2B2B]">
                  <button
                    type="button"
                    onClick={() => setIsEditingSpec(!isEditingSpec)}
                    className="px-2.5 py-1 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#CCCCCC] text-xs font-mono flex items-center gap-1.5 border border-[#2B2B2B] transition-colors"
                  >
                    <Edit3 size={12} />
                    <span>Edit Specification</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRunAgent}
                    className="px-4 py-1.5 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] text-[#FFFFFF] font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Bot size={13} />
                    <span>Run Agent →</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inline Analyzing State Banner (State 3) */}
        {composerState === 'analyzing' && (
          <div className="px-3 py-2 bg-[#181818] border-b border-[#2B2B2B] flex items-center gap-2 text-xs font-mono text-[#007ACC] animate-pulse">
            <Loader2 size={13} className="animate-spin" />
            <span>● Understanding requirement & generating specification...</span>
          </div>
        )}

        {/* Executing State Banner (State 7) */}
        {composerState === 'executing' && (
          <div className="px-3 py-2 bg-[#181818] border-b border-[#2B2B2B] flex items-center gap-2 text-xs font-mono text-[#89D185]">
            <Loader2 size={13} className="animate-spin text-[#89D185]" />
            <span>⚡ Agent executing specification...</span>
          </div>
        )}

        {/* Text Input Row */}
        <textarea
          rows={composerState === 'compiled' ? 1 : 2}
          value={inputText}
          onChange={handleInputChange}
          placeholder="What should I build or change?"
          className="w-full p-2.5 bg-transparent text-xs text-[#FFFFFF] placeholder-[#858585] focus:outline-none resize-none font-sans"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleDirectSend(e);
            }
          }}
        />

        {/* Bottom Toolbar Row */}
        <div className="px-2.5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Attach Context */}
            <button
              type="button"
              onClick={() =>
                addToast({
                  type: 'info',
                  title: 'Context Attached',
                  message: 'Attached open files and workspace AST tree.'
                })
              }
              className="p-1 rounded-sm text-[#858585] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors flex items-center gap-1 text-[11px]"
              title="Attach open files and context"
            >
              <Paperclip size={12} />
              <span className="text-[10px] font-mono">Attach</span>
            </button>

            {/* Autonomy Level Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAutonomyDropdown(!showAutonomyDropdown)}
                className="px-2 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] text-[10px] font-mono flex items-center gap-1 transition-colors"
              >
                <Sliders size={10} className="text-[#007ACC]" />
                <span>{currentAutonomy.label}</span>
                <ChevronDown size={10} className="text-[#858585]" />
              </button>

              {showAutonomyDropdown && (
                <div
                  className="absolute bottom-full mb-1 left-0 w-52 bg-[#1E1E1E] border border-[#2B2B2B] rounded-sm shadow-2xl py-1 z-50 text-xs font-sans"
                  onMouseLeave={() => setShowAutonomyDropdown(false)}
                >
                  <div className="px-2.5 py-1 text-[9px] font-mono text-[#858585] uppercase">
                    Autonomy Boundary
                  </div>
                  {(['autonomous', 'guided', 'assist'] as AutonomyLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        setAutonomyLevel(lvl);
                        setShowAutonomyDropdown(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 hover:bg-[#2A2D2E] transition-colors flex flex-col ${
                        currentTask.autonomyLevel === lvl ? 'bg-[#264F78]' : ''
                      }`}
                    >
                      <span className="font-semibold text-[11px] text-[#FFFFFF] capitalize">
                        {lvl}
                      </span>
                      <span className="text-[10px] text-[#CCCCCC]">
                        {autonomyLabels[lvl].desc}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Inline Compile Button (Appears when text is typed) */}
            {inputText.trim() && composerState !== 'compiled' && (
              <button
                type="button"
                onClick={handleCompile}
                disabled={composerState === 'analyzing'}
                className="px-2.5 py-1 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#3794FF] text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Sparkles size={12} className="text-[#007ACC]" />
                <span>Compile</span>
              </button>
            )}

            {/* Send Button */}
            <button
              type="button"
              onClick={handleDirectSend}
              disabled={!inputText.trim()}
              className="px-3 py-1 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] text-[#FFFFFF] font-semibold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>Send</span>
              <Send size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
