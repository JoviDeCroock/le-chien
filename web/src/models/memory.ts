import { signal, createModel } from "@preact/signals";
import { getAgentConnection, type AgentConnection } from "../lib/agent-client";

export type Memory = {
  id: string;
  key: string;
  value: string;
  created_at: number;
  updated_at: number;
};

export const MemoryModel = createModel(() => {
  const memories = signal<Memory[]>([]);
  const loading = signal(false);
  const error = signal<string | null>(null);
  const panelOpen = signal(false);

  function getAgent(): AgentConnection {
    return getAgentConnection();
  }

  const togglePanel = () => {
    panelOpen.value = !panelOpen.value;
  };

  const loadMemories = async () => {
    loading.value = true;
    error.value = null;
    try {
      const result = await getAgent().call<Memory[]>("listMemories");
      memories.value = result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "Connection closed") {
        error.value = msg || "Failed to load memories";
      }
    } finally {
      loading.value = false;
    }
  };

  const deleteMemory = async (memoryId: string) => {
    error.value = null;
    try {
      await getAgent().call("deleteMemory", [memoryId]);
      memories.value = memories.value.filter((m) => m.id !== memoryId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "Connection closed") {
        error.value = msg || "Failed to delete memory";
      }
    }
  };

  return {
    memories,
    loading,
    error,
    panelOpen,
    togglePanel,
    loadMemories,
    deleteMemory,
  };
});
