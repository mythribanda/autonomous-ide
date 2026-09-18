import React from 'react';

interface QualityScoreGaugeProps {
  score: number;
}

export const QualityScoreGauge: React.FC<QualityScoreGaugeProps> = ({ score }) => {
  const getColor = () => {
    if (score >= 80) return '#89D185';
    if (score >= 60) return '#CCA700';
    return '#F14C4C';
  };

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-sm bg-[#181818] border border-[#2B2B2B]">
      <div className="flex items-center justify-center w-12 h-12 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B]">
        <span className="text-base font-bold font-mono" style={{ color: getColor() }}>
          {score}
        </span>
      </div>

      <div className="space-y-0.5">
        <h4 className="text-[11px] font-bold text-[#CCCCCC] uppercase tracking-wider font-mono">
          PROMPT QUALITY
        </h4>
        <p className="text-[11px] text-[#858585] font-sans">
          {score >= 80
            ? 'High fidelity specification. Ready for autonomous plan generation.'
            : score >= 60
            ? 'Adequate intent detected with minor ambiguities.'
            : 'Low specificity. Clarification recommended before planning.'}
        </p>
      </div>
    </div>
  );
};
