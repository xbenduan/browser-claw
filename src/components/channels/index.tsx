import React, { useState } from 'react';
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
} from 'lucide-react';
import type { Channel, IMPlatform, IMPlatformInfo, IMPlatformField } from '@/types';

// ============ 平台预设 ============

const PLATFORMS: IMPlatformInfo[] = [
  {
    id: 'feishu',
    name: '飞书',
    icon: '🪶',
    color: '#3370ff',
    description: '通过飞书自定义机器人 Webhook 接入',
    fields: [
      {
        key: 'botWebhookUrl',
        label: 'Bot Webhook URL',
        type: 'url',
        placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx',
        required: true,
        helpText: '飞书群机器人的 Webhook 地址',
      },
      {
        key: 'secret',
        label: '签名校验密钥',
        type: 'password',
        placeholder: '可选，用于消息签名验证',
        required: false,
        helpText: '在飞书机器人安全设置中配置的签名密钥',
      },
    ],
  },
  {
    id: 'dingtalk',
    name: '钉钉',
    icon: '💬',
    color: '#0089ff',
    description: '通过钉钉自定义机器人 Webhook 接入',
    fields: [
      {
        key: 'botWebhookUrl',
        label: 'Bot Webhook URL',
        type: 'url',
        placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=xxx',
        required: true,
        helpText: '钉钉群机器人的 Webhook 地址',
      },
      {
        key: 'secret',
        label: '加签密钥',
        type: 'password',
        placeholder: 'SEC...',
        required: false,
        helpText: '钉钉机器人安全设置中的加签密钥',
      },
    ],
  },
  {
    id: 'wechat_work',
    name: '企业微信',
    icon: '💼',
    color: '#07c160',
    description: '通过企业微信群机器人 Webhook 接入',
    fields: [
      {
        key: 'botWebhookUrl',
        label: 'Bot Webhook URL',
        type: 'url',
        placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
        required: true,
        helpText: '企业微信群机器人的 Webhook 地址',
      },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💜',
    color: '#4a154b',
    description: '通过 Slack Incoming Webhook 接入',
    fields: [
      {
        key: 'botWebhookUrl',
        label: 'Webhook URL',
        type: 'url',
        placeholder: 'https://hooks.slack.com/services/T.../B.../xxx',
        required: true,
        helpText: 'Slack App 的 Incoming Webhook URL',
      },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    color: '#5865f2',
    description: '通过 Discord Webhook 接入',
    fields: [
      {
        key: 'botWebhookUrl',
        label: 'Webhook URL',
        type: 'url',
        placeholder: 'https://discord.com/api/webhooks/xxx/xxx',
        required: true,
        helpText: 'Discord 频道的 Webhook URL',
      },
    ],
  },
  {
    id: 'custom',
    name: '自定义',
    icon: '🔧',
    color: '#6b7280',
    description: '自定义 Webhook 接入，适用于其他 IM 平台',
    fields: [
      {
        key: 'botWebhookUrl',
        label: 'Webhook URL',
        type: 'url',
        placeholder: 'https://your-webhook-endpoint.com/...',
        required: true,
        helpText: '目标服务的 Webhook 地址',
      },
      {
        key: 'secret',
        label: '认证 Token',
        type: 'password',
        placeholder: '可选',
        required: false,
      },
    ],
  },
];

// ============ Props ============

interface ChannelsProps {
  channels: Channel[];
  onAdd: (channel: Omit<Channel, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Channel>;
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
  const [selectedPlatform, setSelectedPlatform] = useState<IMPlatform | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; msg: string } | null>(null);

  const getPlatformInfo = (id: IMPlatform) => PLATFORMS.find((p) => p.id === id)!;

  const resetForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setSelectedPlatform(null);
    setFormValues({});
    setChannelName('');
    setChannelDesc('');
    setError('');
  };

  const startEdit = (channel: Channel) => {
    setEditingId(channel.id);
    setSelectedPlatform(channel.platform);
    setChannelName(channel.name);
    setChannelDesc(channel.description || '');
    setFormValues({
      botWebhookUrl: channel.botWebhookUrl || '',
      secret: channel.secret || '',
      webhookUrl: channel.webhookUrl || '',
    });
    setShowAddForm(true);
  };

  const handleSave = async () => {
    if (!selectedPlatform) return;
    const platform = getPlatformInfo(selectedPlatform);
    const name = channelName.trim() || platform.name;

    // Validate required fields
    for (const field of platform.fields) {
      if (field.required && !formValues[field.key]?.trim()) {
        setError(`${field.label} 不能为空`);
        return;
      }
    }

    setSaving(true);
    setError('');

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
      setError(e instanceof Error ? e.message : '保存失败');
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

      if (platform === 'feishu') {
        body = JSON.stringify({ msg_type: 'text', content: { text: '🦀 Browser Claw 连接测试成功！' } });
      } else if (platform === 'dingtalk') {
        body = JSON.stringify({ msgtype: 'text', text: { content: '🦀 Browser Claw 连接测试成功！' } });
      } else if (platform === 'wechat_work') {
        body = JSON.stringify({ msgtype: 'text', text: { content: '🦀 Browser Claw 连接测试成功！' } });
      } else if (platform === 'slack') {
        body = JSON.stringify({ text: '🦀 Browser Claw 连接测试成功！' });
      } else if (platform === 'discord') {
        body = JSON.stringify({ content: '🦀 Browser Claw 连接测试成功！' });
      } else {
        body = JSON.stringify({ text: '🦀 Browser Claw 连接测试成功！' });
      }

      const resp = await fetch(channel.botWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (resp.ok) {
        setTestResult({ id: channel.id, success: true, msg: '发送成功！请检查 IM 是否收到消息' });
      } else {
        const text = await resp.text();
        setTestResult({ id: channel.id, success: false, msg: `HTTP ${resp.status}: ${text.slice(0, 100)}` });
      }
    } catch (e: unknown) {
      setTestResult({ id: channel.id, success: false, msg: e instanceof Error ? e.message : '请求失败' });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">IM 频道</h2>
          <p className="text-xs text-base-content/50 mt-0.5">
            连接飞书、钉钉等 IM 平台，通过聊天消息触发 Agent 任务
          </p>
        </div>
        <button
          className="btn btn-primary btn-xs"
          onClick={() => { resetForm(); setShowAddForm(true); }}
        >
          <Plus className="w-4 h-4" />
          添加频道
        </button>
      </div>

      {/* ─── Add / Edit Form ─── */}
      {showAddForm && (
        <div className="card bg-base-200 mb-4">
          <div className="card-body p-4 gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {editingId ? '编辑频道' : '新建 IM 频道'}
              </h3>
              <button className="btn btn-ghost btn-xs" onClick={resetForm}>
                <X className="w-3 h-3" />
              </button>
            </div>

            {error && <div className="text-error text-xs">{error}</div>}

            {/* Platform Selection */}
            {!selectedPlatform && !editingId && (
              <div>
                <label className="label py-0.5">
                  <span className="label-text text-xs">选择 IM 平台</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      className="btn btn-ghost btn-xs flex flex-col items-center gap-1 h-auto py-2 border border-base-300"
                      onClick={() => {
                        setSelectedPlatform(p.id);
                        setChannelName(p.name);
                      }}
                    >
                      <span className="text-lg">{p.icon}</span>
                      <span className="text-xs">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Config Form */}
            {selectedPlatform && (
              <>
                <div className="flex items-center gap-2 text-xs text-base-content/60">
                  <span className="text-lg">{getPlatformInfo(selectedPlatform).icon}</span>
                  <span>{getPlatformInfo(selectedPlatform).description}</span>
                  {!editingId && (
                    <button
                      className="btn btn-ghost btn-xs ml-auto"
                      onClick={() => setSelectedPlatform(null)}
                    >
                      更换平台
                    </button>
                  )}
                </div>

                {/* Channel Name */}
                <div className="form-control">
                  <label className="label py-0.5">
                    <span className="label-text text-xs">频道名称</span>
                  </label>
                  <input
                    type="text"
                    className="input input-sm"
                    placeholder={getPlatformInfo(selectedPlatform).name}
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="form-control">
                  <label className="label py-0.5">
                    <span className="label-text text-xs">描述（可选）</span>
                  </label>
                  <input
                    type="text"
                    className="input input-sm"
                    placeholder="例：前端团队群"
                    value={channelDesc}
                    onChange={(e) => setChannelDesc(e.target.value)}
                  />
                </div>

                {/* Platform-specific fields */}
                {getPlatformInfo(selectedPlatform).fields.map((field: IMPlatformField) => (
                  <div key={field.key} className="form-control">
                    <label className="label py-0.5">
                      <span className="label-text text-xs">
                        {field.label}
                        {field.required && <span className="text-error"> *</span>}
                      </span>
                    </label>
                    <input
                      type={field.type === 'password' ? 'password' : 'text'}
                      className="input input-sm font-mono text-xs"
                      placeholder={field.placeholder}
                      value={formValues[field.key] || ''}
                      onChange={(e) =>
                        setFormValues({ ...formValues, [field.key]: e.target.value })
                      }
                    />
                    {field.helpText && (
                      <label className="label py-0">
                        <span className="label-text-alt text-[10px] text-base-content/40">
                          {field.helpText}
                        </span>
                      </label>
                    )}
                  </div>
                ))}

                {/* Actions */}
                <div className="flex justify-end gap-2 mt-2">
                  <button className="btn btn-ghost btn-sm" onClick={resetForm}>
                    取消
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving && <span className="loading loading-spinner loading-xs" />}
                    <Save className="w-3 h-3" />
                    {editingId ? '保存' : '创建'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Channel List ─── */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {channels.length === 0 && !showAddForm && (
          <div className="text-center py-12 text-base-content/40">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无 IM 频道</p>
            <p className="text-xs mt-1">添加频道后，可通过聊天工具远程触发 Agent 任务</p>
          </div>
        )}

        {channels.map((channel) => {
          const platformInfo = PLATFORMS.find((p) => p.id === channel.platform);
          const isExpanded = expandedId === channel.id;

          return (
            <div
              key={channel.id}
              className={`card border transition-colors ${
                channel.enabled
                  ? 'bg-base-200 border-base-300'
                  : 'bg-base-200/50 border-base-300/50 opacity-60'
              }`}
            >
              <div className="card-body p-3">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="text-lg">{platformInfo?.icon || '🔧'}</span>
                  <button
                    className="flex-1 text-left flex items-center gap-1"
                    onClick={() => setExpandedId(isExpanded ? null : channel.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    <span className="font-semibold text-sm">{channel.name}</span>
                  </button>

                  <span
                    className={`badge badge-xs ${channel.enabled ? 'badge-success' : 'badge-outline'}`}
                  >
                    {channel.enabled ? '已启用' : '已停用'}
                  </span>

                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => onToggle(channel.id)}
                    title={channel.enabled ? '停用' : '启用'}
                  >
                    {channel.enabled ? (
                      <Power className="w-3 h-3 text-success" />
                    ) : (
                      <PowerOff className="w-3 h-3" />
                    )}
                  </button>

                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => startEdit(channel)}
                    title="编辑"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>

                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => onRemove(channel.id)}
                    title="删除"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {channel.description && (
                  <p className="text-xs text-base-content/50 ml-7">
                    {channel.description}
                  </p>
                )}

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-2 ml-7 space-y-2.5 text-xs">
                    <div>
                      <span className="text-base-content/50">平台：</span>
                      <span>{platformInfo?.name || channel.platform}</span>
                    </div>

                    {channel.botWebhookUrl && (
                      <div>
                        <span className="text-base-content/50">Webhook：</span>
                        <code className="text-[10px] bg-base-300 px-1 py-0.5 rounded break-all">
                          {channel.botWebhookUrl.slice(0, 50)}
                          {channel.botWebhookUrl.length > 50 ? '...' : ''}
                        </code>
                      </div>
                    )}

                    {channel.secret && (
                      <div>
                        <span className="text-base-content/50">密钥：</span>
                        <span className="text-base-content/30">••••••••</span>
                      </div>
                    )}

                    {/* Test Button */}
                    {channel.botWebhookUrl && (
                      <button
                        className="btn btn-outline btn-xs gap-1"
                        onClick={() => handleTestWebhook(channel)}
                        disabled={testingId === channel.id}
                      >
                        {testingId === channel.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        发送测试消息
                      </button>
                    )}

                    {testResult && testResult.id === channel.id && (
                      <div
                        className={`flex items-center gap-1 text-xs ${
                          testResult.success ? 'text-success' : 'text-error'
                        }`}
                      >
                        {testResult.success ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {testResult.msg}
                      </div>
                    )}

                    <p className="text-[10px] text-base-content/30 pt-1">
                      创建于 {new Date(channel.createdAt).toLocaleDateString()}
                      {channel.lastMessageAt && (
                        <>
                          {' · '}最后消息 {new Date(channel.lastMessageAt).toLocaleDateString()}
                        </>
                      )}
                    </p>
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
