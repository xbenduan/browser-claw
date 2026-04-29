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
      const url = `${config.baseURL.replace(/\/+$/, '')}/models`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const models = Array.isArray(data?.data)
        ? data.data.map((m: any) => m.id).filter(Boolean)
        : [];
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
