import type { ChatSession, SessionListItem } from "@/types";

const DB_NAME = "browser_claw_sessions";
const DB_VERSION = 1;
const STORE_NAME = "sessions";

/**
 * IndexedDB 封装 —— 专门用于管理 ChatSession
 *
 * 优点：
 * - 不受 chrome.storage.local 的 10 MB 限制
 * - 支持索引查询，大量会话时性能更好
 * - 异步非阻塞
 */
export class SessionDB {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  /** 打开 / 初始化数据库（单例） */
  private static openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("hostname", "hostname", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /** 获取 object store 的事务辅助 */
  private static async getStore(mode: IDBTransactionMode = "readonly") {
    const db = await this.openDB();
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  /** Promise 化 IDBRequest */
  private static promisify<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ──────── 公共 API ────────

  /** 获取所有会话 */
  static async getAll(): Promise<ChatSession[]> {
    const store = await this.getStore();
    return this.promisify(store.getAll());
  }

  /** 获取单个会话 */
  static async get(sessionId: string): Promise<ChatSession | undefined> {
    const store = await this.getStore();
    const result = await this.promisify(store.get(sessionId));
    return result ?? undefined;
  }

  /** 保存（新增或更新）会话 */
  static async save(session: ChatSession): Promise<void> {
    const store = await this.getStore("readwrite");
    await this.promisify(store.put(session));
  }

  /** 删除会话 */
  static async delete(sessionId: string): Promise<void> {
    const store = await this.getStore("readwrite");
    await this.promisify(store.delete(sessionId));
  }

  /** 获取会话列表（轻量摘要，按 updatedAt 倒序） */
  static async getSessionList(): Promise<SessionListItem[]> {
    const sessions = await this.getAll();
    return sessions
      .map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        hostname: s.hostname,
        preview: s.preview,
        messageCount: s.messages.length,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** 按 hostname 查询会话 */
  static async getByHostname(hostname: string): Promise<ChatSession[]> {
    const store = await this.getStore();
    const index = store.index("hostname");
    return this.promisify(index.getAll(hostname));
  }

  /** 清空所有会话 */
  static async clear(): Promise<void> {
    const store = await this.getStore("readwrite");
    await this.promisify(store.clear());
  }
}
