import React, { useState } from 'react';
import type { ToolCallDisplay } from '@/types';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, PlayCircle } from 'lucide-react';

interface ToolCallCardProps {
  toolCall: ToolCallDisplay;
}

const STATUS_CONFIG = {
  pending_confirmation: { 
    label: '等待确认', 
    cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: Clock
  },
  confirmed: { 
    label: '已确认', 
    cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: CheckCircle2
  },
  rejected: { 
    label: '已拒绝', 
    cls: 'bg-red-500/20 text-red-300 border-red-500/30',
    icon: XCircle
  },
  executing: { 
    label: '执行中', 
    cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 animate-pulse',
    icon: PlayCircle
  },
  success: { 
    label: '成功', 
    cls: 'bg-green-500/20 text-green-300 border-green-500/30',
    icon: CheckCircle2
  },
  error: { 
    label: '失败', 
    cls: 'bg-red-500/20 text-red-300 border-red-500/30',
    icon: XCircle
  },
};

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-blue-400',
  PUT: 'text-amber-400',
  PATCH: 'text-amber-400',
  DELETE: 'text-red-400',
};

const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusConfig = STATUS_CONFIG[toolCall.status] ?? { 
    label: toolCall.status, 
    cls: 'bg-slate-700/50 text-slate-400 border-slate-600/50',
    icon: Clock
  };
  const StatusIcon = statusConfig.icon;

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <div className="glass-card p-3 my-2 border border-white/5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-slate-800/50 flex items-center justify-center border border-white/5">
            <span className="text-xs">📡</span>
          </div>
          <span className="font-medium text-sm text-slate-200">
            {toolCall.skillName}
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] border flex items-center gap-1 ${statusConfig.cls}`}>
          <StatusIcon className="w-3 h-3" />
          {statusConfig.label}
        </span>
      </div>

      {toolCall.confirmation && (
        <div className="mt-2 bg-slate-950/30 rounded-lg p-2 border border-white/5 font-mono text-[10px] flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <span className={`font-bold shrink-0 ${METHOD_COLORS[toolCall.confirmation.method] ?? 'text-slate-400'}`}>
            {toolCall.confirmation.method}
          </span>
          <span className="text-slate-500 whitespace-nowrap" title={toolCall.confirmation.url}>
            {toolCall.confirmation.url}
          </span>
        </div>
      )}

      {toolCall.status === 'success' && toolCall.result != null && (
        <div className="mt-2">
          <button 
            onClick={toggleExpand}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors w-full"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>查看结果</span>
          </button>
          
          {isExpanded && (
            <div className="mt-1 relative group">
              <pre className="bg-slate-950/50 rounded-lg p-3 border border-white/5 overflow-auto max-h-60 text-xs text-slate-300 font-mono custom-scrollbar">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {toolCall.status === 'error' && toolCall.error && (
        <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-200 flex items-start gap-2">
          <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{toolCall.error}</span>
        </div>
      )}

      {toolCall.batchProgress && (
        <div className="mt-3 space-y-1">
          <div className="h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${(toolCall.batchProgress.completed / toolCall.batchProgress.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 px-0.5">
            <span>进度: {toolCall.batchProgress.completed}/{toolCall.batchProgress.total}</span>
            <div className="flex gap-2">
              <span className="text-green-400">✅ {toolCall.batchProgress.success}</span>
              <span className="text-red-400">❌ {toolCall.batchProgress.failed}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolCallCard;
