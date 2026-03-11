import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Trash2,
  Loader2,
  PlusCircle,
  Clock,
  MessageSquare,
  ChevronLeft,
  Lock,
} from 'lucide-react';
import type { ChatMessage } from '@/types';
import { useChatSession } from '@/hooks/useChatSession';
import { useSessions } from '@/hooks/useSessions';
import { useSkills } from '@/hooks/useSkills';
import { useModel } from '@/hooks/useModel';
import { useContentScript } from '@/hooks/useContentScript';
import ConfirmationCard from '@/components/shared/ConfirmationCard';
import ToolCallCard from '@/components/shared/ToolCallCard';
import { isBuiltinSkill } from '@/utils/builtin-skills';
import MarkdownRenderer from '@/components/shared/MarkdownRenderer';

export default function SidePanelApp() {
  const { config } = useModel();
  const { skills } = useSkills();
  const { pageInfo } = useContentScript();
  const hostname = pageInfo?.hostname || '';

  const {
    session,
    messages,
    isProcessing,
    streamingContent,
    pendingConfirmation,
    sendMessage,
    handleConfirm,
    clearMessages,
    createNewSession,
    switchSession,
  } = useChatSession(config, skills, hostname);

  const {
    sessionList,
    deleteSession,
  } = useSessions();

  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, pendingConfirmation]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    sendMessage(trimmed);
  };

  /**
   * 判断某个会话是否可以进入（切换到）
   * 规则：只能进入与当前 hostname 匹配的会话
   */
  const canEnterSession = useCallback(
    (sessionHostname: string) => {
      if (!hostname) return false;
      return sessionHostname === hostname;
    },
    [hostname]
  );

  // 从历史列表点击会话
  const handleSelectSession = useCallback(
    async (sessionId: string, sessionHostname: string) => {
      if (!canEnterSession(sessionHostname)) return;
      await switchSession(sessionId);
      setShowHistory(false);
    },
    [switchSession, canEnterSession]
  );

  // 新建会话（从历史面板）
  const handleNewFromHistory = useCallback(async () => {
    await createNewSession();
    setShowHistory(false);
  }, [createNewSession]);

  // 删除会话（所有会话都可删除）
  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      if (confirm('确定删除此会话？')) {
        await deleteSession(sessionId);
        // 如果删除的是当前会话，自动新建
        if (session?.id === sessionId) {
          await createNewSession();
        }
      }
    },
    [deleteSession, session?.id, createNewSession]
  );

  const isConfigured = !!config.apiKey;

  // 统计用户自定义 Skill 数量（排除内置 Skill）
  const userSkillCount = skills.filter((s) => !isBuiltinSkill(s.id)).length;

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

  // ─── 历史记录面板 ───
  if (showHistory) {
    // 将会话分为两组：当前站点的在前，其他站点的在后
    const currentHostSessions = sessionList.filter((s) => canEnterSession(s.hostname));
    const otherHostSessions = sessionList.filter((s) => !canEnterSession(s.hostname));

    return (
      <div className="flex flex-col h-screen bg-base-100">
        {/* 历史面板 Header */}
        <div className="sticky top-0 z-10 px-3 py-2.5 border-b border-base-200 bg-base-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              className="btn btn-xs btn-ghost btn-square"
              onClick={() => setShowHistory(false)}
              title="返回对话"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">历史会话</span>
            {sessionList.length > 0 && (
              <span className="badge badge-xs badge-primary">{sessionList.length}</span>
            )}
          </div>
          <button
            className="btn btn-xs btn-primary gap-1"
            onClick={handleNewFromHistory}
            title="新建会话"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            新建
          </button>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto">
          {sessionList.length === 0 ? (
            <div className="text-center py-16 px-4">
              <MessageSquare className="w-10 h-10 mx-auto text-base-content/20 mb-3" />
              <p className="text-sm text-base-content/50">还没有任何会话</p>
              <p className="text-xs text-base-content/30 mt-1">点击「新建」开始第一次对话</p>
            </div>
          ) : (
            <>
              {/* 当前站点会话 */}
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
                        isActive={item.id === session?.id}
                        canEnter={true}
                        onSelect={() => handleSelectSession(item.id, item.hostname)}
                        onDelete={(e) => handleDeleteSession(e, item.id)}
                        formatTime={formatTime}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {/* 其他站点会话 */}
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
                        isActive={false}
                        canEnter={false}
                        onSelect={() => {}} // 不可进入
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
      </div>
    );
  }

  // ─── 对话主页面 ───
  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* Header: 左边 hostname，右边功能区 */}
      <div className="sticky top-0 z-10 px-3 py-2.5 border-b border-base-200 bg-base-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {hostname ? (
            <span className="text-sm font-medium text-base-content/70 truncate">{hostname}</span>
          ) : (
            <span className="text-sm text-base-content/30">未连接站点</span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            className="btn btn-xs btn-ghost"
            onClick={() => setShowHistory(true)}
            title="历史会话"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          <button
            className="btn btn-xs btn-ghost"
            onClick={createNewSession}
            title="新建会话"
          >
            <PlusCircle className="w-3.5 h-3.5" />
          </button>
          <button
            className="btn btn-xs btn-ghost"
            onClick={clearMessages}
            title="清除当前对话"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!isConfigured && (
          <div className="alert alert-warning text-xs">
            <span>⚠️ 请先在 Popup「模型」页面配置 API Key</span>
          </div>
        )}



        {messages.length === 0 && isConfigured && (
          <div className="text-center text-xs opacity-50 py-12">
            <p className="text-2xl mb-3">👋</p>
            <p>你好！我可以帮你通过自然语言操作当前网站的 API。</p>
            <p className="mt-1">已加载 {skills.length} 个 Skill（含内置工具）{userSkillCount > 0 && `，其中 ${userSkillCount} 个自定义`}。</p>
            <p className="mt-1 text-base-content/40">尝试输入「帮我读取这个页面的内容」开始体验</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {streamingContent && (
          <div className="chat chat-start">
            <div className="chat-bubble chat-bubble-ghost text-sm max-w-[90%]">
              <MarkdownRenderer content={streamingContent} />
              <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {pendingConfirmation && (
          <ConfirmationCard
            data={pendingConfirmation}
            onConfirm={() => handleConfirm(true)}
            onReject={() => handleConfirm(false)}
          />
        )}

        {isProcessing && !streamingContent && !pendingConfirmation && (
          <div className="flex items-center gap-2 text-xs opacity-50">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>AI 正在思考...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-base-200 bg-base-100 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            className="textarea textarea-sm flex-1 resize-none leading-snug"
            placeholder={isConfigured ? '输入指令...（如"帮我读取这个页面的内容"）' : '请先配置模型 API Key'}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!isConfigured || isProcessing}
          />
          <button
            className="btn btn-sm btn-primary"
            onClick={handleSend}
            disabled={!input.trim() || !isConfigured || isProcessing}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 会话列表项组件 ============
interface SessionItemProps {
  item: {
    id: string;
    title: string;
    hostname: string;
    preview: string;
    updatedAt: number;
    messageCount: number;
  };
  isActive: boolean;
  canEnter: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatTime: (ts: number) => string;
}

const SessionItem: React.FC<SessionItemProps> = ({
  item,
  isActive,
  canEnter,
  onSelect,
  onDelete,
  formatTime,
}) => {
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2.5 transition-colors group ${
        canEnter
          ? 'hover:bg-base-200 cursor-pointer'
          : 'opacity-60 cursor-not-allowed'
      } ${isActive ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
      onClick={onSelect}
      title={
        canEnter
          ? `点击进入会话`
          : `此会话来自 ${item.hostname}，需在该网站打开侧栏才能进入`
      }
    >
      <div className="shrink-0">
        {canEnter ? (
          <MessageSquare
            className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-primary/40'}`}
          />
        ) : (
          <Lock className="w-4 h-4 text-base-content/30" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.title}</span>
          {isActive && <span className="badge badge-xs badge-primary">当前</span>}
        </div>
        <div className="text-xs text-base-content/40 truncate mt-0.5">
          {item.preview || '空会话'}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-base-content/30 bg-base-200 rounded px-1">
            {item.hostname || '未知站点'}
          </span>
          <span className="text-[10px] text-base-content/30">
            {formatTime(item.updatedAt)}
          </span>
          <span className="text-[10px] text-base-content/30">
            · {item.messageCount} 条消息
          </span>
        </div>
      </div>
      {/* 所有会话都可删除 */}
      <button
        className="btn btn-xs btn-ghost opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={onDelete}
        title="删除"
      >
        <Trash2 className="w-3 h-3 text-error" />
      </button>
    </li>
  );
};

// ============ 消息气泡组件 ============
const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  if (message.role === 'tool' || message.role === 'system') return null;

  const isUser = message.role === 'user';

  return (
    <div>
      {message.toolCalls?.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}

      {message.content && (
        <div className={`chat ${isUser ? 'chat-end' : 'chat-start'}`}>
          <div
            className={`chat-bubble text-sm ${
              isUser ? 'chat-bubble-primary whitespace-pre-wrap' : 'max-w-[90%]'
            } ${message.status === 'error' ? 'chat-bubble-error' : ''}`}
          >
            {isUser ? (
              message.content
            ) : (
              <MarkdownRenderer content={message.content} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
