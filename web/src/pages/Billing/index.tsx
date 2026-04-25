import { useEffect } from "preact/hooks";
import { useModel } from "@preact/signals";
import { useLocation } from "preact-iso";
import { AuthModel } from "../../models/auth";
import { BillingModel } from "../../models/billing";
import { Button } from "../../components/ui/Button";
import { Card, PageLoader } from "../../components/ui/Layout";
import { PLAN_LIMITS } from "../../../server/lib/plans";

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return <span class="text-sm text-neutral-400">Unlimited</span>;
  }

  const pct = Math.min((used / limit) * 100, 100);
  const isHigh = pct >= 80;

  return (
    <div class="flex items-center gap-3">
      <div class="flex-1 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
        <div
          class={`h-full rounded-full transition-all ${isHigh ? "bg-amber-500" : "bg-violet-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span class="text-sm text-neutral-400 tabular-nums shrink-0">
        {used}/{limit}
      </span>
    </div>
  );
}

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  return (
    <div class="space-y-1.5">
      <div class="text-sm text-neutral-300">{label}</div>
      <UsageBar used={used} limit={limit} />
    </div>
  );
}

function formatResetTime(isoString: string) {
  const reset = new Date(isoString);
  const now = new Date();
  const diffMs = reset.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `Resets in ${hours}h ${mins}m`;
  if (mins > 0) return `Resets in ${mins}m`;
  return "Resets soon";
}

export function Billing() {
  const { route } = useLocation();
  const auth = useModel(AuthModel);
  const billing = useModel(BillingModel);

  useEffect(() => {
    auth.checkSession();
  }, []);

  useEffect(() => {
    if (!auth.loading.value && !auth.authenticated.value) {
      route("/auth");
    }
    if (auth.authenticated.value) {
      billing.fetchSubscription();
    }
  }, [auth.loading.value, auth.authenticated.value]);

  if (auth.loading.value || (auth.authenticated.value && billing.loading.value)) {
    return <PageLoader label="Loading billing" />;
  }

  const snap = billing.snapshot.value;

  return (
    <div class="min-h-screen bg-neutral-950 font-sans text-neutral-300">
      {/* Top bar */}
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
        <h1 class="text-2xl font-bold text-white tracking-tight mb-8">Billing</h1>

        {billing.error.value && !snap ? (
          <Card class="text-center py-12">
            <p class="text-neutral-400 mb-4">Couldn't load billing info.</p>
            <Button variant="secondary" size="sm" onClick={() => billing.fetchSubscription()}>
              Retry
            </Button>
          </Card>
        ) : snap && !snap.billingEnabled ? (
          <Card>
            <div class="text-xs font-medium tracking-wide text-neutral-500 uppercase mb-1">
              Self-hosted
            </div>
            <div class="text-xl font-bold text-white mb-2">Billing is disabled</div>
            <p class="text-sm text-neutral-400">
              This deployment runs without Polar billing. All users have unlimited access and no
              daily limits are enforced. To enable billing, set{" "}
              <code class="text-neutral-300">BILLING_ENABLED=true</code> and configure the Polar
              secrets.
            </p>
          </Card>
        ) : snap ? (
          <div class="space-y-6">
            {/* Current plan */}
            <Card>
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="text-xs font-medium tracking-wide text-neutral-500 uppercase mb-1">
                    Current plan
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xl font-bold text-white">
                      {snap.plan === "pro" ? "Pro" : "Free"}
                    </span>
                    {snap.plan === "pro" && (
                      <span class="text-xs font-medium bg-violet-600/20 text-violet-400 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <p class="text-sm text-neutral-400 mt-1">
                    {snap.plan === "pro"
                      ? "Unlimited messages, premium models, and priority inference."
                      : "10 messages per day with access to all model modes."}
                  </p>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-2xl font-bold text-white tracking-tight">
                    {snap.plan === "pro" ? "€8" : "€0"}
                    <span class="text-sm font-normal text-neutral-500">/mo</span>
                  </div>
                </div>
              </div>

              <div class="mt-6 pt-4 border-t border-neutral-800 flex flex-col gap-3 sm:flex-row sm:items-center">
                {snap.plan === "free" ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => billing.startCheckout()}
                    disabled={billing.checkoutPending.value}
                  >
                    {billing.checkoutPending.value ? "Redirecting..." : "Upgrade to Pro"}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => billing.openCustomerPortal()}
                  >
                    Manage billing
                  </Button>
                )}
              </div>
            </Card>

            {/* Usage */}
            {snap.plan === "free" && (
              <Card>
                <div class="flex items-center justify-between mb-5">
                  <h2 class="text-sm font-medium text-white">Today's usage</h2>
                  <span class="text-xs text-neutral-500">
                    {formatResetTime(snap.usage.resetsAt)}
                  </span>
                </div>
                <div class="space-y-5">
                  <UsageRow
                    label="Messages"
                    used={snap.usage.dailyMessagesUsed}
                    limit={PLAN_LIMITS.free.dailyMessages}
                  />
                  <UsageRow
                    label="Premium model messages"
                    used={snap.usage.dailyPremiumMessagesUsed}
                    limit={PLAN_LIMITS.free.dailyPremiumMessages}
                  />
                  <UsageRow
                    label="Image generations"
                    used={snap.usage.dailyImageGenerationsUsed}
                    limit={PLAN_LIMITS.free.dailyImageGenerations}
                  />
                  <UsageRow
                    label="Read-aloud"
                    used={snap.usage.dailyTtsRequestsUsed}
                    limit={PLAN_LIMITS.free.dailyTtsRequests}
                  />
                </div>
              </Card>
            )}

            {/* Plan comparison */}
            <div>
              <h2 class="text-sm font-medium tracking-wide text-neutral-500 uppercase mb-4">
                Compare plans
              </h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PlanCard
                  name="Free"
                  price="€0"
                  features={[
                    `${PLAN_LIMITS.free.dailyMessages} messages/day`,
                    `${PLAN_LIMITS.free.dailyPremiumMessages} premium model messages/day`,
                    `${PLAN_LIMITS.free.dailyImageGenerations} image generations/day`,
                    "All model modes",
                    "Persistent memory",
                  ]}
                  current={snap.plan === "free"}
                />
                <PlanCard
                  name="Pro"
                  price="€8"
                  features={[
                    "Unlimited messages",
                    "Unlimited premium models",
                    "Unlimited image generations",
                    "File upload & retrieval",
                    "Shared workspaces",
                    "Priority inference",
                  ]}
                  current={snap.plan === "pro"}
                  highlighted
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  features,
  current,
  highlighted,
}: {
  name: string;
  price: string;
  features: string[];
  current: boolean;
  highlighted?: boolean;
}) {
  return (
    <div
      class={`border rounded-lg p-6 transition-colors ${
        highlighted
          ? "border-violet-600/40 bg-neutral-900"
          : "border-neutral-800 hover:border-neutral-700"
      }`}
    >
      <div class="flex items-center justify-between mb-3">
        <span
          class={`text-sm font-semibold uppercase tracking-wide ${
            highlighted ? "text-violet-400" : "text-neutral-400"
          }`}
        >
          {name}
        </span>
        {current && (
          <span class="text-xs font-medium bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full">
            Current
          </span>
        )}
      </div>
      <div class="text-2xl font-bold text-white mb-4 tracking-tight">
        {price}
        <span class="text-sm font-normal text-neutral-500">/mo</span>
      </div>
      <ul class="space-y-2.5 text-sm text-neutral-400">
        {features.map((f) => (
          <li key={f} class="flex items-start gap-2">
            <svg
              class="w-4 h-4 text-neutral-500 shrink-0 mt-0.5"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 8.5L6.5 12L13 4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
