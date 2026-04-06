import { useEffect } from "preact/hooks";
import { useModel } from "@preact/signals";
import { useLocation } from "preact-iso";
import { AuthModel } from "../../models/auth";
import { IntegrationsModel } from "../../models/integrations";
import { Button } from "../../components/ui/Button";
import { Card, PageLoader } from "../../components/ui/Layout";
import { Alert } from "../../components/ui/Alert";

function MicrosoftIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="6.5" height="6.5" fill="#f25022" />
      <rect x="8.5" y="1" width="6.5" height="6.5" fill="#7fba00" />
      <rect x="1" y="8.5" width="6.5" height="6.5" fill="#00a4ef" />
      <rect x="8.5" y="8.5" width="6.5" height="6.5" fill="#ffb900" />
    </svg>
  );
}

export function Integrations() {
  const { route, query } = useLocation();
  const auth = useModel(AuthModel);
  const integrations = useModel(IntegrationsModel);

  useEffect(() => {
    auth.checkSession();
  }, []);

  useEffect(() => {
    if (!auth.loading.value && !auth.authenticated.value) {
      route("/auth");
    }
    if (auth.authenticated.value) {
      integrations.fetchStatus();
    }
  }, [auth.loading.value, auth.authenticated.value]);

  const msStatus = query.microsoft;
  const msMessage = query.message;

  if (auth.loading.value || (auth.authenticated.value && integrations.loading.value)) {
    return <PageLoader label="Loading integrations" />;
  }

  const ms = integrations.microsoft.value;

  return (
    <div class="min-h-screen bg-neutral-950 font-sans text-neutral-300">
      <nav class="border-b border-neutral-800">
        <div class="flex items-center justify-between h-12 px-4 max-w-3xl mx-auto">
          <div class="flex items-center gap-3">
            <a href="/chat" class="text-xs text-neutral-400 hover:text-white transition-colors">
              &larr; Back
            </a>
            <span class="w-px h-3.5 bg-neutral-800" />
            <span class="text-sm font-semibold text-white tracking-tight">le&nbsp;chien</span>
          </div>
        </div>
      </nav>

      <div class="max-w-3xl mx-auto px-4 pt-8 pb-24">
        <h1 class="text-2xl font-bold text-white tracking-tight mb-8">Integrations</h1>

        {msStatus === "connected" && (
          <Alert variant="success" class="mb-6">
            Microsoft 365 connected successfully.
          </Alert>
        )}

        {msStatus === "error" && msMessage && (
          <Alert variant="error" class="mb-6">
            {decodeURIComponent(msMessage)}
          </Alert>
        )}

        {integrations.error.value && (
          <Alert variant="error" class="mb-6">
            {integrations.error.value}
          </Alert>
        )}

        <div class="space-y-6">
          <Card>
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
                  <MicrosoftIcon size={20} />
                </div>
                <div>
                  <h2 class="text-base font-semibold text-white mb-1">Microsoft 365</h2>
                  <p class="text-sm text-neutral-400">
                    Search and read your OneDrive, SharePoint, and Teams data from chat.
                  </p>
                  {ms.connected && (
                    <div class="mt-3 flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full bg-green-400" />
                      <span class="text-sm text-neutral-300">
                        Connected{ms.displayName ? ` as ${ms.displayName}` : ""}
                        {ms.email ? ` (${ms.email})` : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div class="mt-6 pt-4 border-t border-neutral-800">
              {ms.connected ? (
                <Button variant="secondary" size="sm" onClick={() => integrations.disconnect()}>
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => integrations.connect()}
                  disabled={integrations.connecting.value}
                >
                  {integrations.connecting.value ? "Redirecting..." : "Connect Microsoft 365"}
                </Button>
              )}
            </div>
          </Card>

          <div class="text-xs text-neutral-500">
            Integrations connect your accounts so the assistant can search and read your data. All
            actions are visible in chat. You can disconnect at any time.
          </div>
        </div>
      </div>
    </div>
  );
}
