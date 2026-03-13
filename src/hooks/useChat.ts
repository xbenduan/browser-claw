import { useState, useCallback, useRef } from "react";
import type {
  ChatMessage,
  AgentConfig,
  SkillDefinition,
  ConfirmationRequest,
  ConfirmationResult,
} from "@/types";
import { AgentEngine } from "@/core/agent-engine";

export function useChat(
  config: AgentConfig,
  skills: SkillDefinition[],
  hostname: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const confirmResolverRef = useRef<
    ((result: ConfirmationResult) => void) | null
  >(null);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<ConfirmationRequest | null>(null);
  const engineRef = useRef<AgentEngine | null>(null);

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
    if (engineRef.current) {
      engineRef.current.abort();
    }
    if (confirmResolverRef.current) {
      confirmResolverRef.current({ confirmed: false });
      confirmResolverRef.current = null;
    }
    setPendingConfirmation(null);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!config.apiKey || isProcessing) return;

      // 添加用户消息
      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content,
        timestamp: Date.now(),
        status: "done",
      };
      const prevMessages = [...messages, userMsg];
      setMessages(prevMessages);
      setIsProcessing(true);
      setStreamingContent("");

      // 创建 Agent 引擎
      const engine = new AgentEngine(config, skills, hostname);
      engineRef.current = engine;

      // 设置确认处理（支持修改后的参数）
      engine.setConfirmationHandler(async (request: ConfirmationRequest) => {
        return new Promise<ConfirmationResult>((resolve) => {
          confirmResolverRef.current = resolve;
          setPendingConfirmation(request);
        });
      });

      // 准备 assistant 消息占位
      const assistantMsgId = `asst_${Date.now()}`;
      let fullContent = "";

      try {
        for await (const event of engine.processUserMessage(
          content,
          messages,
        )) {
          switch (event.type) {
            case "llm_streaming":
              fullContent += event.content;
              setStreamingContent(fullContent);
              break;

            case "assistant_message":
              fullContent = event.content;
              setStreamingContent("");
              setMessages((prev) => {
                // 移除之前的 streaming 占位
                const filtered = prev.filter((m) => m.id !== assistantMsgId);
                return [
                  ...filtered,
                  {
                    id: assistantMsgId + "_" + Date.now(),
                    role: "assistant" as const,
                    content: event.content,
                    timestamp: Date.now(),
                    status: "done" as const,
                  },
                ];
              });
              fullContent = "";
              break;

            case "tool_call_result": {
              const toolMsg: ChatMessage = {
                id: `tool_${Date.now()}_${event.toolCall.id}`,
                role: "assistant",
                content: "",
                timestamp: Date.now(),
                status: "done",
                toolCalls: [event.toolCall],
              };
              setMessages((prev) => [...prev, toolMsg]);
              // Also add the tool result to messages for context
              setMessages((prev) => [
                ...prev,
                {
                  id: `toolres_${Date.now()}`,
                  role: "tool" as const,
                  content: JSON.stringify(event.result),
                  timestamp: Date.now(),
                  status: "done",
                  toolCallId: event.toolCall.id,
                },
              ]);
              break;
            }

            case "error":
              setMessages((prev) => [
                ...prev,
                {
                  id: `err_${Date.now()}`,
                  role: "assistant",
                  content: `❌ 错误: ${event.error}`,
                  timestamp: Date.now(),
                  status: "error",
                },
              ]);
              break;

            case "done":
              break;
          }
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "assistant",
            content: `❌ 处理出错: ${errMsg}`,
            timestamp: Date.now(),
            status: "error",
          },
        ]);
      } finally {
        setIsProcessing(false);
        setStreamingContent("");
        engineRef.current = null;
      }
    },
    [config, skills, hostname, messages, isProcessing],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingContent("");
  }, []);

  return {
    messages,
    isProcessing,
    streamingContent,
    pendingConfirmation,
    sendMessage,
    handleConfirm,
    stopProcessing,
    clearMessages,
    addMessage,
  };
}
