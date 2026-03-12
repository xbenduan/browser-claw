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
  Globe,
  AlertTriangle,
  Square,
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
import Modal from '@/components/shared/Modal';

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
    stopProcessing,
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
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, pendingConfirmation]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');

    // 重置 textarea 高度
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    sendMessage(trimmed);
  };

  const canEnterSession = useCallback(
    (sessionHostname: string) => {
      if (!hostname) return false;
      return sessionHostname === hostname;
    },
    [hostname]
  );

  const handleSelectSession = useCallback(
    async (sessionId: string, sessionHostname: string) => {
      if (!canEnterSession(sessionHostname)) return;
      await switchSession(sessionId);
      setShowHistory(false);
    },
    [switchSession, canEnterSession]
  );

  const handleNewFromHistory = useCallback(async () => {
    await createNewSession();
    setShowHistory(false);
  }, [createNewSession]);

  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      setDeleteSessionId(sessionId);
    },
    []
  );

  const isConfigured = !!config.apiKey;
  const userSkillCount = skills.filter((s) => !isBuiltinSkill(s.id)).length;

  // 找到当前 pendingConfirmation 对应的 skill definition（用于参数提示）
  const pendingSkillDef = pendingConfirmation
    ? skills.find((s) => s.id === pendingConfirmation.skillId)
    : undefined;

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

  // ─── History Panel ───
  if (showHistory) {
    const currentHostSessions = sessionList.filter((s) => canEnterSession(s.hostname));
    const otherHostSessions = sessionList.filter((s) => !canEnterSession(s.hostname));

    return (
      <div className="flex flex-col h-screen font-sans text-slate-700 bg-slate-50">
        <div className="sticky top-0 z-10 p-4 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              onClick={() => setShowHistory(false)}
              title="返回对话"
            >
              <ChevronLeft className="w-5 h-5 text-cyan-600" />
            </button>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-600" />
              <span className="font-semibold text-sm text-slate-800">历史会话</span>
              {sessionList.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-600 text-[10px] border border-cyan-100">
                  {sessionList.length}
                </span>
              )}
            </div>
          </div>
          <button
            className="glass-button-primary text-xs px-3 py-1.5 h-8"
            onClick={handleNewFromHistory}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            新建
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {sessionList.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 border border-slate-200 shadow-sm">
                <MessageSquare className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">还没有任何会话</p>
              <p className="text-xs text-slate-400 mt-1">点击右上角「新建」开始第一次对话</p>
            </div>
          ) : (
            <>
              {currentHostSessions.length > 0 && (
                <div className="space-y-2">
                  <div className="px-3 text-[10px] font-medium text-cyan-600/80 uppercase tracking-wider flex items-center gap-2">
                    <Globe className="w-3 h-3" />
                    当前站点 · {hostname}
                  </div>
                  <ul className="space-y-2">
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

              {otherHostSessions.length > 0 && (
                <div className="space-y-2">
                  <div className="px-3 text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Globe className="w-3 h-3" />
                    其他站点
                  </div>
                  <ul className="space-y-2">
                    {otherHostSessions.map((item) => (
                      <SessionItem
                        key={item.id}
                        item={item}
                        isActive={false}
                        canEnter={false}
                        onSelect={() => {}}
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
                    if (session?.id === deleteSessionId) {
                      await createNewSession();
                    }
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
  }

  // ─── Main Chat Interface ───
  return (
    <div className="flex flex-col h-screen font-sans text-slate-700 bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
          {hostname ? (
            <span className="text-sm font-medium text-slate-800 truncate">{hostname}</span>
          ) : (
            <span className="text-sm text-slate-500">未连接站点</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-cyan-600"
            onClick={() => setShowHistory(true)}
            title="历史会话"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-cyan-600"
            onClick={createNewSession}
            title="新建会话"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-red-500"
            onClick={clearMessages}
            title="清除当前对话"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {!isConfigured && (
          <div className="glass-panel p-4 rounded-xl border-amber-200 bg-amber-50 flex items-center gap-3 text-amber-700 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>请先在扩展图标 Popup 中配置模型 API Key</span>
          </div>
        )}

        {messages.length === 0 && isConfigured && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-cyan-100 to-blue-100 border border-white flex items-center justify-center shadow-lg shadow-cyan-100 animate-float">
              <MessageSquare className="w-10 h-10 text-cyan-600" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-slate-800">有什么我可以帮你的吗？</p>
              <p className="text-sm text-slate-500 max-w-60 mx-auto leading-relaxed">
                我可以帮你阅读当前页面内容、执行操作，或者回答任何问题。
              </p>
            </div>
            {userSkillCount > 0 && (
               <div className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-500 shadow-sm">
                 已加载 {userSkillCount} 个自定义技能
               </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[90%] glass-panel rounded-2xl rounded-tl-none p-4 text-sm text-slate-700">
              <MarkdownRenderer content={streamingContent} />
              <span className="inline-block w-1.5 h-4 bg-cyan-400 animate-pulse ml-1 align-middle" />
            </div>
          </div>
        )}

        {pendingConfirmation && (
          <div className="max-w-[90%]">
            <ConfirmationCard
              data={pendingConfirmation}
              skillDefinition={pendingSkillDef}
              onResult={handleConfirm}
            />
          </div>
        )}

        {isProcessing && !streamingContent && !pendingConfirmation && (
          <div className="flex items-center gap-2 text-xs text-cyan-600/80 pl-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>AI 正在思考...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-200 bg-white/80 backdrop-blur-md shrink-0">
        <div className="flex items-end gap-2 w-full bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm transition-all focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50">
          <textarea
            ref={inputRef}
            className="flex-1 w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400 resize-none py-1"
            placeholder={!isConfigured ? '等待配置...' : '输入指令...（如"总结这个页面"）'}
            rows={1}
            style={{ minHeight: '28px', maxHeight: '120px' }}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!isConfigured || isProcessing}
          />
          {isProcessing ? (
            <button
              className="shrink-0 p-1.5 rounded-lg transition-all bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700"
              onClick={stopProcessing}
              title="暂停执行"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              className="shrink-0 p-1.5 rounded-lg transition-all bg-cyan-200 text-cyan-600 hover:bg-cyan-500 hover:text-white disabled:opacity-30 disabled:hover:bg-cyan-50 disabled:hover:text-cyan-600"
              onClick={handleSend}
              disabled={!input.trim() || !isConfigured || isProcessing}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Components ============

const SessionItem: React.FC<{
  item: any;
  isActive: boolean;
  canEnter: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatTime: (ts: number) => string;
}> = ({ item, isActive, canEnter, onSelect, onDelete, formatTime }) => {
  return (
    <li
      className={`relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group border border-transparent ${
        canEnter
          ? 'hover:bg-white cursor-pointer hover:border-slate-200 hover:shadow-sm'
          : 'opacity-50 cursor-not-allowed bg-slate-100'
      } ${isActive ? 'bg-cyan-50 border-cyan-200 shadow-sm' : ''}`}
      onClick={onSelect}
    >
      <div className={`shrink-0 p-2 rounded-lg ${isActive ? 'bg-cyan-100 text-cyan-700' : 'bg-white text-slate-400 border border-slate-100'}`}>
        {canEnter ? (
          <MessageSquare className="w-4 h-4" />
        ) : (
          <Lock className="w-4 h-4" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-medium truncate ${isActive ? 'text-cyan-900' : 'text-slate-700'}`}>
            {item.title}
          </span>
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
          )}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {item.preview || '空会话'}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-slate-500 bg-white px-1.5 rounded border border-slate-200">
            {formatTime(item.updatedAt)}
          </span>
        </div>
      </div>

      <button
        className="absolute right-2 top-2 p-1.5 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
        onClick={onDelete}
        title="删除"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
};

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  if (message.role === 'tool' || message.role === 'system') return null;

  const isUser = message.role === 'user';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}>
      {message.toolCalls?.map((tc) => (
        <div key={tc.id} className="max-w-[90%]">
          <ToolCallCard toolCall={tc} />
        </div>
      ))}

      {message.content && (
        <div
          className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm border shadow-sm backdrop-blur-sm ${
            isUser
              ? 'bg-cyan-100/80 border-cyan-200 text-cyan-900 rounded-tr-none shadow-cyan-100'
              : 'glass-panel rounded-tl-none text-slate-700'
          } ${message.status === 'error' ? 'border-red-200 bg-red-50 text-red-800' : ''}`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
      )}
    </div>
  );
};
