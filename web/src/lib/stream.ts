import { API_BASE_URL } from "./constants";

export type StreamCallbacks = {
  onToken: (token: string) => void;
  onFinish: () => void;
  onError: (error: string) => void;
};

/**
 * Stream a chat completion from the API.
 * The API returns a plain text stream (toTextStreamResponse),
 * so we just read chunks and forward them as tokens.
 */
export async function streamChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  model: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError((err as Error).message ?? "Network error");
    }
    return;
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Request failed" }));
    callbacks.onError((err as { error?: string }).error ?? `HTTP ${response.status}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body");
    return;
  }

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      if (text) {
        callbacks.onToken(text);
      }
    }
    callbacks.onFinish();
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      callbacks.onError((err as Error).message ?? "Stream error");
    }
  } finally {
    reader.releaseLock();
  }
}
