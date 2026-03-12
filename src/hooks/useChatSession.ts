import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, AgentConfig, SkillDefinition, ConfirmationRequest, ConfirmationResult, ChatSession } from '@/types';
import { AgentEngine } from '@/core/agent-engine';
import { Storage } from '@/utils/storage';

/**
 * 带会话持久化的聊天 hook — 用于 Side Panel
 */
export function useChatSession(
  config: AgentConfig,
  skills: SkillDefinition[],
  hostname: string
) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const confirmResolverRef = useRef<((result: ConfirmationResult) => void) | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationRequest | null>(null);
  const engineRef = useRef<AgentEngine | null>(null);

  // 加载活跃会话
  const loadSession = useCallback(async (sessionId?: string) => {

    const id = sessionId || (await Storage.getActiveSessionId());
    if (!id) {
      // 没有活跃会话，创建一个新的
      const newSession = Storage.createNewSession(hostname);
      await Storage.saveSession(newSession);
      await Storage.setActiveSessionId(newSession.id);
      setSession(newSession);
      setMessages([]);
      return newSession;
    }
    const loaded = await Storage.getSession(id);
    if (loaded) {
      setSession(loaded);
      setMessages(loaded.messages);
      return loaded;
    }
    // ID 无效，创建新的
    const newSession = Storage.createNewSession(hostname);
    await Storage.saveSession(newSession);
    await Storage.setActiveSessionId(newSession.id);
    setSession(newSession);
    setMessages([]);
    return newSession;
  }, [hostname]);

  // 初始化时加载
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // 监听 activeSessionId 变化（从 popup 切换会话）
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.activeSessionId) {
        const newId = changes.activeSessionId.newValue as string;
        if (newId && newId !== session?.id) {
          loadSession(newId);
        }
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [session?.id, loadSession]);

  // 持久化消息
  const persistMessages = useCallback(
    async (msgs: ChatMessage[]) => {
      if (!session) return;
      const firstUserMsg = msgs.find((m) => m.role === 'user');
      const updated: ChatSession = {
        ...session,
        messages: msgs,
        updatedAt: Date.now(),
        title: firstUserMsg?.content.slice(0, 30) || session.title,
        preview: firstUserMsg?.content.slice(0, 60) || session.preview,
      };
      setSession(updated);
      await Storage.saveSession(updated);
    },
    [session]
  );

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  /**
   * 处理确认结果。
   * 接受 ConfirmationResult 对象，支持传递修改后的参数。
   */
  const handleConfirm = useCallback((result: ConfirmationResult) => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(result);
      confirmResolverRef.current = null;
    }
    setPendingConfirmation(null);
  }, []);

  /**
   * 暂停/中止当前 agent 执行流程
   */
  const stopProcessing = useCallback(() => {
    // 1. 中止 agent engine（停止 LLM 流式请求和工具执行循环）
    if (engineRef.current) {
      engineRef.current.abort();
    }
    // 2. 如果正在等待用户确认，自动拒绝
    if (confirmResolverRef.current) {
      confirmResolverRef.current({ confirmed: false });
      confirmResolverRef.current = null;
    }
    setPendingConfirmation(null);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!config.apiKey || isProcessing) return;

      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
        status: 'done',
      };
      const prevMessages = [...messages, userMsg];
      setMessages(prevMessages);
      await persistMessages(prevMessages);
      setIsProcessing(true);
      setStreamingContent('');

      const engine = new AgentEngine(config, skills, hostname);
      engineRef.current = engine;

      engine.setConfirmationHandler(async (request: ConfirmationRequest) => {
        return new Promise<ConfirmationResult>((resolve) => {
          confirmResolverRef.current = resolve;
          setPendingConfirmation(request);
        });
      });

      const assistantMsgId = `asst_${Date.now()}`;
      let fullContent = '';
      let currentMessages = prevMessages;

      try {
        for await (const event of engine.processUserMessage(content, messages)) {
          switch (event.type) {
            case 'llm_streaming':
              fullContent += event.content;
              setStreamingContent(fullContent);
              break;

            case 'assistant_message':
              fullContent = event.content;
              setStreamingContent('');
              {
                const newMsg: ChatMessage = {
                  id: assistantMsgId + '_' + Date.now(),
                  role: 'assistant',
                  content: event.content,
                  timestamp: Date.now(),
                  status: 'done',
                };
                currentMessages = [...currentMessages.filter((m) => m.id !== assistantMsgId), newMsg];
                setMessages(currentMessages);
                await persistMessages(currentMessages);
              }
              fullContent = '';
              break;

            case 'tool_call_result': {
              const toolMsg: ChatMessage = {
                id: `tool_${Date.now()}_${event.toolCall.id}`,
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
                status: 'done',
                toolCalls: [event.toolCall],
              };
              const toolResMsg: ChatMessage = {
                id: `toolres_${Date.now()}`,
                role: 'tool',
                content: JSON.stringify(event.result),
                timestamp: Date.now(),
                status: 'done',
                toolCallId: event.toolCall.id,
              };
              currentMessages = [...currentMessages, toolMsg, toolResMsg];
              setMessages(currentMessages);
              await persistMessages(currentMessages);
              break;
            }

            case 'error': {
              const errMsg: ChatMessage = {
                id: `err_${Date.now()}`,
                role: 'assistant',
                content: `❌ 错误: ${event.error}`,
                timestamp: Date.now(),
                status: 'error',
              };
              currentMessages = [...currentMessages, errMsg];
              setMessages(currentMessages);
              await persistMessages(currentMessages);
              break;
            }

            case 'done':
              break;
          }
        }
      } catch (error: unknown) {
        const errText = error instanceof Error ? error.message : String(error);
        const errMsg: ChatMessage = {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `❌ 处理出错: ${errText}`,
          timestamp: Date.now(),
          status: 'error',
        };
        currentMessages = [...currentMessages, errMsg];
        setMessages(currentMessages);
        await persistMessages(currentMessages);
      } finally {
        setIsProcessing(false);
        setStreamingContent('');
        engineRef.current = null;
      }
    },
    [config, skills, hostname, messages, isProcessing, persistMessages]
  );

  const clearMessages = useCallback(async () => {
    setMessages([]);
    setStreamingContent('');
    if (session) {
      const updated: ChatSession = {
        ...session,
        messages: [],
        updatedAt: Date.now(),
      };
      setSession(updated);
      await Storage.saveSession(updated);
    }
  }, [session]);

  const switchSession = useCallback(
    async (sessionId: string) => {
      await Storage.setActiveSessionId(sessionId);
      await loadSession(sessionId);
    },
    [loadSession]
  );

  const createNewSession = useCallback(async () => {
    const newSession = Storage.createNewSession(hostname);
    await Storage.saveSession(newSession);
    await Storage.setActiveSessionId(newSession.id);
    setSession(newSession);
    setMessages([]);
    return newSession;
  }, [hostname]);

  return {
    session,
    messages,
    isProcessing,
    streamingContent,
    pendingConfirmation,
    sendMessage,
    handleConfirm,
    stopProcessing,
    clearMessages,
    addMessage,
    loadSession,
    switchSession,
    createNewSession,
  };
}
