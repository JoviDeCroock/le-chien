# Free Tier Limits

The free plan now uses a hard server-side daily message counter with a soft UX boundary.

## Implementation notes

- The counter lives in D1 (`daily_message_usage`) instead of the per-user Durable Object.
- `ChatAgent` still enforces the limit at send time, but D1 keeps usage visible to the existing subscription API and tied to billing state in one place.
- The free tier is currently set to `20` messages per UTC day. Pro remains unlimited.
- The last free message is allowed to finish streaming. After that response completes, the chat input is disabled and the upgrade banner appears.
- If a send fails before completion, the reserved usage slot is returned so users do not lose quota to backend errors.

## Checkout UX note

- Polar checkout and checkout-success redirects now return to `/` because the app does not have a dedicated `/billing` route yet.
