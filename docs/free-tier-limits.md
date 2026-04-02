# Free Tier Limits

The free plan now uses a hard server-side daily message counter with a soft UX boundary.

## Implementation notes

- The counter lives in D1 (`daily_message_usage`) instead of the per-user Durable Object.
- `ChatAgent` still enforces the limit at send time, but D1 keeps usage visible to the existing subscription API and tied to billing state in one place.
- The free tier is currently set to `20` messages per UTC day. Pro remains unlimited.
- The last free message is allowed to finish streaming. After that response completes, the chat input is disabled and the upgrade banner appears.
- If a send fails before completion, the reserved usage slot is returned so users do not lose quota to backend errors.

## Premium models

- Some models (e.g. Kimi K2.5) are flagged `premium: true` in the model spec.
- Premium messages count towards the general daily limit **and** a separate premium limit.
- Free plan: 5 premium messages per UTC day. Pro: unlimited.
- When the premium limit is hit, the model selector disables premium models and shows a banner prompting upgrade.
- If a premium increment fails after the general counter was already bumped, the general counter is rolled back before blocking.
- Premium usage is tracked in a separate `daily_premium_message_usage` D1 table with the same schema as general usage.

## Checkout UX note

- Polar checkout and checkout-success redirects now return to `/` because the app does not have a dedicated `/billing` route yet.
