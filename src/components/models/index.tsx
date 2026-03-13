import React, { useState, useEffect } from "react";
import {
  Save,
  Zap,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Server,
  Key,
  Box,
  Thermometer,
  Maximize2,
} from "lucide-react";
import type { AgentConfig } from "@/types";
import { useI18n } from "@/i18n";

interface ModelsProps {
  config: AgentConfig;
  onSave: (config: AgentConfig) => Promise<void>;
  onTestConnection: () => Promise<{
    success: boolean;
    error?: string;
    models?: string[];
  }>;
}

const Models: React.FC<ModelsProps> = ({
  config,
  onSave,
  onTestConnection,
}) => {
  const { t } = useI18n();
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
    setTestResult(null);
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
      await onSave(form);
      const result = await onTestConnection();
      setTestResult({
        success: result.success,
        message: result.success
          ? t("models.testSuccess", { count: result.models?.length ?? 0 })
          : t("models.testFailed", { error: result.error ?? "" }),
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: `${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 font-sans text-slate-700">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600">
          <Server className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-lg text-slate-800">
            {t("models.title")}
          </h2>
          <p className="text-xs text-slate-500">{t("models.subtitle")}</p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl space-y-5">
        {/* Base URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-cyan-600" />
            {t("models.baseUrl")}
          </label>
          <input
            type="text"
            className="glass-input w-full px-4 py-2.5 text-sm"
            placeholder="https://api.openai.com/v1"
            value={form.baseURL}
            onChange={(e) => handleChange("baseURL", e.target.value)}
          />
          <p className="text-[10px] text-slate-400 pl-1">
            {t("models.baseUrlHint")}
          </p>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-amber-600" />
            {t("models.apiKey")}
          </label>
          <div className="relative group">
            <input
              type={showKey ? "text" : "password"}
              className="glass-input w-full px-4 py-2.5 text-sm pr-10"
              placeholder="sk-..."
              value={form.apiKey}
              onChange={(e) => handleChange("apiKey", e.target.value)}
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Model Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <Box className="w-3.5 h-3.5 text-purple-600" />
            {t("models.modelName")}
          </label>
          <input
            type="text"
            className="glass-input w-full px-4 py-2.5 text-sm"
            placeholder="gpt-4o"
            value={form.model}
            onChange={(e) => handleChange("model", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Temperature */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Thermometer className="w-3.5 h-3.5 text-red-500" />
              {t("models.temperature")}
            </label>
            <div className="glass-input w-full px-4 py-3 flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                value={form.temperature ?? 0.7}
                onChange={(e) =>
                  handleChange("temperature", parseFloat(e.target.value))
                }
              />
              <span className="text-xs font-mono text-slate-500 w-8 text-right font-medium">
                {form.temperature ?? 0.7}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {t("models.temperatureHint")}
            </p>
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Maximize2 className="w-3.5 h-3.5 text-blue-500" />
              {t("models.maxTokens")}
            </label>
            <input
              type="number"
              className="glass-input w-full px-4 py-2.5 text-sm"
              placeholder="4096"
              value={form.maxTokens ?? 4096}
              onChange={(e) =>
                handleChange("maxTokens", parseInt(e.target.value))
              }
            />
            <p className="text-[10px] text-slate-400">
              {t("models.maxTokensHint")}
            </p>
          </div>
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`p-3 rounded-xl border flex items-start gap-3 text-sm animate-in fade-in slide-in-from-top-2 ${
            testResult.success
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          )}
          <span className="leading-relaxed">{testResult.message}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          className={`flex-1 glass-button-primary justify-center ${
            saved ? "bg-green-50 text-green-700 border-green-200" : ""
          }`}
          onClick={handleSave}
          disabled={saving || testing}
        >
          {saving ? (
            t("models.saving")
          ) : saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" /> {t("models.saved")}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> {t("models.saveConfig")}
            </>
          )}
        </button>

        <button
          className="flex-1 glass-button text-slate-600 hover:text-slate-900 justify-center"
          onClick={handleTest}
          disabled={saving || testing}
        >
          {testing ? (
            t("models.testing")
          ) : (
            <>
              <Zap className="w-4 h-4 text-yellow-600" /> {t("models.test")}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Models;
