# Polar Cost-Insights Integration

## Overview

Every LLM inference triggers a cost event sent to Polar's Event Ingestion API.
Polar aggregates these alongside revenue data so you can see per-customer
profitability on the Polar dashboard.

## How it works

After each `streamText()` call completes in the ChatAgent, we read the token
usage from the AI SDK response and fire a `llm.inference` event to Polar with:

- `_llm` metadata (vendor, model, input/output/total tokens)
- `external_customer_id` set to the user's ID

The call is fire-and-forget — failures are logged but never block the response.

## Customer creation

`createCustomerOnSignUp: true` in the BetterAuth Polar plugin automatically
creates a Polar customer whenever a user registers. This means every user has a
Polar customer record from day one, which cost-insights events are attributed to.

## Webhook URL

Polar webhooks are handled by the BetterAuth Polar plugin at:

```
https://chien.resynapse.dev/api/auth/polar/webhook
```

Configure this URL in Polar dashboard under Webhooks. The secret is stored in
the `POLAR_WEBHOOK_SECRET` environment variable.

## Enabling cost-insights

Cost-insights is a beta feature. Enable it in your Polar organization settings
before events will be aggregated into metrics.
