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
import LanguageSwitch from '@/components/shared/LanguageSwitch';
import { useI18n } from '@/i18n';

export default function SidePanelApp() {
  const { t, locale } = useI18n();
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
  const [typedStreamingContent, setTypedStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingTargetRef = useRef('');
  const typingLengthRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, pendingConfirmation]);

  useEffect(() => {
    typingTargetRef.current = streamingContent;
    if (!streamingContent) {
      typingLengthRef.current = 0;
      setTypedStreamingContent('');
    }
  }, [streamingContent]);

  useEffect(() => {
    if (typingTimerRef.current !== null) return;
    typingTimerRef.current = window.setInterval(() => {
      const target = typingTargetRef.current;
      if (!target) {
        if (typingLengthRef.current !== 0) {
          typingLengthRef.current = 0;
          setTypedStreamingContent('');
        }
        return;
      }
      if (typingLengthRef.current < target.length) {
        const remaining = target.length - typingLengthRef.current;
        const step = Math.max(1, Math.ceil(remaining / 8));
        typingLengthRef.current = Math.min(typingLengthRef.current + step, target.length);
        setTypedStreamingContent(target.slice(0, typingLengthRef.current));
      }
    }, 14);

    return () => {
      if (typingTimerRef.current !== null) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, []);

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
    const dateLocale = locale === 'zh' ? 'zh-CN' : 'en-US';
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (isToday) {
      return d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(dateLocale, {
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
              title={t('sidepanel.backToChat')}
            >
              <ChevronLeft className="w-5 h-5 text-cyan-600" />
            </button>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-600" />
              <span className="font-semibold text-sm text-slate-800">{t('sidepanel.history')}</span>
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
            {t('sidepanel.new')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {sessionList.length === 0 ? (
            <div className="text-center py-20 px-4">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 border border-slate-200 shadow-sm">
                <MessageSquare className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">{t('sidepanel.emptySessions')}</p>
              <p className="text-xs text-slate-400 mt-1">{t('sidepanel.emptySessionsHint')}</p>
            </div>
          ) : (
            <>
              {currentHostSessions.length > 0 && (
                <div className="space-y-2">
                  <div className="px-3 text-[10px] font-medium text-cyan-600/80 uppercase tracking-wider flex items-center gap-2">
                    <Globe className="w-3 h-3" />
                    {t('sidepanel.currentSite', { hostname })}
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
                    {t('sidepanel.otherSites')}
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
          title={t('sidepanel.deleteTitle')}
          width="max-w-sm"
          footer={
            <>
              <button
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                onClick={() => setDeleteSessionId(null)}
              >
                {t('common.cancel')}
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
                {t('common.delete')}
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
                {t('sidepanel.deleteConfirm')}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {t('sidepanel.deleteDesc')}
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
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-slate-200/80 bg-white/90 backdrop-blur-md flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
          {hostname ? (
            <span className="text-sm font-medium text-slate-800 truncate">{hostname}</span>
          ) : (
            <span className="text-sm text-slate-500">{t('sidepanel.noSite')}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="mr-2">
            <LanguageSwitch />
          </div>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-cyan-600"
            onClick={() => setShowHistory(true)}
            title={t('sidepanel.history')}
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-cyan-600"
            onClick={createNewSession}
            title={t('sidepanel.newSession')}
          >
            <PlusCircle className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-red-500"
            onClick={clearMessages}
            title={t('sidepanel.clearChat')}
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
            <span>{t('sidepanel.notConfigured')}</span>
          </div>
        )}

        {messages.length === 0 && isConfigured && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-cyan-100 to-blue-100 border border-slate-200/80 flex items-center justify-center shadow-lg shadow-cyan-100 animate-float">
              <MessageSquare className="w-10 h-10 text-cyan-600" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-slate-800">{t('sidepanel.welcomeTitle')}</p>
              <p className="text-sm text-slate-500 max-w-60 mx-auto leading-relaxed">
                {t('sidepanel.welcomeDesc')}
              </p>
            </div>
            {userSkillCount > 0 && (
               <div className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs text-slate-500 shadow-sm">
                 {t('sidepanel.loadedSkills', { count: userSkillCount })}
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
              <MarkdownRenderer content={typedStreamingContent} isStreaming />
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
            <span>{t('sidepanel.thinking')}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-200/80 bg-white/90 backdrop-blur-md shrink-0">
        <div className="flex items-end gap-2 w-full bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-sm transition-all focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50">
          <textarea
            ref={inputRef}
            className="flex-1 w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400/80 placeholder:italic resize-none py-1"
            placeholder={!isConfigured ? t('sidepanel.inputWaiting') : t('sidepanel.inputPlaceholder')}
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
              title={t('sidepanel.stop')}
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
  const { t } = useI18n();
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
          {item.preview || t('sidepanel.emptySession')}
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
        title={t('sidepanel.deleteSession')}
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
