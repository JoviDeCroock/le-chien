import { signal, createModel } from "@preact/signals";

type MicrosoftStatus = {
  connected: boolean;
  displayName?: string;
  email?: string;
};

export const IntegrationsModel = createModel(() => {
  const loading = signal(true);
  const error = signal<string | null>(null);
  const microsoft = signal<MicrosoftStatus>({ connected: false });
  const connecting = signal(false);

  const fetchStatus = async () => {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/v1/microsoft/status");
      if (!res.ok) throw new Error("Failed to load integration status");
      microsoft.value = await res.json();
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load";
    } finally {
      loading.value = false;
    }
  };

  const connect = async () => {
    connecting.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/v1/microsoft/connect");
      if (!res.ok) throw new Error("Failed to start connection");
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to connect";
      connecting.value = false;
    }
  };

  const disconnect = async () => {
    error.value = null;
    try {
      const res = await fetch("/api/v1/microsoft/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Failed to disconnect");
      microsoft.value = { connected: false };
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to disconnect";
    }
  };

  return { loading, error, microsoft, connecting, fetchStatus, connect, disconnect };
});
