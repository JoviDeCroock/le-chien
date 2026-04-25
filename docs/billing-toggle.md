# Billing toggle (`BILLING_ENABLED`)

Polar billing is opt-in. The flag is `BILLING_ENABLED` (read by `web/server/utils/billingEnabled.ts`):

- **Unset / not `"true"`** → "self-hosted" mode. Every signed-in user is treated as `pro`. Daily message, premium-message, image-generation, and web-search limits are bypassed. The Polar plugin, webhooks, checkout success route, and cost-event ingestion are all skipped.
- **`"true"`** → existing SaaS behavior. Free vs Pro tiers, daily caps, and Polar metering are enforced. The auth bootstrap throws if `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, or `POLAR_PRO_PRODUCT_ID` is missing — no silent half-configured state.

## Where the flag is read

| File                                       | Effect when disabled                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `web/server/lib/auth.ts`                   | `polar(...)` plugin is not registered; checkout/portal/webhook routes 404. |
| `web/server/lib/plans.ts`                  | `getUserPlan` returns `"pro"`, `getSubscriptionSnapshot` zeros web search. |
| `web/server/lib/polar-events.ts`           | `trackInferenceCost` is a no-op.                                           |
| `web/server/index.ts`                      | `/api/billing-success` returns 404.                                        |
| `web/server/agents/chat-agent.ts`          | `enforceRateLimits` is false, so no message/premium counters are touched.  |
| `web/src/pages/Billing/index.tsx`          | Shows a "self-hosted" card instead of pricing/checkout.                    |

## Frontend signal

`SubscriptionSnapshot.billingEnabled` is plumbed through `/api/v1/subscription` so the Billing page can show the right state without fetching a second endpoint.

## Why explicit, not implicit

We considered tying the toggle to the presence of `POLAR_ACCESS_TOKEN`. Explicit `BILLING_ENABLED=true` is safer: clearing the token in production by accident would silently grant everyone Pro under that scheme. With the explicit flag, you have to mean it.
