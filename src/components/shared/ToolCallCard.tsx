import React from 'react';
import type { ToolCallDisplay } from '@/types';
import { RISK_LEVEL_COLORS, METHOD_COLORS } from '@/utils/constants';

interface ToolCallCardProps {
  toolCall: ToolCallDisplay;
}

const STATUS_CONFIG = {
  pending_confirmation: { label: '等待确认', cls: 'badge-warning' },
  confirmed: { label: '已确认', cls: 'badge-info' },
  rejected: { label: '已拒绝', cls: 'badge-error' },
  executing: { label: '执行中', cls: 'badge-info' },
  success: { label: '成功', cls: 'badge-success' },
  error: { label: '失败', cls: 'badge-error' },
};

const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall }) => {
  const statusConfig = STATUS_CONFIG[toolCall.status] ?? { label: toolCall.status, cls: 'badge-outline' };
  const riskColor = toolCall.confirmation
    ? (RISK_LEVEL_COLORS[toolCall.confirmation.riskLevel] ?? '')
    : '';

  return (
    <div className="card bg-base-200 shadow-sm my-1 border border-base-300">
      <div className="card-body p-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">
            📡 {toolCall.skillName}
          </span>
          <span className={`badge badge-xs ${statusConfig.cls}`}>
            {statusConfig.label}
          </span>
        </div>

        {toolCall.confirmation && (
          <div className="text-xs font-mono bg-base-300 rounded p-2 mt-1">
            <span className={`font-bold ${METHOD_COLORS[toolCall.confirmation.method] ?? ''}`}>
              {toolCall.confirmation.method}
            </span>{' '}
            <span className="break-all">{toolCall.confirmation.url}</span>
          </div>
        )}

        {toolCall.status === 'success' && toolCall.result != null && (
          <div className="text-xs mt-1">
            <details>
              <summary className="cursor-pointer opacity-70">查看返回结果</summary>
              <pre className="bg-base-300 rounded p-2 mt-1 overflow-auto max-h-40 text-xs">
                {String(JSON.stringify(toolCall.result, null, 2))}
              </pre>
            </details>
          </div>
        )}

        {toolCall.status === 'error' && toolCall.error && (
          <div className="text-xs text-error mt-1">
            ❌ {toolCall.error}
          </div>
        )}

        {toolCall.batchProgress && (
          <div className="mt-1">
            <progress
              className="progress progress-primary w-full"
              value={toolCall.batchProgress.completed}
              max={toolCall.batchProgress.total}
            />
            <div className="flex justify-between text-xs opacity-70 mt-0.5">
              <span>{toolCall.batchProgress.completed}/{toolCall.batchProgress.total}</span>
              <span>
                ✅ {toolCall.batchProgress.success} &nbsp; ❌ {toolCall.batchProgress.failed}
              </span>
            </div>
          </div>
        )}

        {riskColor && toolCall.confirmation && (
          <span className={`badge badge-xs ${riskColor} mt-1`}>
            {toolCall.confirmation.riskLevel}
          </span>
        )}
      </div>
    </div>
  );
};

export default ToolCallCard;
