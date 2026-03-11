import React from 'react';
import type { ConfirmationRequest } from '@/types';
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS, METHOD_COLORS } from '@/utils/constants';

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
  const riskColor = RISK_LEVEL_COLORS[data.riskLevel] ?? 'badge-outline';
  const riskLabel = RISK_LEVEL_LABELS[data.riskLevel] ?? data.riskLevel;
  const methodColor = METHOD_COLORS[data.method] ?? '';

  return (
    <div className="card bg-base-200 shadow-sm my-2 border border-base-300">
      <div className="card-body p-4">
        <h3 className="card-title text-sm gap-1">
          <span>⚠️</span>
          <span>即将调用「{data.skillName}」</span>
        </h3>
        <p className="text-xs opacity-70">{data.skillDescription}</p>

        <div className="bg-base-300 rounded-lg p-3 text-xs font-mono space-y-1">
          <div>
            <span className={`font-bold ${methodColor}`}>{data.method}</span>{' '}
            <span className="break-all">{data.url}</span>
          </div>
          {Object.keys(data.parameters).length > 0 && (
            <div className="mt-2 space-y-0.5">
              <div className="font-semibold opacity-70">参数:</div>
              {Object.entries(data.parameters).map(([key, val]) => (
                <div key={key} className="pl-2">
                  <span className="text-primary">{key}</span> ={' '}
                  <span className="text-accent">{JSON.stringify(val)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className={`badge badge-sm ${riskColor}`}>{riskLabel}</span>
          {data.isBatch && (
            <span className="badge badge-sm badge-info">
              批量 {data.batchCount} 条
            </span>
          )}
        </div>

        <div className="card-actions justify-end mt-2">
          <button
            className="btn btn-sm btn-error btn-outline"
            onClick={onReject}
          >
            ❌ 拒绝
          </button>
          <button
            className="btn btn-sm btn-success"
            onClick={onConfirm}
          >
            ✅ 确认执行
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationCard;
