import { AgentClient, type StreamOptions } from "agents/client";
import { signal } from "@preact/signals";
import { API_BASE_URL } from "./constants";

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

  // Derive WebSocket URL from the API base URL
  const host = API_BASE_URL.replace(/^https?:\/\//, "");

  const client = new AgentClient({
    agent: "chat-agent",
    name: "default",
    host,
    basePath: "api/v1/agent",
  });

  // Use addEventListener since PartySocket extends WebSocket
  client.addEventListener("open", () => {
    connected.value = true;
  });
  client.addEventListener("close", () => {
    connected.value = false;
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
