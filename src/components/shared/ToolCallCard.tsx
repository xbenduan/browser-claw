import React, { useState } from 'react';
import type { ToolCallDisplay } from '@/types';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, PlayCircle, ToolCase } from 'lucide-react';
import { useI18n } from '@/i18n';

interface ToolCallCardProps {
  toolCall: ToolCallDisplay;
}

const getStatusConfig = (t: (key: string, vars?: Record<string, string | number>) => string) => ({
  pending_confirmation: { 
    label: t('toolCall.pending'), 
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Clock
  },
  confirmed: { 
    label: t('toolCall.confirmed'), 
    cls: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: CheckCircle2
  },
  rejected: { 
    label: t('toolCall.rejected'), 
    cls: 'bg-red-50 text-red-700 border-red-200',
    icon: XCircle
  },
  executing: { 
    label: t('toolCall.executing'), 
    cls: 'bg-cyan-50 text-cyan-700 border-cyan-200 animate-pulse',
    icon: PlayCircle
  },
  success: { 
    label: t('toolCall.success'), 
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2
  },
  error: { 
    label: t('toolCall.error'), 
    cls: 'bg-red-50 text-red-700 border-red-200',
    icon: XCircle
  },
});

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-600',
  POST: 'text-blue-600',
  PUT: 'text-amber-600',
  PATCH: 'text-amber-600',
  DELETE: 'text-red-600',
};

const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall }) => {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const statusConfigMap = getStatusConfig(t);
  const statusConfig = statusConfigMap[toolCall.status] ?? { 
    label: toolCall.status, 
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: Clock
  };
  const StatusIcon = statusConfig.icon;

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <div className="glass-card p-3 my-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 flex items-center justify-center">
            <ToolCase />
          </div>
          <span className="font-medium text-sm text-slate-600">
            {toolCall.skillName}
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] border flex items-center gap-1 ${statusConfig.cls}`}>
          <StatusIcon className="w-3 h-3" />
          {statusConfig.label}
        </span>
      </div>

      {toolCall.confirmation && (
        <div className="mt-2 bg-slate-50/90 rounded-lg p-2 border border-slate-200/70 font-mono text-[10px] flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <span className={`font-bold shrink-0 ${METHOD_COLORS[toolCall.confirmation.method] ?? 'text-slate-400'}`}>
            {toolCall.confirmation.method}
          </span>
          <span className="text-slate-600 whitespace-nowrap" title={toolCall.confirmation.url}>
            {toolCall.confirmation.url}
          </span>
        </div>
      )}

      {toolCall.status === 'success' && toolCall.result != null && (
        <div className="mt-2">
          <button 
            onClick={toggleExpand}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-cyan-600 transition-colors w-full"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>{t('toolCall.viewResult')}</span>
          </button>
          
          {isExpanded && (
            <div className="mt-1 relative group">
              <pre className="bg-slate-50 rounded-lg p-3 border border-slate-200/70 overflow-auto max-h-60 text-xs text-slate-700 font-mono custom-scrollbar">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {toolCall.status === 'error' && toolCall.error && (
        <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{toolCall.error}</span>
        </div>
      )}

      {toolCall.batchProgress && (
        <div className="mt-3 space-y-1">
          <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
            <div 
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${(toolCall.batchProgress.completed / toolCall.batchProgress.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 px-0.5">
            <span>{t('toolCall.progress', { completed: toolCall.batchProgress.completed, total: toolCall.batchProgress.total })}</span>
            <div className="flex gap-2">
              <span className="text-green-600">{t('toolCall.successCount', { count: toolCall.batchProgress.success })}</span>
              <span className="text-red-600">{t('toolCall.failedCount', { count: toolCall.batchProgress.failed })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolCallCard;
