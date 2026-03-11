import React, { useState, useEffect } from 'react';
import { Save, Zap, Eye, EyeOff } from 'lucide-react';
import type { AgentConfig } from '@/types';

interface ModelsProps {
  config: AgentConfig;
  onSave: (config: AgentConfig) => Promise<void>;
  onTestConnection: () => Promise<{ success: boolean; error?: string; models?: string[] }>;
}

const Models: React.FC<ModelsProps> = ({ config, onSave, onTestConnection }) => {
  const [form, setForm] = useState<AgentConfig>(config);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(config);
  }, [config]);

  const handleChange = (field: keyof AgentConfig, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // 先保存再测试
      await onSave(form);
      const result = await onTestConnection();
      setTestResult({
        success: result.success,
        message: result.success
          ? `✅ 连接成功！发现 ${result.models?.length ?? 0} 个模型`
          : `❌ 连接失败: ${result.error}`,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: `❌ ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold text-sm flex items-center gap-2">
        🧠 模型配置
      </h2>

      {/* Base URL */}
      <div className="form-control">
        <label className="label py-1">
          <span className="label-text text-xs">Base URL</span>
        </label>
        <input
          type="text"
          className="input input-sm w-full"
          placeholder="https://api.openai.com/v1"
          value={form.baseURL}
          onChange={(e) => handleChange('baseURL', e.target.value)}
        />
        <label className="label py-0.5">
          <span className="label-text-alt text-xs opacity-50">
            支持 OpenAI 兼容的任何 API（如 Ollama, vLLM 等）
          </span>
        </label>
      </div>

      {/* API Key */}
      <div className="form-control">
        <label className="label py-1">
          <span className="label-text text-xs">API Key</span>
        </label>
        <div className="join w-full">
          <input
            type={showKey ? 'text' : 'password'}
            className="input input-sm join-item flex-1"
            placeholder="sk-..."
            value={form.apiKey}
            onChange={(e) => handleChange('apiKey', e.target.value)}
          />
          <button
            className="btn btn-sm join-item btn-ghost"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Model */}
      <div className="form-control">
        <label className="label py-1">
          <span className="label-text text-xs">Model</span>
        </label>
        <input
          type="text"
          className="input input-sm w-full"
          placeholder="gpt-4o"
          value={form.model}
          onChange={(e) => handleChange('model', e.target.value)}
        />
      </div>

      {/* Temperature */}
      <div className="form-control">
        <label className="label py-1">
          <span className="label-text text-xs">Temperature</span>
          <span className="label-text-alt text-xs">{form.temperature}</span>
        </label>
        <input
          type="range"
          className="range range-xs range-primary"
          min={0}
          max={2}
          step={0.1}
          value={form.temperature}
          onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
        />
      </div>

      {/* Max Tokens */}
      <div className="form-control">
        <label className="label py-1">
          <span className="label-text text-xs">Max Tokens</span>
          <span className="label-text-alt text-xs">{form.maxTokens}</span>
        </label>
        <input
          type="range"
          className="range range-xs range-primary"
          min={256}
          max={16384}
          step={256}
          value={form.maxTokens}
          onChange={(e) => handleChange('maxTokens', parseInt(e.target.value))}
        />
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`alert text-xs py-2 ${
            testResult.success ? 'alert-success' : 'alert-error'
          }`}
        >
          {testResult.message}
        </div>
      )}

      {/* Saved indicator */}
      {saved && (
        <div className="alert alert-success text-xs py-1">✅ 配置已保存</div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          className="btn btn-sm btn-primary flex-1"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? '保存中...' : '保存配置'}
        </button>
        <button
          className="btn btn-sm btn-outline flex-1"
          onClick={handleTest}
          disabled={testing || !form.apiKey}
        >
          <Zap className="w-3.5 h-3.5" />
          {testing ? '测试中...' : '测试连接'}
        </button>
      </div>
    </div>
  );
};

export default Models;
