/**
 * Billing is opt-in. Self-hosted deployments leave `BILLING_ENABLED` unset (or
 * set it to anything other than `"true"`) and every user is treated as Pro
 * with no rate limits. Polar checkout, webhooks, and cost-event tracking are
 * skipped entirely so no Polar credentials are required.
 */
export const isBillingEnabled = (env: Cloudflare.Env): boolean =>
  (env.BILLING_ENABLED as string | undefined) === "true";
