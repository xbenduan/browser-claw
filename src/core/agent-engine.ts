import OpenAI from 'openai';
import type {
  AgentConfig,
  AgentEvent,
  ChatMessage,
  SkillDefinition,
  ConfirmationRequest,
  ToolCallDisplay,
} from '@/types';
import { skillsToOpenAITools } from './skill-converter';
import { buildHttpRequest } from './request-builder';
import { applyExtractors } from './response-extractor';
import { Messaging } from '@/utils/messaging';
import { MAX_AGENT_ITERATIONS } from '@/utils/constants';
import { BUILTIN_SKILL_IDS, isBuiltinSkill } from '@/utils/builtin-skills';

interface ToolCallRaw {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 构建 System Prompt
 */
function buildSystemPrompt(hostname: string, skills: SkillDefinition[]): string {
  const skillList = skills.map((s) => `- **${s.name}** (${s.id}): ${s.description}`).join('\n');

  return `你是一个智能 API 助手（Browser Claw），运行在 ${hostname} 的浏览器环境中。

## 你的能力
你可以通过 Tool Calling 调用以下 API 接口来完成用户的指令：
${skillList}

## 执行规则
1. 分析用户的意图，选择合适的接口调用
2. 如果需要分步骤执行（如先查询再更新），请按照逻辑顺序逐步调用
3. 如果需要批量操作，先查询获取完整列表，再逐个/批量执行更新
4. 对于分页接口，注意检查是否有更多数据需要翻页获取
5. 每次操作完成后，汇总结果向用户报告
6. 当用户想要了解当前页面内容时，优先使用"读取网页内容"功能

## 确认规则（最高优先级）
1. **每次调用接口前，系统会自动向用户展示接口名称、URL、所有参数，等待用户确认后才执行**
2. 你不需要自己向用户请求确认，系统会自动处理确认流程
3. 如果用户拒绝了某次调用，你应该询问用户原因，并根据反馈调整参数或更换方案
4. **注意：内置工具（如读取网页内容）属于安全操作，无需用户确认即可执行**

## 安全规则
1. 对于修改类操作，在展示确认信息时需额外说明操作的影响范围
2. 批量操作超过 20 条时，建议先执行小批量测试
3. 不要猜测参数值，如果信息不足请向用户确认

## 响应格式
- 使用中文回复
- 执行过程中实时汇报进度
- 最终结果以结构化方式呈现（使用表格或列表）`;
}

/**
 * AI Agent 引擎
 * 负责与 LLM 交互、管理对话上下文、处理 Function Calling
 */
export class AgentEngine {
  private openai: OpenAI;
  private config: AgentConfig;
  private skills: SkillDefinition[];
  private hostname: string;

  private confirmationHandler:
    | ((request: ConfirmationRequest) => Promise<boolean>)
    | null = null;

  constructor(
    config: AgentConfig,
    skills: SkillDefinition[],
    hostname: string
  ) {
    this.config = config;
    this.skills = skills;
    this.hostname = hostname;

    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      dangerouslyAllowBrowser: true,
    });
  }

  setConfirmationHandler(
    handler: (request: ConfirmationRequest) => Promise<boolean>
  ) {
    this.confirmationHandler = handler;
  }

  /**
   * 处理用户消息 — 返回事件流
   */
  async *processUserMessage(
    userMessage: string,
    conversationHistory: ChatMessage[]
  ): AsyncGenerator<AgentEvent> {
    const tools = skillsToOpenAITools(this.skills);
    const systemPrompt = buildSystemPrompt(this.hostname, this.skills);

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    const recentHistory = conversationHistory.slice(-20);
    for (const msg of recentHistory) {
      if (msg.role === 'tool') {
        messages.push({
          role: 'tool',
          tool_call_id: msg.toolCallId ?? '',
          content: msg.content,
        });
      } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.skillId,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        });
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: userMessage });

    yield* this.agentLoop(messages, tools);
  }

  private async *agentLoop(
    messages: OpenAI.ChatCompletionMessageParam[],
    tools: OpenAI.ChatCompletionTool[]
  ): AsyncGenerator<AgentEvent> {
    for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
      yield { type: 'llm_call_start' };

      try {
        const stream = await this.openai.chat.completions.create({
          model: this.config.model,
          messages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          stream: true,
        });

        let content = '';
        const toolCalls: ToolCallRaw[] = [];

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            content += delta.content;
            yield { type: 'llm_streaming', content: delta.content };
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = {
                    id: tc.id || '',
                    function: { name: '', arguments: '' },
                  };
                }
                if (tc.id) toolCalls[tc.index].id = tc.id;
                if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
                if (tc.function?.arguments)
                  toolCalls[tc.index].function.arguments += tc.function.arguments;
              }
            }
          }
        }

        if (toolCalls.length === 0) {
          yield { type: 'assistant_message', content };
          yield { type: 'done' };
          return;
        }

        messages.push({
          role: 'assistant',
          content: content || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        });

        if (content) {
          yield { type: 'assistant_message', content };
        }

        for (const toolCall of toolCalls) {
          const result = await this.executeToolCall(toolCall);

          const skill = this.skills.find((s) => s.id === toolCall.function.name);
          const tcDisplay: ToolCallDisplay = {
            id: toolCall.id,
            skillName: skill?.name ?? toolCall.function.name,
            skillId: toolCall.function.name,
            arguments: this.safeParseArgs(toolCall.function.arguments),
            status: result.success ? 'success' : 'error',
            result: result.data,
            error: result.error,
          };

          if (result.rejected) {
            tcDisplay.status = 'rejected';
          }

          yield { type: 'tool_call_result', toolCall: tcDisplay, result: result.data };

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(
              result.success
                ? result.data
                : { error: result.error ?? 'User declined this API call' }
            ),
          });
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        yield { type: 'error', error: errMsg };
        yield { type: 'done' };
        return;
      }
    }

    yield { type: 'error', error: '已达到最大执行步骤限制 (' + MAX_AGENT_ITERATIONS + ')' };
    yield { type: 'done' };
  }

  /**
   * 执行 Tool Call
   * 内置 Skill 走特殊路径（直接通过 Content Script 读取页面内容）
   * 用户自定义 Skill 走 HTTP 请求路径
   */
  private async executeToolCall(
    toolCall: ToolCallRaw
  ): Promise<{ success: boolean; data?: unknown; error?: string; rejected?: boolean }> {
    const skill = this.skills.find((s) => s.id === toolCall.function.name);
    if (!skill) {
      return { success: false, error: `Skill "${toolCall.function.name}" not found` };
    }

    const args = this.safeParseArgs(toolCall.function.arguments);

    // ★ 内置 Skill 特殊处理 — 无需用户确认，直接执行
    if (isBuiltinSkill(toolCall.function.name)) {
      return this.executeBuiltinSkill(toolCall.function.name, args);
    }

    // ★ 用户自定义 Skill — 走 HTTP 请求流程
    const request = buildHttpRequest(skill, args);

    // 强制用户确认
    if (this.confirmationHandler) {
      const confirmPayload: ConfirmationRequest = {
        skillId: skill.id,
        skillName: skill.name,
        skillDescription: skill.description,
        method: request.method,
        url: request.url,
        parameters: args,
        riskLevel: skill.meta.riskLevel || 'safe',
        headers: request.headers,
        body: request.body,
      };

      const confirmed = await this.confirmationHandler(confirmPayload);
      if (!confirmed) {
        return {
          success: false,
          rejected: true,
          error: 'User declined this API call. Ask user for guidance on how to proceed.',
        };
      }
    }

    try {
      const connected = await Messaging.ensureConnected();
      if (!connected) {
        return { success: false, error: 'Content Script not connected. Please make sure the active tab is a regular web page.' };
      }

      const response = await Messaging.executeAPI({
        ...request,
        requestId: toolCall.id,
      });

      if (!response.success) {
        return { success: false, error: response.error || `HTTP ${response.status}` };
      }

      const extracted = applyExtractors(response.data, skill.response.extractors);
      return { success: true, data: extracted };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errMsg };
    }
  }

  /**
   * 执行内置 Skill
   */
  private async executeBuiltinSkill(
    skillId: string,
    args: Record<string, unknown>
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    switch (skillId) {
      case BUILTIN_SKILL_IDS.READ_PAGE_CONTENT: {
        try {
          const connected = await Messaging.ensureConnected();
          if (!connected) {
            return {
              success: false,
              error: 'Content Script not connected. Please make sure the active tab is a regular web page.',
            };
          }

          const result = await Messaging.readPageContent({
            maxLength: typeof args.maxLength === 'number' ? args.maxLength : 15000,
            includeLinks: typeof args.includeLinks === 'boolean' ? args.includeLinks : true,
            includeHeadings: typeof args.includeHeadings === 'boolean' ? args.includeHeadings : true,
          });

          if (!result.success) {
            return { success: false, error: result.error || 'Failed to read page content' };
          }

          return { success: true, data: result };
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          return { success: false, error: errMsg };
        }
      }

      default:
        return { success: false, error: `Unknown builtin skill: ${skillId}` };
    }
  }

  private safeParseArgs(args: string): Record<string, unknown> {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }
}
