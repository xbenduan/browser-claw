import React from 'react';
import { AlertTriangle, ShieldAlert, X, Check } from 'lucide-react';
import type { ConfirmationRequest } from '@/types';

interface ConfirmationCardProps {
  data: ConfirmationRequest;
  onConfirm: () => void;
  onReject: () => void;
}

const ConfirmationCard: React.FC<ConfirmationCardProps> = ({
  data,
  onConfirm,
  onReject,
}) => {
  const isHighRisk = data.riskLevel === 'dangerous';
  const isMediumRisk = data.riskLevel === 'moderate';

  let borderColor = 'border-slate-200';
  let iconColor = 'text-cyan-600';
  let bgColor = 'bg-white/80';

  if (isHighRisk) {
    borderColor = 'border-red-200';
    iconColor = 'text-red-600';
    bgColor = 'bg-red-50';
  } else if (isMediumRisk) {
    borderColor = 'border-amber-200';
    iconColor = 'text-amber-600';
    bgColor = 'bg-amber-50';
  }

  return (
    <div className={`glass-card p-4 my-3 border ${borderColor} ${bgColor} shadow-sm backdrop-blur-md`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-white border border-slate-200 ${iconColor}`}>
          {isHighRisk ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            请求调用工具
            <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-mono border border-slate-200">
              {data.skillName}
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">{data.skillDescription}</p>
        </div>
      </div>

      <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-200 font-mono text-xs overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200 w-max min-w-full">
          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold uppercase border border-blue-100 shrink-0">
            {data.method}
          </span>
          <span className="text-slate-500 whitespace-nowrap" title={data.url}>
            {data.url}
          </span>
        </div>
        
        {Object.keys(data.parameters).length > 0 && (
          <div className="space-y-1.5">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold sticky left-0">
              Parameters
            </div>
            {Object.entries(data.parameters).map(([key, val]) => (
              <div key={key} className="flex gap-2 w-max min-w-full">
                <span className="text-cyan-600 shrink-0">{key}:</span>
                <span className="text-amber-600 whitespace-nowrap">{JSON.stringify(val)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex gap-2">
          {isHighRisk && (
            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs border border-red-200 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> 高风险
            </span>
          )}
          {data.isBatch && (
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs border border-blue-200">
              批量处理: {data.batchCount}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            className="glass-button-danger text-xs px-3 py-1.5 h-8"
            onClick={onReject}
          >
            <X className="w-3.5 h-3.5" />
            拒绝
          </button>
          <button
            className="glass-button-primary text-xs px-3 py-1.5 h-8"
            onClick={onConfirm}
          >
            <Check className="w-3.5 h-3.5" />
            确认执行
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationCard;
