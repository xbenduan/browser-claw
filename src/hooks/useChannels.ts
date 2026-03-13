import { useState, useEffect, useCallback } from "react";
import type { Channel } from "@/types";
import { Storage } from "@/utils/storage";

export function useChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Storage.getChannels().then((stored) => {
      setChannels(stored);
      setLoading(false);
    });
  }, []);

  const persist = useCallback(async (newChannels: Channel[]) => {
    setChannels(newChannels);
    await Storage.setChannels(newChannels);
  }, []);

  const addChannel = useCallback(
    async (channel: Omit<Channel, "id" | "createdAt" | "updatedAt">) => {
      const newChannel: Channel = {
        ...channel,
        id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const updated = [...channels, newChannel];
      await persist(updated);
      return newChannel;
    },
    [channels, persist],
  );

  const updateChannel = useCallback(
    async (id: string, updates: Partial<Channel>) => {
      const newChannels = channels.map((ch) =>
        ch.id === id ? { ...ch, ...updates, updatedAt: Date.now() } : ch,
      );
      await persist(newChannels);
    },
    [channels, persist],
  );

  const removeChannel = useCallback(
    async (id: string) => {
      await persist(channels.filter((ch) => ch.id !== id));
    },
    [channels, persist],
  );

  const toggleChannel = useCallback(
    async (id: string) => {
      const ch = channels.find((c) => c.id === id);
      if (ch) {
        await updateChannel(id, { enabled: !ch.enabled });
      }
    },
    [channels, updateChannel],
  );

  return {
    channels,
    loading,
    addChannel,
    updateChannel,
    removeChannel,
    toggleChannel,
  };
}
