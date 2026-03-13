import {
  AlertCircle,
  Ban,
  Brain,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Sparkles,
  Wifi,
} from "lucide-react";
import { useState } from "react";
import Channels from "@/components/channels";
import Chat from "@/components/chat";
import FAQ from "@/components/FAQ";
import Models from "@/components/models";
import LanguageSwitch from "@/components/shared/LanguageSwitch";
import Skills from "@/components/skills";
import { useChannels } from "@/hooks/useChannels";
import { useContentScript } from "@/hooks/useContentScript";
import { useModel } from "@/hooks/useModel";
import { useSkills } from "@/hooks/useSkills";
import { useI18n } from "@/i18n";

const TAB_IDS = {
  SKILLS: 100 as number,
  HISTORY: 150 as number,
  MODELS: 200 as number,
  CHANNELS: 300 as number,
  FAQ: 400 as number,
};

export default function App() {
  const [activeTab, setActiveTab] = useState(TAB_IDS.HISTORY);
  const { t } = useI18n();

  // ─── Hooks ──────────────────────────────────
  const {
    skills,
    loading: skillsLoading,
    addSkill,
    removeSkill,
    importSkills,
    exportSkills,
  } = useSkills();

  const {
    config,
    loading: modelLoading,
    saveConfig,
    testConnection,
  } = useModel();

  const {
    channels,
    loading: channelsLoading,
    addChannel,
    updateChannel,
    removeChannel,
    toggleChannel,
  } = useChannels();

  const {
    connected,
    pageInfo,
    checking: connectionChecking,
    injectable,
    reconnect,
  } = useContentScript();

  // ─── Derived ────────────────────────────────
  const hostname = pageInfo?.hostname || "";
  const isLoading = skillsLoading || modelLoading || channelsLoading;

  const tabs = [
    {
      id: TAB_IDS.HISTORY,
      label: t("popup.tabs.history"),
      icon: Clock,
      badge: undefined as string | undefined,
    },
    {
      id: TAB_IDS.SKILLS,
      label: t("popup.tabs.skills"),
      icon: Sparkles,
    },
    {
      id: TAB_IDS.MODELS,
      label: t("popup.tabs.models"),
      icon: Brain,
      badge: config.apiKey ? undefined : "!",
    },
    {
      id: TAB_IDS.CHANNELS,
      label: t("popup.tabs.channels"),
      icon: Wifi,
      badge: channels.length > 0 ? String(channels.length) : undefined,
    },
    {
      id: TAB_IDS.FAQ,
      label: t("popup.tabs.faq"),
      icon: Info,
      badge: undefined as string | undefined,
    },
  ];

  // ─── Connection Status UI ────────────────────
  const renderConnectionStatus = () => {
    if (connectionChecking) {
      return (
        <div className="flex items-center gap-2 text-slate-500 text-xs px-2 py-1 rounded-lg bg-slate-100 border border-slate-200">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="truncate">{t("popup.connection.checking")}</span>
        </div>
      );
    }

    if (!injectable) {
      return (
        <div
          className="flex items-center gap-2 text-slate-400 text-xs px-2 py-1 rounded-lg bg-slate-100 cursor-not-allowed border border-slate-200"
          title={t("popup.connection.notInjectableTitle")}
        >
          <Ban className="w-3 h-3" />
          <span className="truncate">
            {t("popup.connection.notInjectable")}
          </span>
        </div>
      );
    }

    if (connected) {
      return (
        <button
          className="flex items-center gap-2 text-cyan-700 text-xs px-2 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 transition-colors w-full border border-cyan-100"
          onClick={reconnect}
          title={t("popup.connection.connectedTitle", {
            hostname: hostname || t("common.unknown"),
          })}
        >
          <CheckCircle2 className="w-3 h-3" />
          <span className="truncate">
            {hostname || t("popup.connection.connected")}
          </span>
        </button>
      );
    }

    return (
      <button
        className="flex items-center gap-2 text-amber-700 text-xs px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors w-full border border-amber-100"
        onClick={reconnect}
        title={t("popup.connection.disconnectedTitle")}
      >
        <AlertCircle className="w-3 h-3" />
        <span className="truncate">{t("popup.connection.disconnected")}</span>
      </button>
    );
  };

  // ─── Render Content ─────────────────────────
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
        </div>
      );
    }

    switch (activeTab) {
      case TAB_IDS.SKILLS:
        return (
          <Skills
            skills={skills}
            hostname={hostname}
            onAdd={addSkill}
            onRemove={removeSkill}
            onImport={importSkills}
            onExport={exportSkills}
          />
        );
      case TAB_IDS.HISTORY:
        return <Chat config={config} skills={skills} hostname={hostname} />;
      case TAB_IDS.MODELS:
        return (
          <Models
            config={config}
            onSave={saveConfig}
            onTestConnection={testConnection}
          />
        );
      case TAB_IDS.CHANNELS:
        return (
          <Channels
            channels={channels}
            onAdd={addChannel}
            onUpdate={updateChannel}
            onRemove={removeChannel}
            onToggle={toggleChannel}
          />
        );
      case TAB_IDS.FAQ:
        return <FAQ />;
      default:
        return null;
    }
  };

  return (
    <div className="w-200 h-150 flex p-4 gap-4 overflow-hidden font-sans text-slate-700">
      {/* ─── Sidebar ───────────────────────── */}
      <div className="w-48 glass-panel rounded-2xl flex flex-col p-4 gap-6 z-10">
        {/* Header */}
        <div className="flex items-center gap-3 px-2">
          <span className="font-bold text-lg bg-clip-text text-transparent bg-linear-to-r from-cyan-600 to-blue-600">
            BrowserClaw
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {tabs.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                  isActive
                    ? "bg-cyan-50 text-cyan-700 shadow-sm border border-cyan-100"
                    : "text-slate-500 hover:text-slate-800 hover:bg-white/60 border border-transparent"
                }`}
              >
                <item.icon
                  className={`w-5 h-5 transition-transform duration-300 ${
                    isActive
                      ? "scale-110 text-cyan-600"
                      : "group-hover:scale-110 text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                <span className="font-medium">{item.label}</span>
                {item.badge && (
                  <span
                    className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${
                      item.badge === "!"
                        ? "bg-red-50 text-red-600 border border-red-100"
                        : "bg-cyan-50 text-cyan-600 border border-cyan-100"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Connection Status */}
        <div className="pt-4 border-t border-slate-200/80">
          {renderConnectionStatus()}
        </div>
        <div className="pt-3">
          <LanguageSwitch />
        </div>
      </div>

      {/* ─── Main Content ──────────────────── */}
      <div className="flex-1 glass-panel rounded-2xl overflow-hidden relative flex flex-col">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="flex-1 overflow-auto relative z-10">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
