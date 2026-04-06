import { signal, createModel } from "@preact/signals";

type GoogleStatus = {
  connected: boolean;
  account?: string;
  name?: string;
  scope?: string;
  connectedAt?: string;
};

export const IntegrationsModel = createModel(() => {
  const loading = signal(true);
  const error = signal<string | null>(null);
  const google = signal<GoogleStatus>({ connected: false });
  const disconnecting = signal(false);

  const fetchStatus = async () => {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/v1/integrations/google/status");
      if (!res.ok) throw new Error("Failed to load integration status");
      google.value = await res.json();
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load integrations";
    } finally {
      loading.value = false;
    }
  };

  const connectGoogle = () => {
    window.location.href = "/api/v1/integrations/google/connect";
  };

  const disconnectGoogle = async () => {
    if (disconnecting.value) return;
    disconnecting.value = true;
    try {
      const res = await fetch("/api/v1/integrations/google/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Failed to disconnect");
      google.value = { connected: false };
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to disconnect";
    } finally {
      disconnecting.value = false;
    }
  };

  return {
    loading,
    error,
    google,
    disconnecting,
    fetchStatus,
    connectGoogle,
    disconnectGoogle,
  };
});
