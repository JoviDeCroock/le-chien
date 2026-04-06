import { useEffect } from "preact/hooks";
import { useModel } from "@preact/signals";
import { useLocation } from "preact-iso";
import { AuthModel } from "../../models/auth";
import { IntegrationsModel } from "../../models/integrations";
import { Button } from "../../components/ui/Button";
import { Card, PageLoader } from "../../components/ui/Layout";

function GoogleDriveIcon() {
  return (
    <svg width={32} height={32} viewBox="0 0 87.3 78" class="shrink-0">
      <path d="M6.6 66.85L29.1 29.05 51.6 66.85z" fill="#0066da" />
      <path d="M29.1 29.05L51.6 66.85 74.1 66.85 51.6 29.05z" fill="#00ac47" />
      <path d="M51.6 29.05L74.1 66.85 87.3 44.35 64.8 6.55z" fill="#ea4335" />
      <path d="M29.1 29.05L51.6 29.05 64.8 6.55 42.3 6.55z" fill="#00832d" />
      <path d="M6.6 66.85L29.1 66.85 51.6 66.85 29.1 29.05z" fill="#2684fc" />
      <path d="M51.6 66.85L74.1 66.85 87.3 44.35 64.8 6.55 51.6 29.05z" fill="#ffba00" />
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

  if (auth.loading.value || (auth.authenticated.value && integrations.loading.value)) {
    return <PageLoader label="Loading integrations" />;
  }

  const google = integrations.google.value;
  const errorParam = query.error;
  const justConnected = query.google === "connected";

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
        <h1 class="text-2xl font-bold text-white tracking-tight mb-2">Integrations</h1>
        <p class="text-sm text-neutral-400 mb-8">
          Connect external services to give le chien access to your data.
        </p>

        {errorParam && (
          <div class="mb-6 px-4 py-3 rounded-lg border border-red-900/50 bg-red-950/30 text-red-400 text-sm">
            Connection failed: {errorParam.replace(/_/g, " ")}
          </div>
        )}

        {justConnected && !errorParam && (
          <div class="mb-6 px-4 py-3 rounded-lg border border-green-900/50 bg-green-950/30 text-green-400 text-sm">
            Google Drive connected. You can now search and read your Drive files in chat.
          </div>
        )}

        <Card>
          <div class="flex items-start gap-4">
            <GoogleDriveIcon />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h2 class="text-lg font-semibold text-white">Google Drive</h2>
                {google.connected && (
                  <span class="text-xs font-medium bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full border border-green-800/30">
                    Connected
                  </span>
                )}
              </div>

              {google.connected ? (
                <div class="space-y-3">
                  <p class="text-sm text-neutral-400">
                    Connected as{" "}
                    <span class="text-neutral-300">{google.name || google.account}</span>
                    {google.name && google.account && (
                      <span class="text-neutral-500"> ({google.account})</span>
                    )}
                  </p>
                  <p class="text-xs text-neutral-500">
                    le chien can search and read files from your Drive. It has read-only access and
                    cannot modify or delete anything.
                  </p>
                  <div class="pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => integrations.disconnectGoogle()}
                      disabled={integrations.disconnecting.value}
                    >
                      {integrations.disconnecting.value ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div class="space-y-3">
                  <p class="text-sm text-neutral-400">
                    Connect Google Drive to search, browse, and read your files directly in chat. le
                    chien gets read-only access — it can't modify or delete anything.
                  </p>
                  <div class="pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => integrations.connectGoogle()}
                    >
                      Connect Google Drive
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div class="mt-8">
          <h2 class="text-sm font-medium tracking-wide text-neutral-500 uppercase mb-4">
            Coming soon
          </h2>
          <div class="space-y-3">
            <ComingSoonCard name="Notion" description="Search and retrieve pages and databases" />
            <ComingSoonCard
              name="Slack"
              description="Search channels and summarize conversations"
            />
            <ComingSoonCard name="Gmail" description="Search inbox and draft replies" />
            <ComingSoonCard name="Google Calendar" description="View events and manage schedule" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ComingSoonCard({ name, description }: { name: string; description: string }) {
  return (
    <div class="border border-neutral-800 rounded-lg px-4 py-3 flex items-center justify-between">
      <div>
        <span class="text-sm font-medium text-neutral-400">{name}</span>
        <span class="text-xs text-neutral-600 ml-2">{description}</span>
      </div>
      <span class="text-xs text-neutral-600">Soon</span>
    </div>
  );
}
