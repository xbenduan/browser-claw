import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import type { ChatSession, SessionListItem } from "@/types";
import { Storage } from "@/utils/storage";

export function useSessions() {
  const [sessionList, setSessionList] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  const refresh = useCallback(async () => {
    const list = await Storage.getSessionList();
    setSessionList(list);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // 监听 _sessionUpdate 信号以跨页面同步（IndexedDB 无原生 change 事件）
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
    ) => {
      if (changes._sessionUpdate || changes.activeSessionId) {
        refresh();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refresh]);

  const createSession = useCallback(
    async (hostname: string): Promise<ChatSession> => {
      const session = Storage.createNewSession(hostname, t("chat.newSession"));
      await Storage.saveSession(session);
      await Storage.setActiveSessionId(session.id);
      await refresh();
      return session;
    },
    [refresh, t],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await Storage.deleteSession(sessionId);
      await refresh();
    },
    [refresh],
  );

  const openSession = useCallback(async (sessionId: string) => {
    await Storage.setActiveSessionId(sessionId);
  }, []);

  return {
    sessionList,
    loading,
    createSession,
    deleteSession,
    openSession,
    refresh,
  };
}
