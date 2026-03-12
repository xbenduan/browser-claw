import OpenAI from 'openai';
import type {
  AgentConfig,
  AgentEvent,
  ChatMessage,
  SkillDefinition,
  ConfirmationRequest,
  ConfirmationResult,
  ToolCallDisplay,
} from '@/types';
import { skillsToOpenAITools } from './skill-converter';
import { buildHttpRequest } from './request-builder';
import { applyExtractors } from './response-extractor';
import { Messaging } from '@/utils/messaging';
import { MAX_AGENT_ITERATIONS } from '@/utils/constants';
import { BUILTIN_SKILL_IDS, isBuiltinSkill } from '@/utils/builtin-skills';
import { queryStoredData, storeData } from './data-store';

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

## 大数据处理规则（重要）
当 API 返回大量数据时，系统会自动将完整数据存入 DataStore 并给你一个 **数据指针（pointer）**。
你会看到类似这样的 tool result：
\`\`\`
[STORED DATA — pointer: "ref_xxx_1_abc"]
Size: 45.2K chars | Type: object
Main data: "items" (200 records)
Fields: id, name, email, status, created_at
Sample (first 2):
  {"id": 1, "name": "Alice", ...}
  {"id": 2, "name": "Bob", ...}
[Use query_stored_data with pointer="ref_xxx_1_abc" to retrieve, filter, slice, or project fields from this data]
\`\`\`

此时你应该：
1. **先根据摘要信息理解数据结构**（有多少条记录、有哪些字段、有无分页）
2. **用 query_stored_data 工具按需查询**，而不是一次取出所有数据
3. 利用 filter（过滤）、fields（投影）、offset/limit（分页）缩小返回范围
4. 如果用户需要整理/统计所有数据，可以分批查询（每批 limit=50）然后合并结果

**注意：数据指针中的完整数据没有任何丢失，只是不直接放入对话上下文以节省 token。你随时可以通过 query_stored_data 访问全部原始数据。**

## 确认规则（最高优先级）
1. **每次调用接口前，系统会自动向用户展示接口名称、URL、所有参数，等待用户确认后才执行**
2. 你不需要自己向用户请求确认，系统会自动处理确认流程
3. 如果用户拒绝了某次调用，你应该询问用户原因，并根据反馈调整参数或更换方案
4. **用户可以在确认前通过聊天或手动编辑修改参数，系统会使用修改后的参数执行调用**
5. **注意：内置工具（如读取网页内容、查询存储数据）属于安全操作，无需用户确认即可执行**

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
  private abortController: AbortController | null = null;

  private confirmationHandler:
    | ((request: ConfirmationRequest) => Promise<ConfirmationResult>)
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
    handler: (request: ConfirmationRequest) => Promise<ConfirmationResult>
  ) {
    this.confirmationHandler = handler;
  }

  /**
   * 中止当前正在运行的 agent 流程
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
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
    // 每次 agentLoop 创建新的 AbortController
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
      // 检查是否已被中止
      if (signal.aborted) {
        yield { type: 'error', error: '已暂停执行' };
        yield { type: 'done' };
        return;
      }

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
          // 在流式读取中检查中止
          if (signal.aborted) {
            yield { type: 'error', error: '已暂停执行' };
            yield { type: 'done' };
            return;
          }

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
          // 检查中止
          if (signal.aborted) {
            yield { type: 'error', error: '已暂停执行' };
            yield { type: 'done' };
            return;
          }

          const result = await this.executeToolCall(toolCall);

          const skill = this.skills.find((s) => s.id === toolCall.function.name);
          const tcDisplay: ToolCallDisplay = {
            id: toolCall.id,
            skillName: skill?.name ?? toolCall.function.name,
            skillId: toolCall.function.name,
            arguments: result.executedArgs ?? this.safeParseArgs(toolCall.function.arguments),
            status: result.success ? 'success' : 'error',
            result: result.data,
            error: result.error,
          };

          if (result.rejected) {
            tcDisplay.status = 'rejected';
          }

          yield { type: 'tool_call_result', toolCall: tcDisplay, result: result.data };

          // ★ 将 tool result 写入 messages
          // 如果用户修改了参数，也需要把修改信息带入上下文
          const toolResultContent: Record<string, unknown> = result.success
            ? (result.data as Record<string, unknown>)
            : { error: result.error ?? 'User declined this API call' };

          if (result.parameterModified) {
            toolResultContent._note = 'User modified parameters before execution';
            toolResultContent._modifiedParameters = result.executedArgs;
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResultContent),
          });
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        // 如果是 abort 导致的错误，给出更友好的提示
        if (signal.aborted) {
          yield { type: 'error', error: '已暂停执行' };
        } else {
          yield { type: 'error', error: errMsg };
        }
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
  ): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
    rejected?: boolean;
    parameterModified?: boolean;
    executedArgs?: Record<string, unknown>;
  }> {
    const skill = this.skills.find((s) => s.id === toolCall.function.name);
    if (!skill) {
      return { success: false, error: `Skill "${toolCall.function.name}" not found` };
    }

    let args = this.safeParseArgs(toolCall.function.arguments);

    // ★ 内置 Skill 特殊处理 — 无需用户确认，直接执行
    if (isBuiltinSkill(toolCall.function.name)) {
      return this.executeBuiltinSkill(toolCall.function.name, args);
    }

    // ★ 用户自定义 Skill — 走 HTTP 请求流程
    // 强制用户确认（支持参数修改）
    if (this.confirmationHandler) {
      const confirmPayload: ConfirmationRequest = {
        skillId: skill.id,
        skillName: skill.name,
        skillDescription: skill.description,
        method: skill.api.method,
        url: buildHttpRequest(skill, args).url,
        parameters: args,
        riskLevel: skill.meta.riskLevel || 'safe',
        headers: skill.api.headers,
        body: buildHttpRequest(skill, args).body,
      };

      const result = await this.confirmationHandler(confirmPayload);

      if (!result.confirmed) {
        return {
          success: false,
          rejected: true,
          error: 'User declined this API call. Ask user for guidance on how to proceed.',
        };
      }

      // ★ 如果用户修改了参数，使用修改后的参数
      let parameterModified = false;
      if (result.modifiedParameters) {
        args = result.modifiedParameters;
        parameterModified = true;
      }

      // 用（可能被修改过的）参数构建请求
      const request = buildHttpRequest(skill, args);

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

        const extracted = applyExtractors(
          response.data,
          skill.response.extractors,
          skill.id,
          args
        );
        return {
          success: true,
          data: extracted,
          parameterModified,
          executedArgs: args,
        };
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        return { success: false, error: errMsg };
      }
    }

    // 无确认处理器时直接执行（兜底）
    const request = buildHttpRequest(skill, args);
    try {
      const connected = await Messaging.ensureConnected();
      if (!connected) {
        return { success: false, error: 'Content Script not connected.' };
      }
      const response = await Messaging.executeAPI({
        ...request,
        requestId: toolCall.id,
      });
      if (!response.success) {
        return { success: false, error: response.error || `HTTP ${response.status}` };
      }
      const extracted = applyExtractors(
        response.data,
        skill.response.extractors,
        skill.id,
        args
      );
      return { success: true, data: extracted, executedArgs: args };
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

      case BUILTIN_SKILL_IDS.QUERY_STORED_DATA: {
        // ★ 查询 DataStore 中的数据
        const pointer = args.pointer as string;
        if (!pointer) {
          return { success: false, error: 'Missing required parameter: pointer' };
        }

        const queryResult = queryStoredData(pointer, {
          path: args.path as string | undefined,
          offset: typeof args.offset === 'number' ? args.offset : undefined,
          limit: typeof args.limit === 'number' ? args.limit : undefined,
          filter: args.filter as Record<string, unknown> | undefined,
          fields: Array.isArray(args.fields) ? args.fields as string[] : undefined,
        });

        if (!queryResult.success) {
          return { success: false, error: queryResult.error };
        }

        // 查询结果本身如果还是很大，也需要存入 DataStore
        const resultStr = JSON.stringify(queryResult.data);
        if (resultStr && resultStr.length > 8000) {
          const { pointer: newPointer, contextMessage } = storeData(
            queryResult.data,
            `query_result_of_${pointer}`,
            args
          );
          return {
            success: true,
            data: {
              _data_pointer: newPointer,
              _summary: contextMessage,
              _query_meta: queryResult.meta,
            },
          };
        }

        return {
          success: true,
          data: {
            result: queryResult.data,
            meta: queryResult.meta,
          },
        };
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
