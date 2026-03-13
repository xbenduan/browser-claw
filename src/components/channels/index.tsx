import React, { useMemo, useState } from "react";
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
import { useI18n } from "@/i18n";

// ============ 平台预设 ============

const getPlatforms = (
  t: (key: string, vars?: Record<string, string | number>) => string,
): IMPlatformInfo[] => [
  {
    id: "feishu",
    name: t("channels.platforms.feishu.name"),
    icon: "🪶",
    color: "#3370ff",
    description: t("channels.platforms.feishu.description"),
    fields: [
      {
        key: "botWebhookUrl",
        label: t("channels.fields.botWebhookUrl.label"),
        type: "url",
        placeholder: t("channels.platforms.feishu.botWebhookUrlPlaceholder"),
        required: true,
        helpText: t("channels.platforms.feishu.botWebhookUrlHelp"),
      },
      {
        key: "secret",
        label: t("channels.platforms.feishu.secretLabel"),
        type: "password",
        placeholder: t("channels.platforms.feishu.secretPlaceholder"),
        required: false,
        helpText: t("channels.platforms.feishu.secretHelp"),
      },
    ],
  },
  {
    id: "dingtalk",
    name: t("channels.platforms.dingtalk.name"),
    icon: "💬",
    color: "#0089ff",
    description: t("channels.platforms.dingtalk.description"),
    fields: [
      {
        key: "botWebhookUrl",
        label: t("channels.fields.botWebhookUrl.label"),
        type: "url",
        placeholder: t("channels.platforms.dingtalk.botWebhookUrlPlaceholder"),
        required: true,
        helpText: t("channels.platforms.dingtalk.botWebhookUrlHelp"),
      },
      {
        key: "secret",
        label: t("channels.platforms.dingtalk.secretLabel"),
        type: "password",
        placeholder: t("channels.platforms.dingtalk.secretPlaceholder"),
        required: false,
        helpText: t("channels.platforms.dingtalk.secretHelp"),
      },
    ],
  },
  {
    id: "wechat_work",
    name: t("channels.platforms.wechat_work.name"),
    icon: "💼",
    color: "#07c160",
    description: t("channels.platforms.wechat_work.description"),
    fields: [
      {
        key: "botWebhookUrl",
        label: t("channels.fields.botWebhookUrl.label"),
        type: "url",
        placeholder: t(
          "channels.platforms.wechat_work.botWebhookUrlPlaceholder",
        ),
        required: true,
        helpText: t("channels.platforms.wechat_work.botWebhookUrlHelp"),
      },
    ],
  },
  {
    id: "slack",
    name: t("channels.platforms.slack.name"),
    icon: "💜",
    color: "#4a154b",
    description: t("channels.platforms.slack.description"),
    fields: [
      {
        key: "botWebhookUrl",
        label: t("channels.fields.webhookUrl.label"),
        type: "url",
        placeholder: t("channels.platforms.slack.botWebhookUrlPlaceholder"),
        required: true,
        helpText: t("channels.platforms.slack.botWebhookUrlHelp"),
      },
    ],
  },
  {
    id: "discord",
    name: t("channels.platforms.discord.name"),
    icon: "🎮",
    color: "#5865f2",
    description: t("channels.platforms.discord.description"),
    fields: [
      {
        key: "botWebhookUrl",
        label: t("channels.fields.webhookUrl.label"),
        type: "url",
        placeholder: t("channels.platforms.discord.botWebhookUrlPlaceholder"),
        required: true,
        helpText: t("channels.platforms.discord.botWebhookUrlHelp"),
      },
    ],
  },
  {
    id: "custom",
    name: t("channels.platforms.custom.name"),
    icon: "🔧",
    color: "#6b7280",
    description: t("channels.platforms.custom.description"),
    fields: [
      {
        key: "botWebhookUrl",
        label: t("channels.fields.webhookUrl.label"),
        type: "url",
        placeholder: t("channels.platforms.custom.botWebhookUrlPlaceholder"),
        required: true,
        helpText: t("channels.platforms.custom.botWebhookUrlHelp"),
      },
      {
        key: "secret",
        label: t("channels.platforms.custom.secretLabel"),
        type: "password",
        placeholder: t("channels.platforms.custom.secretPlaceholder"),
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
  const { t } = useI18n();
  const platforms = useMemo(() => getPlatforms(t), [t]);
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
    platforms.find((p) => p.id === id)!;

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
        setError(t("channels.fieldRequired", { label: field.label }));
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
      setError(e instanceof Error ? e.message : t("channels.saveFailed"));
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
          content: { text: t("channels.testContent") },
        });
      } else if (platform === "dingtalk") {
        body = JSON.stringify({
          msgtype: "text",
          text: { content: t("channels.testContent") },
        });
      } else if (platform === "wechat_work") {
        body = JSON.stringify({
          msgtype: "text",
          text: { content: t("channels.testContent") },
        });
      } else if (platform === "slack") {
        body = JSON.stringify({ text: t("channels.testContent") });
      } else if (platform === "discord") {
        body = JSON.stringify({ content: t("channels.testContent") });
      } else {
        body = JSON.stringify({ text: t("channels.testContent") });
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
          msg: t("channels.testSuccess"),
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
        msg: e instanceof Error ? e.message : t("channels.testFailed"),
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
            <h2 className="font-semibold text-lg text-slate-800">
              {t("channels.title")}
            </h2>
            <p className="text-xs text-slate-500">{t("channels.subtitle")}</p>
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
          {t("channels.addChannel")}
        </button>
      </div>

      {/* ─── Add / Edit Form ─── */}
      {showAddForm && (
        <div className="glass-panel p-4 mb-6 rounded-xl animate-in fade-in slide-in-from-top-4 border-l-4 border-l-violet-500">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
            <h3 className="font-semibold text-sm text-slate-800">
              {editingId ? t("channels.editChannel") : t("channels.newChannel")}
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
                  {t("channels.platformSelect")}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {platforms.map((p) => (
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
                      {t("channels.switchPlatform")}
                    </button>
                  )}
                </div>

                {/* Channel Name */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">
                    {t("channels.channelName")}
                  </label>
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
                  <label className="text-xs text-slate-500">
                    {t("channels.descriptionOptional")}
                  </label>
                  <input
                    type="text"
                    className="glass-input w-full px-3 py-1.5 text-xs"
                    placeholder={t("channels.descriptionPlaceholder")}
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
                    {t("channels.cancel")}
                  </button>
                  <button
                    className="glass-button-primary text-xs px-4"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    <Save className="w-3 h-3" />
                    {editingId ? t("channels.save") : t("channels.create")}
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
            <p className="text-sm text-slate-500 mb-1">
              {t("channels.noChannels")}
            </p>
            <p className="text-xs text-slate-400">
              {t("channels.noChannelsDesc")}
            </p>
          </div>
        )}

        {channels.map((channel) => {
          const platformInfo = platforms.find((p) => p.id === channel.platform);
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
                    {channel.enabled
                      ? t("channels.enabled")
                      : t("channels.disabled")}
                  </span>

                  <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
                    <button
                      className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${
                        channel.enabled ? "text-green-600" : "text-slate-400"
                      }`}
                      onClick={() => onToggle(channel.id)}
                      title={
                        channel.enabled
                          ? t("channels.disable")
                          : t("channels.enable")
                      }
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
                      title={t("channels.edit")}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
                      onClick={() => onRemove(channel.id)}
                      title={t("channels.delete")}
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
                          {t("channels.platform")}
                        </span>
                        <span className="text-slate-700">
                          {platformInfo?.name || channel.platform}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block mb-0.5">
                          {t("channels.createdAt")}
                        </span>
                        <span className="text-slate-700">
                          {new Date(channel.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {channel.botWebhookUrl && (
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 text-xs block mb-1">
                          {t("channels.fields.webhookUrl.label")}
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
                          {t("channels.testMessage")}
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
