// ============ Browser Claw — Background Service Worker ============
// Manifest V3 Background Service Worker
// 负责：
// 1. 消息中继（Popup ↔ Content Script）
// 2. 扩展生命周期管理
// 3. Side Panel 管理

import { DEFAULT_PREFERENCES } from "@/types";

const getSystemLanguage = () => {
  const uiLanguage = chrome.i18n?.getUILanguage?.() ?? "";
  if (!uiLanguage) return "zh";
  return uiLanguage.toLowerCase().startsWith("zh") ? "zh" : "en";
};

console.log("[Browser Claw] Background Service Worker started");

// 监听扩展安装
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[Browser Claw] Extension installed");
    // 设置默认存储数据
    chrome.storage.local.set({
      skills: [],
      channels: [],
      chatHistory: {},
      sessions: [],
      activeSessionId: "",
      preferences: { ...DEFAULT_PREFERENCES, language: getSystemLanguage() },
    });
  }
});

// 设置 Side Panel 行为 — 允许在所有标签页打开
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch(() => {
    // 某些环境可能不支持
  });

// 消息中继 — 当 Popup 需要与 Content Script 通信时
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ─── 打开 Side Panel ───
  if (message.type === "OPEN_SIDE_PANEL") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.sidePanel
          .open({ tabId })
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((_err: Error) => {
            sendResponse({ success: false, error: _err.message });
          });
      } else {
        sendResponse({ success: false, error: "No active tab found" });
      }
    });
    return true;
  }

  // ─── 来自 Popup 的消息，需要转发到 Content Script ───
  if (!sender.tab && message.type === "RELAY_TO_CONTENT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        sendResponse({ success: false, error: "No active tab found" });
        return;
      }
      chrome.tabs.sendMessage(tabId, message.payload, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          sendResponse(response);
        }
      });
    });
    return true;
  }
});
