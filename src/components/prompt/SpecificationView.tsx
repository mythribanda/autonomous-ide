import React from 'react';
import { PromptSpecification } from '../../types';
import { usePromptStore } from '../../stores/promptStore';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { QualityScoreGauge } from './QualityScoreGauge';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Layers,
  CheckSquare,
  Square,
  Edit3,
  MessageSquarePlus,
  Bot
} from 'lucide-react';
import { Badge } from '../common/Badge';

interface SpecificationViewProps {
  spec: PromptSpecification;
}

export const SpecificationView: React.FC<SpecificationViewProps> = ({ spec }) => {
  const { toggleCriteria } = usePromptStore();
  const { startNewTask } = useAgentStore();
  const { setActiveView, addToast } = useUIStore();

  const handleApproveAndPlan = () => {
    startNewTask(spec.title);
    setActiveView('explorer');
    addToast({
      type: 'success',
      title: 'Specification Approved',
      message: `Autonomous Agent initialized with task: "${spec.title}"`
    });
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Top Meta Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="blue" size="sm">
              {spec.intent}
            </Badge>
            <span className="text-[11px] font-mono text-[#858585]">ID: {spec.id}</span>
          </div>
          <h2 className="text-base font-bold text-[#FFFFFF]">{spec.title}</h2>
          <p className="text-xs text-[#858585] mt-0.5 font-mono">Raw: "{spec.rawPrompt}"</p>
        </div>

        <div className="flex-shrink-0">
          <QualityScoreGauge score={spec.qualityScore} />
        </div>
      </div>

      {/* Grid of Requirements & Ambiguities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Detected Requirements */}
        <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2">
          <div className="flex items-center gap-1.5 pb-1 border-b border-[#2B2B2B]">
            <CheckCircle2 size={14} className="text-[#89D185]" />
            <h4 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
              DETECTED REQUIREMENTS
            </h4>
          </div>
          <ul className="space-y-1.5 pt-1">
            {spec.detectedRequirements.map((req, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-[#CCCCCC]">
                <span className="text-[#89D185] mt-0.5">✓</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Ambiguities & Missing Info */}
        <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2">
          <div className="flex items-center gap-1.5 pb-1 border-b border-[#2B2B2B]">
            <AlertTriangle size={14} className="text-[#CCA700]" />
            <h4 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
              AMBIGUITIES & GAPS
            </h4>
          </div>
          <div className="space-y-2 pt-1">
            {spec.ambiguities.map((amb, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-[#CCA700]">
                <span className="mt-0.5">⚠</span>
                <span>{amb}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-[#2B2B2B]">
              <span className="text-[10px] font-mono text-[#858585] font-semibold uppercase">
                Missing Information:
              </span>
              <ul className="mt-1 space-y-1">
                {spec.missingInformation.map((miss, idx) => (
                  <li key={idx} className="text-xs text-[#858585] list-disc list-inside">
                    {miss}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Assumptions */}
      <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2">
        <div className="flex items-center gap-1.5 pb-1 border-b border-[#2B2B2B]">
          <HelpCircle size={14} className="text-[#3794FF]" />
          <h4 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
            ASSUMPTIONS
          </h4>
        </div>
        <ul className="space-y-1 text-xs text-[#CCCCCC] pt-1">
          {spec.assumptions.map((assump, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-[#007ACC] mt-0.5">•</span>
              <span>{assump}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Technical Architecture Plan */}
      <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-3">
        <div className="flex items-center gap-1.5 pb-1 border-b border-[#2B2B2B]">
          <Layers size={14} className="text-[#007ACC]" />
          <h4 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
            TECHNICAL PLAN
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B]">
            <span className="text-[10px] text-[#858585] uppercase">Frontend</span>
            <p className="text-[#FFFFFF] font-medium mt-0.5">{spec.technicalPlan.frontend}</p>
          </div>
          <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B]">
            <span className="text-[10px] text-[#858585] uppercase">Backend</span>
            <p className="text-[#FFFFFF] font-medium mt-0.5">{spec.technicalPlan.backend}</p>
          </div>
          <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B]">
            <span className="text-[10px] text-[#858585] uppercase">Database</span>
            <p className="text-[#FFFFFF] font-medium mt-0.5">{spec.technicalPlan.database}</p>
          </div>
          <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B]">
            <span className="text-[10px] text-[#858585] uppercase">Testing</span>
            <p className="text-[#FFFFFF] font-medium mt-0.5">{spec.technicalPlan.testing}</p>
          </div>
        </div>
      </div>

      {/* Acceptance Criteria Checklist */}
      <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2.5">
        <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
          <div className="flex items-center gap-1.5">
            <CheckSquare size={14} className="text-[#89D185]" />
            <h4 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
              ACCEPTANCE CRITERIA
            </h4>
          </div>
          <span className="text-[11px] font-mono text-[#858585]">
            {spec.acceptanceCriteria.filter((c) => c.completed).length} / {spec.acceptanceCriteria.length} Met
          </span>
        </div>

        <div className="space-y-1.5 pt-1">
          {spec.acceptanceCriteria.map((crit) => (
            <div
              key={crit.id}
              onClick={() => toggleCriteria(crit.id)}
              className={`p-2 rounded-sm border text-xs cursor-pointer flex items-center gap-2.5 transition-colors ${
                crit.completed
                  ? 'bg-[#1E1E1E] border-[#89D185]/40 text-[#FFFFFF]'
                  : 'bg-[#1E1E1E] border-[#2B2B2B] text-[#858585] hover:border-[#3C3C3C]'
              }`}
            >
              {crit.completed ? (
                <CheckSquare size={15} className="text-[#89D185] flex-shrink-0" />
              ) : (
                <Square size={15} className="text-[#858585] flex-shrink-0" />
              )}
              <span className={crit.completed ? 'font-medium' : ''}>{crit.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Footer Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              addToast({
                type: 'info',
                title: 'Editor Mode Enabled',
                message: 'You can now manually tune the compiled requirements.'
              })
            }
            className="px-3 py-1.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Edit3 size={13} />
            <span>Edit Specification</span>
          </button>

          <button
            onClick={() =>
              addToast({
                type: 'info',
                title: 'Clarification Dialog',
                message: 'Sent targeted clarification questions to developer.'
              })
            }
            className="px-3 py-1.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <MessageSquarePlus size={13} />
            <span>Ask Clarification</span>
          </button>
        </div>

        <button
          onClick={handleApproveAndPlan}
          className="px-4 py-1.5 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] text-[#FFFFFF] font-bold text-xs flex items-center gap-1.5 transition-colors"
        >
          <Bot size={14} />
          <span>Approve & Plan Task</span>
        </button>
      </div>
    </div>
  );
};
