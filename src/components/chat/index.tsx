import React, { useCallback } from 'react';
import {
  PlusCircle,
  Trash2,
  MessageSquare,
  Clock,
  Loader2,
  ExternalLink,
  Lock,
} from 'lucide-react';
import type { AgentConfig, SkillDefinition, SessionListItem } from '@/types';
import { useSessions } from '@/hooks/useSessions';

interface ChatProps {
  config: AgentConfig;
  skills: SkillDefinition[];
  hostname: string;
}

/**
 * 「历史记录」页面 — Popup 中展示
 * - 展示所有历史会话列表（按当前站点 / 其他站点分组）
 * - 支持新建会话（→ 打开侧边栏）
 * - 当前站点的会话可点击进入（→ 打开侧边栏）
 * - 其他站点的会话仅展示 + 删除
 */
const Chat: React.FC<ChatProps> = ({ config, hostname }) => {
  const { sessionList, loading, createSession, deleteSession, openSession } =
    useSessions();

  const isConfigured = !!config.apiKey;

  const isCurrentHost = useCallback(
    (sessionHostname: string) => {
      if (!hostname) return false;
      return sessionHostname === hostname;
    },
    [hostname]
  );

  // 打开侧边栏并关闭 Popup
  const openSidePanelAndClose = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    } catch (e) {
      console.error('Failed to open side panel:', e);
    }
    window.close();
  }, []);

  // 新建会话 → 打开侧边栏 → 关闭 Popup
  const handleNewSession = useCallback(async () => {
    if (!isConfigured) return;
    await createSession(hostname);
    await openSidePanelAndClose();
  }, [isConfigured, hostname, createSession, openSidePanelAndClose]);

  // 点击当前站点的会话 → 设置为活跃 → 打开侧边栏 → 关闭 Popup
  const handleOpenSession = useCallback(
    async (sessionId: string) => {
      await openSession(sessionId);
      await openSidePanelAndClose();
    },
    [openSession, openSidePanelAndClose]
  );

  // 删除会话（所有会话都可删除）
  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      if (confirm('确定删除此会话？')) {
        await deleteSession(sessionId);
      }
    },
    [deleteSession]
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
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // 分组：当前站点 vs 其他站点
  const currentHostSessions = sessionList.filter((s) => isCurrentHost(s.hostname));
  const otherHostSessions = sessionList.filter((s) => !isCurrentHost(s.hostname));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 p-3 border-b border-base-200 bg-base-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">历史会话</span>
          {sessionList.length > 0 && (
            <span className="badge badge-xs badge-primary">{sessionList.length}</span>
          )}
        </div>
        <button
          className="btn btn-xs btn-primary gap-1"
          onClick={handleNewSession}
          disabled={!isConfigured}
          title="新建会话并打开侧边栏"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          新建会话
        </button>
      </div>

      {/* 提示信息 */}
      {!isConfigured && (
        <div className="p-3">
          <div className="alert alert-warning text-xs">
            <span>⚠️ 请先在「模型」页面配置 API Key</span>
          </div>
        </div>
      )}

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto">
        {sessionList.length === 0 && isConfigured ? (
          <div className="text-center py-12 px-4">
            <MessageSquare className="w-10 h-10 mx-auto text-base-content/20 mb-3" />
            <p className="text-sm text-base-content/50 mb-1">还没有任何会话</p>
            <p className="text-xs text-base-content/30 mb-4">
              点击「新建会话」开始对话，对话将在侧边栏中打开
            </p>
            <button
              className="btn btn-sm btn-primary btn-outline gap-1"
              onClick={handleNewSession}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              开始第一次对话
            </button>
          </div>
        ) : (
          <>
            {/* 当前站点会话 — 可点击进入 */}
            {currentHostSessions.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-medium text-base-content/40 uppercase tracking-wider bg-base-200/50">
                  当前站点 · {hostname}
                </div>
                <ul className="divide-y divide-base-200">
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
                </ul>
              </div>
            )}

            {/* 其他站点会话 — 仅展示 + 删除 */}
            {otherHostSessions.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[10px] font-medium text-base-content/40 uppercase tracking-wider bg-base-200/50">
                  其他站点
                </div>
                <ul className="divide-y divide-base-200">
                  {otherHostSessions.map((item) => (
                    <SessionItem
                      key={item.id}
                      item={item}
                      canEnter={false}
                      onDelete={(e) => handleDeleteSession(e, item.id)}
                      formatTime={formatTime}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部提示 */}
      {sessionList.length > 0 && (
        <div className="px-3 py-2 border-t border-base-200 bg-base-100">
          <p className="text-[10px] text-base-content/30 text-center">
            点击当前站点的会话可在侧边栏中继续对话
          </p>
        </div>
      )}
    </div>
  );
};

// ============ 会话条目组件 ============
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
    <li
      className={`flex items-center gap-3 px-3 py-2.5 transition-colors group ${
        canEnter
          ? 'hover:bg-base-200 cursor-pointer'
          : 'opacity-60'
      }`}
      onClick={canEnter ? onClick : undefined}
      title={
        canEnter
          ? '点击在侧边栏中打开'
          : `此会话来自 ${item.hostname}，需在该网站打开`
      }
    >
      <div className="shrink-0">
        {canEnter ? (
          <MessageSquare className="w-4 h-4 text-primary/60" />
        ) : (
          <Lock className="w-4 h-4 text-base-content/30" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.title}</span>
          {item.hostname && (
            <span className="badge badge-xs badge-outline shrink-0 opacity-60">
              {item.hostname}
            </span>
          )}
        </div>
        <div className="text-xs text-base-content/40 truncate mt-0.5">
          {item.preview || '空会话'}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-base-content/30">
            {formatTime(item.updatedAt)}
          </span>
          <span className="text-[10px] text-base-content/30">
            · {item.messageCount} 条消息
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          className="btn btn-xs btn-ghost opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onDelete}
          title="删除会话"
        >
          <Trash2 className="w-3 h-3 text-error" />
        </button>
        {canEnter && (
          <ExternalLink className="w-3.5 h-3.5 text-base-content/20 group-hover:text-primary transition-colors" />
        )}
      </div>
    </li>
  );
};

export default Chat;
