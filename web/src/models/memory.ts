import { signal, computed, createModel } from "@preact/signals";
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

  // Edit state
  const editingId = signal<string | null>(null);
  const editKey = signal("");
  const editValue = signal("");

  // Add state
  const adding = signal(false);
  const addKey = signal("");
  const addValue = signal("");

  const hasMemories = computed(() => memories.value.length > 0);

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

  const createMemory = async () => {
    const key = addKey.value.trim();
    const value = addValue.value.trim();
    if (!key || !value) return;

    error.value = null;
    try {
      const memory = await getAgent().call<Memory>("createMemory", [key, value]);
      memories.value = [memory, ...memories.value];
      addKey.value = "";
      addValue.value = "";
      adding.value = false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "Connection closed") {
        error.value = msg || "Failed to save memory";
      }
    }
  };

  const startEditing = (memory: Memory) => {
    editingId.value = memory.id;
    editKey.value = memory.key;
    editValue.value = memory.value;
  };

  const cancelEditing = () => {
    editingId.value = null;
    editKey.value = "";
    editValue.value = "";
  };

  const saveEdit = async () => {
    const id = editingId.value;
    const key = editKey.value.trim();
    const value = editValue.value.trim();
    if (!id || !key || !value) return;

    error.value = null;
    try {
      const updated = await getAgent().call<Memory>("updateMemory", [id, key, value]);
      memories.value = memories.value.map((m) => (m.id === id ? updated : m));
      cancelEditing();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "Connection closed") {
        error.value = msg || "Failed to update memory";
      }
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

  const startAdding = () => {
    adding.value = true;
    addKey.value = "";
    addValue.value = "";
  };

  const cancelAdding = () => {
    adding.value = false;
    addKey.value = "";
    addValue.value = "";
  };

  return {
    memories,
    loading,
    error,
    panelOpen,
    editingId,
    editKey,
    editValue,
    adding,
    addKey,
    addValue,
    hasMemories,
    togglePanel,
    loadMemories,
    createMemory,
    startEditing,
    cancelEditing,
    saveEdit,
    deleteMemory,
    startAdding,
    cancelAdding,
  };
});
