import { useState, useEffect, useCallback } from "react";
import { Messaging } from "@/utils/messaging";
import type { PageInfo } from "@/types";

export function useContentScript() {
  const [connected, setConnected] = useState(false);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [injectable, setInjectable] = useState(true);

  /** 尝试获取页面信息 */
  const fetchPageInfo = useCallback(async () => {
    try {
      const info = await Messaging.getPageInfo();
      setPageInfo(info);
    } catch {
      // 忽略，保持 pageInfo 为 null
    }
  }, []);

  /**
   * 初始连接检查：先 ping，失败则自动尝试 ensureConnected
   */
  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      // 先检查当前页面是否可注入
      const canInject = await Messaging.isInjectableTab();
      setInjectable(canInject);

      if (!canInject) {
        setConnected(false);
        setPageInfo(null);
        return;
      }

      // 先快速 ping
      let ok = await Messaging.ping();

      // ping 失败 → 自动尝试 ensureConnected（会动态注入）
      if (!ok) {
        ok = await Messaging.ensureConnected();
      }

      setConnected(ok);
      if (ok) {
        await fetchPageInfo();
      }
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, [fetchPageInfo]);

  /**
   * 用户手动点击重连
   */
  const reconnect = useCallback(async () => {
    setChecking(true);
    try {
      const canInject = await Messaging.isInjectableTab();
      setInjectable(canInject);

      if (!canInject) {
        setConnected(false);
        setPageInfo(null);
        return;
      }

      const ok = await Messaging.ensureConnected();
      setConnected(ok);
      if (ok) {
        await fetchPageInfo();
      }
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, [fetchPageInfo]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return {
    connected,
    pageInfo,
    checking,
    injectable,
    hostname: pageInfo?.hostname ?? "",
    checkConnection,
    reconnect,
  };
}
