import { useState, useEffect, useCallback } from 'react';
import type { AgentConfig } from '@/types';
import { DEFAULT_MODEL_CONFIG } from '@/types';
import { Storage } from '@/utils/storage';

export function useModel() {
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_MODEL_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Storage.getModelConfig().then((stored) => {
      setConfig(stored);
      setLoading(false);
    });
  }, []);

  const saveConfig = useCallback(async (newConfig: AgentConfig) => {
    setConfig(newConfig);
    await Storage.setModelConfig(newConfig);
  }, []);

  const testConnection = useCallback(async (): Promise<{ success: boolean; error?: string; models?: string[] }> => {
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        dangerouslyAllowBrowser: true,
      });
      const modelList = await client.models.list();
      const models = [];
      for await (const model of modelList) {
        models.push(model.id);
      }
      return { success: true, models };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [config]);

  return { config, loading, saveConfig, testConnection };
}
