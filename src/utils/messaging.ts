import { MessageType } from "@/types";
import type {
  ExecuteAPIPayload,
  APIResponse,
  PageInfo,
  PageContentResult,
} from "@/types";

/**
 * Chrome Extension 消息通信封装
 */
export class Messaging {
  /**
   * 向当前活动 Tab 的 Content Script 发送消息（带超时）
   */
  static async sendToContentScript<T>(
    type: MessageType,
    payload: unknown,
    tabId?: number,
  ): Promise<T> {
    const id = tabId ?? (await this.getActiveTabId());
    if (!id) throw new Error("No active tab found");

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            "Message timeout: Content Script did not respond within 5s",
          ),
        );
      }, 5000);

      chrome.tabs.sendMessage(
        id,
        { type, payload, timestamp: Date.now() },
        (response) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response as T);
          }
        },
      );
    });
  }

  /**
   * 在 Content Script 中执行 API 请求
   */
  static async executeAPI(
    payload: ExecuteAPIPayload,
    tabId?: number,
  ): Promise<APIResponse> {
    return this.sendToContentScript<APIResponse>(
      MessageType.EXECUTE_API,
      payload,
      tabId,
    );
  }

  /**
   * 取消请求
   */
  static async cancelRequest(requestId: string, tabId?: number): Promise<void> {
    await this.sendToContentScript(
      MessageType.CANCEL_REQUEST,
      { requestId },
      tabId,
    );
  }

  /**
   * 获取页面信息
   */
  static async getPageInfo(tabId?: number): Promise<PageInfo> {
    return this.sendToContentScript<PageInfo>(
      MessageType.GET_PAGE_INFO,
      {},
      tabId,
    );
  }

  /**
   * 读取页面内容
   */
  static async readPageContent(
    options?: {
      maxLength?: number;
      includeLinks?: boolean;
      includeHeadings?: boolean;
    },
    tabId?: number,
  ): Promise<PageContentResult> {
    return this.sendToContentScript<PageContentResult>(
      MessageType.READ_PAGE_CONTENT,
      options || {},
      tabId,
    );
  }

  /**
   * Ping Content Script
   */
  static async ping(tabId?: number): Promise<boolean> {
    try {
      const response = await this.sendToContentScript<{ type: string }>(
        MessageType.PING,
        {},
        tabId,
      );
      return response?.type === "PONG";
    } catch {
      return false;
    }
  }

  /**
   * 检查当前 Tab 是否可注入 Content Script
   */
  static async isInjectableTab(tabId?: number): Promise<boolean> {
    try {
      const id = tabId ?? (await this.getActiveTabId());
      if (!id) return false;
      const tab = await chrome.tabs.get(id);
      const url = tab.url || "";
      if (
        url.startsWith("chrome://") ||
        url.startsWith("chrome-extension://") ||
        url.startsWith("edge://") ||
        url.startsWith("about:") ||
        url.startsWith("devtools://") ||
        url === ""
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 确保 Content Script 已连接
   */
  static async ensureConnected(tabId?: number): Promise<boolean> {
    const id = tabId ?? (await this.getActiveTabId());
    if (!id) return false;

    if (!(await this.isInjectableTab(id))) return false;

    if (await this.ping(id)) return true;

    try {
      const manifest = chrome.runtime.getManifest();
      const contentScriptFile = manifest.content_scripts?.[0]?.js?.[0];
      if (!contentScriptFile) return false;

      await chrome.scripting.executeScript({
        target: { tabId: id },
        files: [contentScriptFile],
      });
    } catch {
      return false;
    }

    await new Promise((r) => setTimeout(r, 300));
    return this.ping(id);
  }

  /**
   * 获取当前活动 Tab ID
   */
  static async getActiveTabId(): Promise<number | undefined> {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab?.id;
  }

  /**
   * 获取当前活动 Tab URL
   */
  static async getActiveTabUrl(): Promise<string | undefined> {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab?.url;
  }
}
