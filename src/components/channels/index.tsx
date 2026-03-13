import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Power,
  PowerOff,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Hash,
} from "lucide-react";
import type {
  Channel,
  IMPlatform,
  IMPlatformInfo,
  IMPlatformField,
} from "@/types";

// ============ 平台预设 ============

const PLATFORMS: IMPlatformInfo[] = [
  {
    id: "feishu",
    name: "飞书",
    icon: "🪶",
    color: "#3370ff",
    description: "通过飞书自定义机器人 Webhook 接入",
    fields: [
      {
        key: "botWebhookUrl",
        label: "Bot Webhook URL",
        type: "url",
        placeholder: "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
        required: true,
        helpText: "飞书群机器人的 Webhook 地址",
      },
      {
        key: "secret",
        label: "签名校验密钥",
        type: "password",
        placeholder: "可选，用于消息签名验证",
        required: false,
        helpText: "在飞书机器人安全设置中配置的签名密钥",
      },
    ],
  },
  {
    id: "dingtalk",
    name: "钉钉",
    icon: "💬",
    color: "#0089ff",
    description: "通过钉钉自定义机器人 Webhook 接入",
    fields: [
      {
        key: "botWebhookUrl",
        label: "Bot Webhook URL",
        type: "url",
        placeholder: "https://oapi.dingtalk.com/robot/send?access_token=xxx",
        required: true,
        helpText: "钉钉群机器人的 Webhook 地址",
      },
      {
        key: "secret",
        label: "加签密钥",
        type: "password",
        placeholder: "SEC...",
        required: false,
        helpText: "钉钉机器人安全设置中的加签密钥",
      },
    ],
  },
  {
    id: "wechat_work",
    name: "企业微信",
    icon: "💼",
    color: "#07c160",
    description: "通过企业微信群机器人 Webhook 接入",
    fields: [
      {
        key: "botWebhookUrl",
        label: "Bot Webhook URL",
        type: "url",
        placeholder: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx",
        required: true,
        helpText: "企业微信群机器人的 Webhook 地址",
      },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    icon: "💜",
    color: "#4a154b",
    description: "通过 Slack Incoming Webhook 接入",
    fields: [
      {
        key: "botWebhookUrl",
        label: "Webhook URL",
        type: "url",
        placeholder: "https://hooks.slack.com/services/T.../B.../xxx",
        required: true,
        helpText: "Slack App 的 Incoming Webhook URL",
      },
    ],
  },
  {
    id: "discord",
    name: "Discord",
    icon: "🎮",
    color: "#5865f2",
    description: "通过 Discord Webhook 接入",
    fields: [
      {
        key: "botWebhookUrl",
        label: "Webhook URL",
        type: "url",
        placeholder: "https://discord.com/api/webhooks/xxx/xxx",
        required: true,
        helpText: "Discord 频道的 Webhook URL",
      },
    ],
  },
  {
    id: "custom",
    name: "自定义",
    icon: "🔧",
    color: "#6b7280",
    description: "自定义 Webhook 接入，适用于其他 IM 平台",
    fields: [
      {
        key: "botWebhookUrl",
        label: "Webhook URL",
        type: "url",
        placeholder: "https://your-webhook-endpoint.com/...",
        required: true,
        helpText: "目标服务的 Webhook 地址",
      },
      {
        key: "secret",
        label: "认证 Token",
        type: "password",
        placeholder: "可选",
        required: false,
      },
    ],
  },
];

// ============ Props ============

interface ChannelsProps {
  channels: Channel[];
  onAdd: (
    channel: Omit<Channel, "id" | "createdAt" | "updatedAt">,
  ) => Promise<Channel>;
  onUpdate: (id: string, updates: Partial<Channel>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onToggle: (id: string) => Promise<void>;
}

// ============ Component ============

const Channels: React.FC<ChannelsProps> = ({
  channels,
  onAdd,
  onUpdate,
  onRemove,
  onToggle,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<IMPlatform | null>(
    null,
  );
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [channelName, setChannelName] = useState("");
  const [channelDesc, setChannelDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    msg: string;
  } | null>(null);

  const getPlatformInfo = (id: IMPlatform) =>
    PLATFORMS.find((p) => p.id === id)!;

  const resetForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setSelectedPlatform(null);
    setFormValues({});
    setChannelName("");
    setChannelDesc("");
    setError("");
  };

  const startEdit = (channel: Channel) => {
    setEditingId(channel.id);
    setSelectedPlatform(channel.platform);
    setChannelName(channel.name);
    setChannelDesc(channel.description || "");
    setFormValues({
      botWebhookUrl: channel.botWebhookUrl || "",
      secret: channel.secret || "",
      webhookUrl: channel.webhookUrl || "",
    });
    setShowAddForm(true);
  };

  const handleSave = async () => {
    if (!selectedPlatform) return;
    const platform = getPlatformInfo(selectedPlatform);
    const name = channelName.trim() || platform.name;

    for (const field of platform.fields) {
      if (field.required && !formValues[field.key]?.trim()) {
        setError(`${field.label} 不能为空`);
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      const data = {
        name,
        platform: selectedPlatform,
        description: channelDesc.trim() || undefined,
        enabled: true,
        botWebhookUrl: formValues.botWebhookUrl?.trim() || undefined,
        webhookUrl: formValues.webhookUrl?.trim() || undefined,
        secret: formValues.secret?.trim() || undefined,
      };

      if (editingId) {
        await onUpdate(editingId, data);
      } else {
        await onAdd(data);
      }
      resetForm();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async (channel: Channel) => {
    if (!channel.botWebhookUrl) return;
    setTestingId(channel.id);
    setTestResult(null);

    try {
      const platform = channel.platform;
      let body: string;

      if (platform === "feishu") {
        body = JSON.stringify({
          msg_type: "text",
          content: { text: "🦀 Browser Claw 连接测试成功！" },
        });
      } else if (platform === "dingtalk") {
        body = JSON.stringify({
          msgtype: "text",
          text: { content: "🦀 Browser Claw 连接测试成功！" },
        });
      } else if (platform === "wechat_work") {
        body = JSON.stringify({
          msgtype: "text",
          text: { content: "🦀 Browser Claw 连接测试成功！" },
        });
      } else if (platform === "slack") {
        body = JSON.stringify({ text: "🦀 Browser Claw 连接测试成功！" });
      } else if (platform === "discord") {
        body = JSON.stringify({ content: "🦀 Browser Claw 连接测试成功！" });
      } else {
        body = JSON.stringify({ text: "🦀 Browser Claw 连接测试成功！" });
      }

      const resp = await fetch(channel.botWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (resp.ok) {
        setTestResult({
          id: channel.id,
          success: true,
          msg: "发送成功！请检查 IM 是否收到消息",
        });
      } else {
        const text = await resp.text();
        setTestResult({
          id: channel.id,
          success: false,
          msg: `HTTP ${resp.status}: ${text.slice(0, 100)}`,
        });
      }
    } catch (e: unknown) {
      setTestResult({
        id: channel.id,
        success: false,
        msg: e instanceof Error ? e.message : "请求失败",
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col font-sans text-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-800">IM 频道</h2>
            <p className="text-xs text-slate-500">连接飞书、钉钉等 IM 平台</p>
          </div>
        </div>
        <button
          className="glass-button-primary text-xs px-3 py-1.5 h-8"
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          添加频道
        </button>
      </div>

      {/* ─── Add / Edit Form ─── */}
      {showAddForm && (
        <div className="glass-panel p-4 mb-6 rounded-xl animate-in fade-in slide-in-from-top-4 border-l-4 border-l-violet-500">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
            <h3 className="font-semibold text-sm text-slate-800">
              {editingId ? "编辑频道" : "新建 IM 频道"}
            </h3>
            <button
              className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
              onClick={resetForm}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-2 rounded bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Platform Selection */}
            {!selectedPlatform && !editingId && (
              <div>
                <label className="text-xs text-slate-500 mb-2 block">
                  选择 IM 平台
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      className="glass-button flex-col items-center gap-2 h-auto py-3 hover:border-violet-300 hover:bg-violet-50 cursor-pointer"
                      onClick={() => {
                        setSelectedPlatform(p.id);
                        setChannelName(p.name);
                      }}
                    >
                      <span className="text-xl filter drop-shadow-lg">
                        {p.icon}
                      </span>
                      <span className="text-xs">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Config Form */}
            {selectedPlatform && (
              <>
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-lg">
                    {getPlatformInfo(selectedPlatform).icon}
                  </span>
                  <span>{getPlatformInfo(selectedPlatform).description}</span>
                  {!editingId && (
                    <button
                      className="text-violet-600 hover:text-violet-500 ml-auto hover:underline cursor-pointer"
                      onClick={() => setSelectedPlatform(null)}
                    >
                      更换平台
                    </button>
                  )}
                </div>

                {/* Channel Name */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">频道名称</label>
                  <input
                    type="text"
                    className="glass-input w-full px-3 py-1.5 text-xs"
                    placeholder={getPlatformInfo(selectedPlatform).name}
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">描述（可选）</label>
                  <input
                    type="text"
                    className="glass-input w-full px-3 py-1.5 text-xs"
                    placeholder="例：前端团队群"
                    value={channelDesc}
                    onChange={(e) => setChannelDesc(e.target.value)}
                  />
                </div>

                {/* Platform-specific fields */}
                {getPlatformInfo(selectedPlatform).fields.map(
                  (field: IMPlatformField) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-xs text-slate-500 flex items-center gap-1">
                        {field.label}
                        {field.required && (
                          <span className="text-red-500">*</span>
                        )}
                      </label>
                      <input
                        type={field.type === "password" ? "password" : "text"}
                        className="glass-input w-full px-3 py-1.5 text-xs font-mono"
                        placeholder={field.placeholder}
                        value={formValues[field.key] || ""}
                        onChange={(e) =>
                          setFormValues({
                            ...formValues,
                            [field.key]: e.target.value,
                          })
                        }
                      />
                      {field.helpText && (
                        <p className="text-[10px] text-slate-400">
                          {field.helpText}
                        </p>
                      )}
                    </div>
                  ),
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-4 pt-2 border-t border-slate-200">
                  <button
                    className="glass-button text-xs text-slate-500 hover:text-slate-800"
                    onClick={resetForm}
                  >
                    取消
                  </button>
                  <button
                    className="glass-button-primary text-xs px-4"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    <Save className="w-3 h-3" />
                    {editingId ? "保存" : "创建"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Channel List ─── */}
      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar px-2 py-2">
        {channels.length === 0 && !showAddForm && (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 border border-slate-200 shadow-sm">
              <MessageCircle className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 mb-1">暂无 IM 频道</p>
            <p className="text-xs text-slate-400">
              添加频道后，可通过聊天工具远程触发 Agent 任务
            </p>
          </div>
        )}

        {channels.map((channel) => {
          const platformInfo = PLATFORMS.find((p) => p.id === channel.platform);
          const isExpanded = expandedId === channel.id;

          return (
            <div
              key={channel.id}
              className={`glass-card transition-all duration-200 border ${
                channel.enabled
                  ? "bg-white border-slate-200 hover:bg-white/90 hover:border-slate-300"
                  : "bg-slate-50 border-slate-200 opacity-60 grayscale"
              }`}
            >
              <div className="p-3">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <span className="text-xl filter drop-shadow-md">
                    {platformInfo?.icon || "🔧"}
                  </span>

                  <button
                    className="flex-1 text-left flex items-center gap-2 group cursor-pointer"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : channel.id)
                    }
                  >
                    <span className="font-semibold text-sm text-slate-800 group-hover:text-violet-600 transition-colors">
                      {channel.name}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    )}
                  </button>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] border ${
                      channel.enabled
                        ? "bg-green-50 text-green-600 border-green-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    {channel.enabled ? "已启用" : "已停用"}
                  </span>

                  <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
                    <button
                      className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${
                        channel.enabled ? "text-green-600" : "text-slate-400"
                      }`}
                      onClick={() => onToggle(channel.id)}
                      title={channel.enabled ? "停用" : "启用"}
                    >
                      {channel.enabled ? (
                        <Power className="w-3.5 h-3.5" />
                      ) : (
                        <PowerOff className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => startEdit(channel)}
                      title="编辑"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
                      onClick={() => onRemove(channel.id)}
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {channel.description && (
                  <p className="text-xs text-slate-500 ml-9 mt-1 truncate">
                    {channel.description}
                  </p>
                )}

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 ml-9 space-y-3 pt-3 border-t border-slate-200 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block mb-0.5">
                          平台
                        </span>
                        <span className="text-slate-700">
                          {platformInfo?.name || channel.platform}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block mb-0.5">
                          创建时间
                        </span>
                        <span className="text-slate-700">
                          {new Date(channel.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {channel.botWebhookUrl && (
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 text-xs block mb-1">
                          Webhook URL
                        </span>
                        <code className="text-[10px] text-slate-600 break-all font-mono block bg-white p-1.5 rounded border border-slate-100">
                          {channel.botWebhookUrl}
                        </code>
                      </div>
                    )}

                    {/* Test Button */}
                    {channel.botWebhookUrl && (
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          className="glass-button text-xs py-1.5 px-3"
                          onClick={() => handleTestWebhook(channel)}
                          disabled={testingId === channel.id}
                        >
                          {testingId === channel.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3 text-violet-600" />
                          )}
                          发送测试消息
                        </button>

                        {testResult && testResult.id === channel.id && (
                          <div
                            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${
                              testResult.success
                                ? "bg-green-50 text-green-600 border-green-200"
                                : "bg-red-50 text-red-600 border-red-200"
                            }`}
                          >
                            {testResult.success ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5" />
                            )}
                            {testResult.msg}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Channels;
