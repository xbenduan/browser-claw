import type { StorageSchema } from '@/types';
import type { ChatSession, SessionListItem } from '@/types';
import { DEFAULT_MODEL_CONFIG, DEFAULT_PREFERENCES } from '@/types';
import { SessionDB } from './session-db';

/**
 * chrome.storage 封装层
 *
 * 会话数据存储在 IndexedDB（通过 SessionDB），
 * 其他配置数据仍使用 chrome.storage.local。
 */
export class Storage {

  static async get<K extends keyof StorageSchema>(key: K): Promise<StorageSchema[K] | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key] as StorageSchema[K] | undefined;
  }

  static async set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  static async getAll(): Promise<Partial<StorageSchema>> {
    return chrome.storage.local.get(null) as Promise<Partial<StorageSchema>>;
  }

  static async clear(): Promise<void> {
    await chrome.storage.local.clear();
  }

  // ---- 快捷方法（非会话数据，仍走 chrome.storage） ----

  static async getSkills() {
    return (await this.get('skills')) ?? [];
  }

  static async setSkills(skills: StorageSchema['skills']) {
    return this.set('skills', skills);
  }

  static async getModelConfig() {
    const stored = await this.get('modelConfig');
    if (!stored) return DEFAULT_MODEL_CONFIG;
    // 存储中 apiKey 为空时，用 .env 默认值补全，方便调试
    return {
      ...DEFAULT_MODEL_CONFIG,
      ...stored,
      apiKey: stored.apiKey || DEFAULT_MODEL_CONFIG.apiKey,
      baseURL: stored.baseURL || DEFAULT_MODEL_CONFIG.baseURL,
      model: stored.model || DEFAULT_MODEL_CONFIG.model,
    };
  }

  static async setModelConfig(config: StorageSchema['modelConfig']) {
    return this.set('modelConfig', config);
  }

  static async getChannels() {
    return (await this.get('channels')) ?? [];
  }

  static async setChannels(channels: StorageSchema['channels']) {
    return this.set('channels', channels);
  }

  static async getChatHistory() {
    return (await this.get('chatHistory')) ?? {};
  }

  static async setChatHistory(history: StorageSchema['chatHistory']) {
    return this.set('chatHistory', history);
  }

  static async getPreferences() {
    return (await this.get('preferences')) ?? DEFAULT_PREFERENCES;
  }

  static async setPreferences(prefs: StorageSchema['preferences']) {
    return this.set('preferences', prefs);
  }

  // ---- 会话管理方法（代理到 IndexedDB） ----

  static async getSessions(): Promise<ChatSession[]> {
    return SessionDB.getAll();
  }

  static async setSessions(sessions: ChatSession[]): Promise<void> {
    // 兼容方法：全量覆盖（不推荐，仅向后兼容）
    await SessionDB.clear();
    for (const s of sessions) {
      await SessionDB.save(s);
    }
  }

  static async getSessionList(): Promise<SessionListItem[]> {
    return SessionDB.getSessionList();
  }

  static async getSession(sessionId: string): Promise<ChatSession | undefined> {
    return SessionDB.get(sessionId);
  }

  static async saveSession(session: ChatSession): Promise<void> {
    await SessionDB.save(session);
    // 通知其他页面会话有变化（通过 chrome.storage 发信号）
    await chrome.storage.local.set({ _sessionUpdate: Date.now() });
  }

  static async deleteSession(sessionId: string): Promise<void> {
    await SessionDB.delete(sessionId);
    // 通知其他页面
    await chrome.storage.local.set({ _sessionUpdate: Date.now() });
  }

  static async getActiveSessionId(): Promise<string> {
    return (await this.get('activeSessionId')) ?? '';
  }

  static async setActiveSessionId(id: string): Promise<void> {
    return this.set('activeSessionId', id);
  }

  static createNewSession(hostname: string, title = '新会话'): ChatSession {
    return {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      hostname,
      preview: '',
    };
  }
}
