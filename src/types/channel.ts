// ============ 频道类型 (外部 IM 连接) ============

/**
 * 频道 = 外部 IM 消息通道配置
 * 支持飞书、QQ、钉钉、Slack、Discord 等平台的 Webhook 接入
 * 用途：接收 IM 消息 → 解析指令 → 调用 Agent 执行 → 回传结果
 */

export type IMPlatform =
  | "feishu"
  | "dingtalk"
  | "wechat_work"
  | "slack"
  | "discord"
  | "custom";

export interface Channel {
  id: string;
  name: string;
  platform: IMPlatform;
  description?: string;
  enabled: boolean;

  /** Webhook URL: 用于接收来自 IM 的消息（入站） */
  webhookUrl?: string;

  /** Bot Webhook URL: 用于向 IM 发送消息（出站） */
  botWebhookUrl?: string;

  /** 认证密钥/Token */
  secret?: string;

  /** 平台特定配置 */
  platformConfig?: Record<string, unknown>;

  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
}

/** IM 平台预设信息 */
export interface IMPlatformInfo {
  id: IMPlatform;
  name: string;
  icon: string;
  color: string;
  description: string;
  fields: IMPlatformField[];
}

export interface IMPlatformField {
  key: string;
  label: string;
  type: "text" | "url" | "password";
  placeholder: string;
  required: boolean;
  helpText?: string;
}
