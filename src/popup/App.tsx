import { useState } from 'react';
import {
  Sparkles,
  Brain,
  Wifi,
  Info,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Ban,
} from 'lucide-react';
import Skills from '@/components/skills';
import Chat from '@/components/chat';
import Models from '@/components/models';
import Channels from '@/components/channels';
import FAQ from '@/components/FAQ';

import { useSkills } from '@/hooks/useSkills';
import { useModel } from '@/hooks/useModel';
import { useChannels } from '@/hooks/useChannels';
import { useContentScript } from '@/hooks/useContentScript';

const TAB_IDS = {
  SKILLS: 100 as number,
  HISTORY: 150 as number,
  MODELS: 200 as number,
  CHANNELS: 300 as number,
  FAQ: 400 as number,
};

export default function App() {
  const [activeTab, setActiveTab] = useState(TAB_IDS.HISTORY);

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
  const hostname = pageInfo?.hostname || '';
  const isLoading = skillsLoading || modelLoading || channelsLoading;

  const tabs = [
    {
      id: TAB_IDS.HISTORY,
      label: '历史',
      icon: Clock,
      badge: undefined as string | undefined,
    },
    {
      id: TAB_IDS.SKILLS,
      label: '能力',
      icon: Sparkles,
    },
    {
      id: TAB_IDS.MODELS,
      label: '模型',
      icon: Brain,
      badge: config.apiKey ? undefined : '!',
    },
    {
      id: TAB_IDS.CHANNELS,
      label: '频道',
      icon: Wifi,
      badge: channels.length > 0 ? String(channels.length) : undefined,
    },
    {
      id: TAB_IDS.FAQ,
      label: '关于',
      icon: Info,
      badge: undefined as string | undefined,
    },
  ];

  // ─── Connection Status UI ────────────────────
  const renderConnectionStatus = () => {
    if (connectionChecking) {
      return (
        <button className="btn btn-xs w-full gap-1 btn-ghost text-base-content/50" disabled>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-[10px] truncate">检测中...</span>
        </button>
      );
    }

    if (!injectable) {
      return (
        <div
          className="btn btn-xs w-full gap-1 btn-ghost text-base-content/40 cursor-default"
          title="当前页面不支持注入 Content Script（如 chrome:// 内部页面）"
        >
          <Ban className="w-3 h-3" />
          <span className="text-[10px] truncate">不可用页面</span>
        </div>
      );
    }

    if (connected) {
      return (
        <button
          className="btn btn-xs w-full gap-1 btn-ghost text-success"
          onClick={reconnect}
          title={`已连接: ${hostname || '未知'}`}
        >
          <CheckCircle2 className="w-3 h-3" />
          <span className="text-[10px] truncate">{hostname || '已连接'}</span>
        </button>
      );
    }

    return (
      <button
        className="btn btn-xs w-full gap-1 btn-ghost text-warning"
        onClick={reconnect}
        title="点击重新连接 Content Script"
      >
        <AlertCircle className="w-3 h-3" />
        <span className="text-[10px] truncate">未连接 · 点击重试</span>
      </button>
    );
  };

  // ─── Render Content ─────────────────────────
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
        return (
          <Chat
            config={config}
            skills={skills}
            hostname={hostname}
          />
        );
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
    <div>
      <div className="bg-base-200 flex">
        {/* ─── Sidebar ───────────────────────── */}
        <div className="flex flex-col justify-between">
          <ul className="menu w-35">
            {tabs.map((item) => (
              <li key={item.id}>
                <a
                  onClick={() => setActiveTab(item.id)}
                  className={activeTab === item.id ? 'menu-active' : ''}
                  href="#"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {item.badge !== undefined && (
                    <span className="badge badge-xs badge-primary ml-auto">
                      {item.badge}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>

          {/* ─── Connection Status ───────────── */}
          <div className="px-3 pb-3 w-35">
            {renderConnectionStatus()}
          </div>
        </div>

        {/* ─── Main Content ──────────────────── */}
        <div className="w-120 bg-base-100 h-100 overflow-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
