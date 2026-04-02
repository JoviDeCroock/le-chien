import { AgentClient, type StreamOptions } from "agents/client";
import { signal } from "@preact/signals";

/** How long to wait after a close event before marking as disconnected.
 *  PartySocket auto-reconnects — this grace period avoids flashing UI. */
const RECONNECT_GRACE_MS = 4_000;

export type AgentConnection = {
  client: AgentClient;
  connected: ReturnType<typeof signal<boolean>>;
  call: <T>(method: string, args?: unknown[]) => Promise<T>;
  callStream: (method: string, args: unknown[], options: StreamOptions) => Promise<unknown>;
  close: () => void;
};

// Singleton — lives outside component lifecycle
let instance: AgentConnection | null = null;

export function getAgentConnection(): AgentConnection {
  if (instance) return instance;

  const connected = signal(false);
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let intentionalClose = false;

  // Same-origin: derive host from current window location
  const host = typeof window !== "undefined" ? window.location.host : "localhost:5173";

  const client = new AgentClient({
    agent: "chat-agent",
    name: "default",
    host,
    basePath: "api/v1/agent",
  });

  // Use addEventListener since PartySocket extends WebSocket
  client.addEventListener("open", () => {
    // Reconnected within grace period — cancel the disconnect signal
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    connected.value = true;
  });

  client.addEventListener("close", () => {
    if (intentionalClose) {
      connected.value = false;
      return;
    }
    // Delay marking as disconnected so PartySocket can reconnect silently
    if (!disconnectTimer) {
      disconnectTimer = setTimeout(() => {
        disconnectTimer = null;
        connected.value = false;
      }, RECONNECT_GRACE_MS);
    }
  });

  async function call<T>(method: string, args: unknown[] = []): Promise<T> {
    await client.ready;
    return client.call(method, args) as Promise<T>;
  }

  async function callStream(method: string, args: unknown[], options: StreamOptions) {
    await client.ready;
    return client.call(method, args, { stream: options });
  }

  function close() {
    intentionalClose = true;
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    client.close();
    instance = null;
  }

  instance = { client, connected, call, callStream, close };
  return instance;
}

export function closeAgentConnection() {
  if (instance) {
    instance.close();
    instance = null;
  }
}
