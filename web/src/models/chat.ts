import { signal, computed, createModel } from "@preact/signals";
import {
  getAgentConnection,
  closeAgentConnection,
  type AgentConnection,
} from "../lib/agent-client";
import { API_BASE_URL } from "../lib/constants";

export type Conversation = {
  id: string;
  title: string;
  model: string;
  created_at: number;
  updated_at: number;
};

export type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "complete";
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCall[];
  created_at: number;
};

export type ModelOption = {
  id: string;
  name: string;
  description: string;
};

export const ChatModel = createModel(() => {
  const conversations = signal<Conversation[]>([]);
  const activeConversationId = signal<string | null>(null);
  const messages = signal<Message[]>([]);
  const input = signal("");
  const streaming = signal(false);
  const error = signal<string | null>(null);
  const selectedModel = signal("glm-4.7-flash");
  const models = signal<ModelOption[]>([]);
  const modelsLoaded = signal(false);
  const connected = signal(false);

  const agent = signal<AgentConnection | null>(null);

  const canSend = computed(
    () => input.value.trim().length > 0 && !streaming.value && connected.value,
  );
  );

  const activeConversation = computed(
    () => conversations.value.find((c) => c.id === activeConversationId.value) ?? null,
  );

  const fetchConversations = async () => {
    const res = await fetch(`${API_BASE_URL}/api/v1/chat/conversations`, {
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error("Failed to load conversations");
    }

    const data = (await res.json()) as { conversations: Conversation[] };
    conversations.value = data.conversations;
  };

  const fetchModels = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/chat/models`, { credentials: "include" });
      const data = (await res.json()) as { models: ModelOption[]; default: string };
      models.value = data.models;
      selectedModel.value = data.default;
      modelsLoaded.value = true;
    } catch {
      // Fallback — models will be empty but the user can still type
    }
  };

  const connect = async () => {
    if (agent.value) return;
    const conn = getAgentConnection();
    agent.value = conn;

    // Sync connection state
    conn.connected.subscribe((val) => {
      connected.value = val ?? false;
    });

    try {
      await fetchConversations();
    } catch {
      // Will retry on next interaction
    }
  };

  const disconnect = () => {
    closeAgentConnection();
    agent.value = null;
    connected.value = false;
  };

  const selectConversation = async (conversationId: string) => {
    if (!agent.value) return;
    activeConversationId.value = conversationId;
    error.value = null;

    try {
      const result = await agent.value!.call<{
        conversation: Conversation;
        messages: (Message & { tool_calls?: string | ToolCall[] | null })[];
      }>("getConversation", [conversationId]);
      // Parse tool_calls JSON from DB storage
      messages.value = result.messages.map((m) => {
        if (typeof m.tool_calls === "string") {
          try {
            const parsed = JSON.parse(m.tool_calls) as {
              id: string;
              name: string;
              args: unknown;
              result: unknown;
            }[];
            return {
              ...m,
              tool_calls: parsed.map((tc) => ({
                id: tc.id,
                name: tc.name,
                args: (tc.args as Record<string, unknown>) ?? {},
                result: tc.result,
                status: "complete" as const,
              })),
            };
          } catch {
            return { ...m, tool_calls: undefined };
          }
        }
        return m as Message;
      });
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load conversation";
    }
  };

  const createConversation = async (): Promise<string | null> => {
    if (!agent.value) return null;
    error.value = null;

    try {
      const convo = await agent.value!.call<Conversation>("createConversation", [
        "New chat",
        selectedModel.value,
      ]);
      conversations.value = [convo, ...conversations.value];
      activeConversationId.value = convo.id;
      messages.value = [];
      return convo.id;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to create conversation";
      return null;
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!agent.value) return;

    try {
      await agent.value!.call("deleteConversation", [conversationId]);
      conversations.value = conversations.value.filter((c) => c.id !== conversationId);
      if (activeConversationId.value === conversationId) {
        activeConversationId.value = null;
        messages.value = [];
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to delete conversation";
    }
  };

  const send = async () => {
    const text = input.value.trim();
    if (!text || streaming.value || !agent.value) return;

    error.value = null;

    // Create conversation if none active
    let convId = activeConversationId.value;
    if (!convId) {
      convId = await createConversation();
      if (!convId) return;
    }

    // Optimistic: add user message and empty assistant message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      role: "user",
      content: text,
      created_at: Math.floor(Date.now() / 1000),
    };
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      role: "assistant",
      content: "",
      created_at: Math.floor(Date.now() / 1000),
    };

    messages.value = [...messages.value, userMessage, assistantMessage];
    input.value = "";
    streaming.value = true;

    try {
      await agent.value!.callStream("sendMessage", [convId, text, selectedModel.value], {
        onChunk: (chunk) => {
          const msgs = messages.value;
          const last = msgs[msgs.length - 1];

          // Handle structured tool events
          if (typeof chunk === "object" && chunk !== null && "__event" in chunk) {
            const event = chunk as {
              __event: string;
              id: string;
              name: string;
              args?: unknown;
              result?: unknown;
            };
            if (event.__event === "tool-call") {
              const tc: ToolCall = {
                id: event.id,
                name: event.name,
                args: (event.args as Record<string, unknown>) ?? {},
                status: "pending",
              };
              const existing = last.tool_calls ?? [];
              messages.value = [...msgs.slice(0, -1), { ...last, tool_calls: [...existing, tc] }];
            } else if (event.__event === "tool-result") {
              const existing = last.tool_calls ?? [];
              const updated = existing.map((tc) =>
                tc.id === event.id
                  ? { ...tc, result: event.result, status: "complete" as const }
                  : tc,
              );
              messages.value = [...msgs.slice(0, -1), { ...last, tool_calls: updated }];
            }
            return;
          }

          // Regular text chunk
          messages.value = [
            ...msgs.slice(0, -1),
            { ...last, content: last.content + (chunk as string) },
          ];
        },
        onDone: (result) => {
          // Update assistant message ID from server
          const meta = result as { messageId?: string } | undefined;
          if (meta?.messageId) {
            const msgs = messages.value;
            const last = msgs[msgs.length - 1];
            messages.value = [...msgs.slice(0, -1), { ...last, id: meta.messageId }];
          }
          streaming.value = false;

          fetchConversations().catch(() => {});
        },
        onError: (err) => {
          error.value = err;
          streaming.value = false;
          // Remove empty assistant message on error
          const msgs = messages.value;
          const last = msgs[msgs.length - 1];
          if (last.role === "assistant" && !last.content) {
            messages.value = msgs.slice(0, -1);
          }
        },
      });
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to send message";
      streaming.value = false;
    }
  };

  const stop = () => {
    // Client-side stop: stop processing chunks
    streaming.value = false;
  };

  const clear = () => {
    stop();
    activeConversationId.value = null;
    messages.value = [];
    error.value = null;
  };

  return {
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    input,
    streaming,
    error,
    selectedModel,
    models,
    modelsLoaded,
    connected,
    canSend,
    fetchModels,
    connect,
    disconnect,
    selectConversation,
    createConversation,
    deleteConversation,
    send,
    stop,
    clear,
  };
});
