import { signal, computed, createModel } from "@preact/signals";
import { streamChat } from "../lib/stream";
import { API_BASE_URL } from "../lib/constants";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type ModelOption = {
  id: string;
  name: string;
  description: string;
};

export const ChatModel = createModel(() => {
  const messages = signal<Message[]>([]);
  const input = signal("");
  const streaming = signal(false);
  const error = signal<string | null>(null);
  const selectedModel = signal("glm-4.7-flash");
  const models = signal<ModelOption[]>([]);
  const modelsLoaded = signal(false);
  const abortController = signal<AbortController | null>(null);

  const canSend = computed(() => input.value.trim().length > 0 && !streaming.value);

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

  const send = async () => {
    const text = input.value.trim();
    if (!text || streaming.value) return;

    error.value = null;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantMessage: Message = { id: crypto.randomUUID(), role: "assistant", content: "" };

    messages.value = [...messages.value, userMessage, assistantMessage];
    input.value = "";
    streaming.value = true;

    const ac = new AbortController();
    abortController.value = ac;

    // Build message history for the API (no IDs, just role+content)
    const history = messages.value.map((m) => ({ role: m.role, content: m.content }));

    await streamChat(history, selectedModel.value, {
      onToken: (token) => {
        const msgs = messages.value;
        const last = msgs[msgs.length - 1];
        messages.value = [...msgs.slice(0, -1), { ...last, content: last.content + token }];
      },
      onFinish: () => {
        streaming.value = false;
        abortController.value = null;
      },
      onError: (err) => {
        error.value = err;
        streaming.value = false;
        abortController.value = null;
        // Remove the empty assistant message on error
        const msgs = messages.value;
        const last = msgs[msgs.length - 1];
        if (last.role === "assistant" && !last.content) {
          messages.value = msgs.slice(0, -1);
        }
      },
    }, ac.signal);
  };

  const stop = () => {
    abortController.value?.abort();
    streaming.value = false;
    abortController.value = null;
  };

  const clear = () => {
    stop();
    messages.value = [];
    error.value = null;
  };

  return {
    messages,
    input,
    streaming,
    error,
    selectedModel,
    models,
    modelsLoaded,
    canSend,
    fetchModels,
    send,
    stop,
    clear,
  };
});
