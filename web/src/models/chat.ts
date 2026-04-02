import { signal, computed, createModel } from "@preact/signals";
import {
  getAgentConnection,
  closeAgentConnection,
  type AgentConnection,
} from "../lib/agent-client";
import { authClient } from "../lib/auth";
import { trackEvent, captureException } from "../lib/posthog";

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
  tag: string;
  speed: "instant" | "fast" | "moderate";
  bestFor: string;
  premium: boolean;
};

export type SubscriptionStatus = {
  plan: "free" | "pro";
  limits: {
    dailyMessages: number | null;
    dailyPremiumMessages: number | null;
    dailyImageGenerations: number | null;
  };
  usage: {
    dailyMessagesUsed: number;
    dailyMessagesRemaining: number | null;
    limitReached: boolean;
    dailyPremiumMessagesUsed: number;
    dailyPremiumMessagesRemaining: number | null;
    premiumLimitReached: boolean;
    dailyImageGenerationsUsed: number;
    dailyImageGenerationsRemaining: number | null;
    imageGenerationLimitReached: boolean;
    usageDate: string;
    resetsAt: string;
  };
};

type SendMessageResult = {
  messageId?: string;
  blocked?: boolean;
  reason?: "daily_limit" | "premium_limit";
  subscription?: SubscriptionStatus;
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
  const subscription = signal<SubscriptionStatus | null>(null);
  const checkoutPending = signal(false);

  const agent = signal<AgentConnection | null>(null);
  let subscriptionResetTimer: number | null = null;

  function clearSubscriptionResetTimer() {
    if (subscriptionResetTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(subscriptionResetTimer);
      subscriptionResetTimer = null;
    }
  }

  function scheduleSubscriptionRefresh(status: SubscriptionStatus) {
    clearSubscriptionResetTimer();

    if (typeof window === "undefined" || status.plan !== "free" || !status.usage.limitReached) {
      return;
    }

    const delay = new Date(status.usage.resetsAt).getTime() - Date.now() + 1000;
    if (delay <= 0) {
      void refreshSubscription();
      return;
    }

    subscriptionResetTimer = window.setTimeout(() => {
      void refreshSubscription();
    }, delay);
  }

  function setSubscription(status: SubscriptionStatus | null) {
    subscription.value = status;

    if (status) {
      scheduleSubscriptionRefresh(status);
      return;
    }

    clearSubscriptionResetTimer();
  }

  const premiumLimitReached = computed(
    () =>
      subscription.value?.plan === "free" && subscription.value.usage.premiumLimitReached === true,
  );

  const selectedModelIsPremium = computed(
    () => models.value.find((m) => m.id === selectedModel.value)?.premium === true,
  );

  const inputLocked = computed(
    () =>
      subscription.value?.plan === "free" &&
      (subscription.value.usage.limitReached ||
        (selectedModelIsPremium.value && subscription.value.usage.premiumLimitReached)),
  );

  const canSend = computed(
    () =>
      input.value.trim().length > 0 && !streaming.value && connected.value && !inputLocked.value,
  );

  const activeConversation = computed(
    () => conversations.value.find((c) => c.id === activeConversationId.value) ?? null,
  );

  const fetchModels = async () => {
    try {
      const res = await fetch(`/api/v1/chat/models`, { credentials: "include" });
      const data = (await res.json()) as { models: ModelOption[]; default: string };
      models.value = data.models;
      selectedModel.value = data.default;
      modelsLoaded.value = true;
    } catch (err) {
      captureException(err instanceof Error ? err : new Error("Failed to fetch models"), {
        source: "chat",
      });
    }
  };

  const refreshSubscription = async () => {
    try {
      const res = await fetch(`/api/v1/subscription`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load subscription");
      setSubscription((await res.json()) as SubscriptionStatus);
    } catch {
      setSubscription(null);
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
      // Load conversations once connected
      const convos = await conn.call<Conversation[]>("listConversations");
      conversations.value = convos;
      await refreshSubscription();
    } catch {
      // PartySocket will reconnect — retry when connection reopens
    }

    // Re-fetch conversations when reconnecting after a drop
    conn.connected.subscribe((val) => {
      if (val && conversations.value.length === 0) {
        conn
          .call<Conversation[]>("listConversations")
          .then((convos) => {
            conversations.value = convos;
          })
          .catch(() => {});
        refreshSubscription().catch(() => {});
      }
    });
  };

  const disconnect = () => {
    clearSubscriptionResetTimer();
    closeAgentConnection();
    agent.value = null;
    connected.value = false;
    subscription.value = null;
  };

  const startCheckout = async () => {
    if (checkoutPending.value) return;

    checkoutPending.value = true;
    error.value = null;

    try {
      trackEvent("checkout_started", { plan: "pro" });
      await authClient.checkout({ slug: "pro" });
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to start checkout";
      captureException(err instanceof Error ? err : new Error("Failed to start checkout"), {
        source: "billing",
      });
    } finally {
      checkoutPending.value = false;
    }
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
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "Connection closed") {
        error.value = msg || "Failed to load conversation";
      }
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
      trackEvent("conversation_created", { model: selectedModel.value });
      return convo.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "Connection closed") {
        error.value = msg || "Failed to create conversation";
        captureException(err instanceof Error ? err : new Error("Failed to create conversation"), {
          source: "chat",
        });
      }
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
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== "Connection closed") {
        error.value = msg || "Failed to delete conversation";
      }
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
    const optimisticUserMessageId = userMessage.id;
    const optimisticAssistantMessageId = assistantMessage.id;

    messages.value = [...messages.value, userMessage, assistantMessage];
    input.value = "";
    streaming.value = true;
    const streamStartedAt = Date.now();

    trackEvent("message_sent", {
      model: selectedModel.value,
      conversation_id: convId,
      message_length: text.length,
    });

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
          const meta = result as SendMessageResult | undefined;

          if (meta?.subscription) {
            setSubscription(meta.subscription);
          }

          if (meta?.blocked) {
            trackEvent("message_blocked", {
              reason: meta.reason,
              plan: meta.subscription?.plan,
            });
            messages.value = messages.value.filter(
              (message) =>
                message.id !== optimisticUserMessageId &&
                message.id !== optimisticAssistantMessageId,
            );
            streaming.value = false;
            return;
          }

          if (meta?.messageId) {
            const msgs = messages.value;
            const last = msgs[msgs.length - 1];
            messages.value = [...msgs.slice(0, -1), { ...last, id: meta.messageId }];
          }
          trackEvent("message_completed", {
            model: selectedModel.value,
            conversation_id: convId,
            duration_ms: Date.now() - streamStartedAt,
          });
          streaming.value = false;

          // Refresh conversation list to get updated titles/timestamps
          agent.value
            ?.call<Conversation[]>("listConversations")
            .then((convos) => {
              conversations.value = convos;
            })
            .catch(() => {});
        },
        onError: (err) => {
          // Suppress transient "Connection closed" — PartySocket will reconnect
          if (err === "Connection closed") return;
          error.value = err;
          captureException(new Error(err), {
            source: "chat_stream",
            model: selectedModel.value,
            conversation_id: convId,
          });
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
      const msg = err instanceof Error ? err.message : String(err);
      // Suppress transient "Connection closed" — PartySocket will reconnect
      if (msg === "Connection closed") return;
      error.value = msg || "Failed to send message";
      captureException(err instanceof Error ? err : new Error("Failed to send message"), {
        source: "chat",
        model: selectedModel.value,
        conversation_id: convId,
      });
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
    subscription,
    inputLocked,
    premiumLimitReached,
    selectedModelIsPremium,
    checkoutPending,
    canSend,
    fetchModels,
    refreshSubscription,
    connect,
    disconnect,
    startCheckout,
    selectConversation,
    createConversation,
    deleteConversation,
    send,
    stop,
    clear,
  };
});
