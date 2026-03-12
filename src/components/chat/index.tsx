import React, { useCallback, useState } from 'react';
import {
  PlusCircle,
  Trash2,
  MessageSquare,
  Clock,
  Loader2,
  ExternalLink,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import type { AgentConfig, SkillDefinition, SessionListItem } from '@/types';
import { useSessions } from '@/hooks/useSessions';
import Modal from '@/components/shared/Modal';

interface ChatProps {
  config: AgentConfig;
  skills: SkillDefinition[];
  hostname: string;
}

const Chat: React.FC<ChatProps> = ({ config, hostname }) => {
  const { sessionList, loading, createSession, deleteSession, openSession } =
    useSessions();
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  const isConfigured = !!config.apiKey;

  const isCurrentHost = useCallback(
    (sessionHostname: string) => {
      if (!hostname) return false;
      return sessionHostname === hostname;
    },
    [hostname]
  );

  const openSidePanelAndClose = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    } catch (e) {
      console.error('Failed to open side panel:', e);
    }
    window.close();
  }, []);

  const handleNewSession = useCallback(async () => {
    if (!isConfigured) return;
    await createSession(hostname);
    await openSidePanelAndClose();
  }, [isConfigured, hostname, createSession, openSidePanelAndClose]);

  const handleOpenSession = useCallback(
    async (sessionId: string) => {
      await openSession(sessionId);
      await openSidePanelAndClose();
    },
    [openSession, openSidePanelAndClose]
  );

  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      setDeleteSessionId(sessionId);
    },
    []
  );

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (isToday) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  const currentHostSessions = sessionList.filter((s) => isCurrentHost(s.hostname));
  const otherHostSessions = sessionList.filter((s) => !isCurrentHost(s.hostname));

  return (
    <div className="flex flex-col h-full font-sans text-slate-700">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-600" />
          <span className="font-semibold text-sm">历史会话</span>
          {sessionList.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 text-[10px] border border-cyan-200">
              {sessionList.length}
            </span>
          )}
        </div>
        <button
          className="glass-button-primary text-xs px-3 py-1.5 h-8 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleNewSession}
          disabled={!isConfigured}
          title="新建会话并打开侧边栏"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          新建会话
        </button>
      </div>

      {!isConfigured && (
        <div className="p-4">
          <div className="glass-panel p-3 rounded-lg border-amber-200 bg-amber-50 flex items-center gap-2 text-amber-700 text-xs">
            <span>⚠️ 请先在「模型」页面配置 API Key</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {sessionList.length === 0 && isConfigured ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 border border-slate-200 shadow-sm">
              <MessageSquare className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 mb-1">还没有任何会话</p>
            <p className="text-xs text-slate-400 mb-6">
              点击「新建会话」开始对话，对话将在侧边栏中打开
            </p>
            <button
              className="glass-button-primary mx-auto"
              onClick={handleNewSession}
            >
              <PlusCircle className="w-4 h-4" />
              开始第一次对话
            </button>
          </div>
        ) : (
          <>
            {currentHostSessions.length > 0 && (
              <div className="space-y-3">
                <div className="px-1 text-[10px] font-medium text-cyan-600/80 uppercase tracking-wider flex items-center gap-2">
                  当前站点 · {hostname}
                </div>
                <div className="space-y-2">
                  {currentHostSessions.map((item) => (
                    <SessionItem
                      key={item.id}
                      item={item}
                      canEnter={true}
                      onClick={() => handleOpenSession(item.id)}
                      onDelete={(e) => handleDeleteSession(e, item.id)}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              </div>
            )}

            {otherHostSessions.length > 0 && (
              <div className="space-y-3">
                <div className="px-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  其他站点
                </div>
                <div className="space-y-2">
                  {otherHostSessions.map((item) => (
                    <SessionItem
                      key={item.id}
                      item={item}
                      canEnter={false}
                      onDelete={(e) => handleDeleteSession(e, item.id)}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {sessionList.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 bg-white/50">
          <p className="text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
            <ExternalLink className="w-3 h-3" />
            点击当前站点的会话可在侧边栏中继续对话
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteSessionId}
        onClose={() => setDeleteSessionId(null)}
        title="确认删除"
        width="max-w-sm"
        footer={
          <>
            <button
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              onClick={() => setDeleteSessionId(null)}
            >
              取消
            </button>
            <button
              className="glass-button-danger text-xs px-3 py-1.5"
              onClick={async () => {
                if (deleteSessionId) {
                  await deleteSession(deleteSessionId);
                  setDeleteSessionId(null);
                }
              }}
            >
              删除
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-red-50 text-red-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-slate-700 font-medium">
              确定要删除此会话吗？
            </p>
            <p className="text-xs text-slate-500 mt-1">
              此操作无法撤销，所有对话记录将被永久删除。
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

interface SessionItemProps {
  item: SessionListItem;
  canEnter: boolean;
  onClick?: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatTime: (ts: number) => string;
}

const SessionItem: React.FC<SessionItemProps> = ({
  item,
  canEnter,
  onClick,
  onDelete,
  formatTime,
}) => {
  return (
    <div
      className={`glass-card p-3 flex items-center gap-3 transition-all duration-300 group ${
        canEnter
          ? 'hover:bg-white cursor-pointer hover:border-cyan-200 hover:shadow-cyan-100'
          : 'opacity-50 cursor-not-allowed bg-slate-100'
      }`}
      onClick={canEnter ? onClick : undefined}
      title={
        canEnter
          ? '点击在侧边栏中打开'
          : `此会话来自 ${item.hostname}，需在该网站打开`
      }
    >
      <div className={`shrink-0 p-2 rounded-lg ${canEnter ? 'bg-cyan-50 text-cyan-600' : 'bg-white text-slate-400 border border-slate-100'}`}>
        {canEnter ? (
          <MessageSquare className="w-4 h-4" />
        ) : (
          <Lock className="w-4 h-4" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-slate-800 truncate">{item.title}</span>
          {item.hostname && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-50 border border-slate-200 text-slate-500 truncate max-w-[120px]">
              {item.hostname}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {item.preview || '空会话'}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-slate-500 bg-white px-1.5 rounded border border-slate-200">
            {formatTime(item.updatedAt)}
          </span>
          <span className="text-[10px] text-slate-500">
            {item.messageCount} 条消息
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-1 shrink-0">
        <button
          className="p-1.5 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
          onClick={onDelete}
          title="删除会话"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {canEnter && (
          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-600 transition-colors opacity-0 group-hover:opacity-100" />
        )}
      </div>
    </div>
  );
};

export default Chat;
