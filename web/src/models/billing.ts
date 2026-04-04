import { signal, createModel } from "@preact/signals";
import { authClient } from "../lib/auth";
import { trackEvent, captureException } from "../lib/posthog";
import type { SubscriptionSnapshot } from "../../server/lib/plans";

export const BillingModel = createModel(() => {
  const loading = signal(true);
  const error = signal<string | null>(null);
  const snapshot = signal<SubscriptionSnapshot | null>(null);
  const checkoutPending = signal(false);

  const fetchSubscription = async () => {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch("/api/subscription");
      if (!res.ok) throw new Error("Failed to load billing info");
      snapshot.value = await res.json();
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to load billing info";
      captureException(err instanceof Error ? err : new Error("Failed to load billing info"), {
        source: "billing",
      });
    } finally {
      loading.value = false;
    }
  };

  const startCheckout = async () => {
    if (checkoutPending.value) return;
    checkoutPending.value = true;
    try {
      trackEvent("checkout_started", { plan: "pro", source: "billing_page" });
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

  const openCustomerPortal = async () => {
    try {
      trackEvent("customer_portal_opened", { source: "billing_page" });
      await (authClient as any).portal();
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Failed to open billing portal";
      captureException(err instanceof Error ? err : new Error("Failed to open billing portal"), {
        source: "billing",
      });
    }
  };

  return {
    loading,
    error,
    snapshot,
    checkoutPending,
    fetchSubscription,
    startCheckout,
    openCustomerPortal,
  };
});
