# Deployment Guide

This guide deploys le chien to Cloudflare Workers with D1, Durable Objects, Workers AI, Polar, and optional analytics/search integrations.

## Prerequisites

- Node.js 20+ and pnpm.
- A Cloudflare account with Workers, D1, Durable Objects, Workers AI, Browser Rendering, and AI Gateway access.
- A Polar account and Pro product **only if** you set `BILLING_ENABLED=true`. Self-hosted/internal deployments can leave billing off entirely.
- Optional PostHog and Tavily accounts.
- Optional `jq` for inspecting JSON responses from Cloudflare API commands.

## 1. Create local deployment config

`web/wrangler.jsonc` is intentionally gitignored. Keep it local so public branches do not expose account IDs, database IDs, product IDs, or production URLs.

```sh
cp web/wrangler.example.jsonc web/wrangler.jsonc
```

Edit `web/wrangler.jsonc`:

- `APP_URL`: production origin, for example `https://chat.example.com`.
- `BETTER_AUTH_URL`: `${APP_URL}/api/auth`.
- `LOCAL`: `false`.
- `CF_ACCOUNT_ID`: Cloudflare account ID.
- `CF_AI_GATEWAY_ID`: AI Gateway ID.
- `BILLING_ENABLED`: `"true"` to enable Polar billing, `"false"` (or omit) to run without it.
- `POLAR_PRO_PRODUCT_ID`: Polar Pro product ID. Only required when `BILLING_ENABLED=true`.
- `d1_databases[0].database_id`: remote D1 database ID after creation.

## 2. Log in to Cloudflare

```sh
cd web
npx wrangler login
```

## 3. Create Cloudflare resources

Set shell variables used by the commands below:

```sh
cd web
export CF_ACCOUNT_ID="<your-cloudflare-account-id>"
export CF_AI_GATEWAY_ID="chien-gateway"
export D1_DATABASE_NAME="chien-db"
export CLOUDFLARE_API_TOKEN="<token-with-ai-gateway-read-edit>"
```

Use a Cloudflare API token with AI Gateway Read/Edit permissions for `CLOUDFLARE_API_TOKEN`. You can reuse the same value later for the app's `CF_API_TOKEN` secret if your deployment needs a Cloudflare API token.

### D1

Create the remote D1 database and let Wrangler write the binding into your local, ignored `web/wrangler.jsonc`:

```sh
pnpm exec wrangler d1 create "$D1_DATABASE_NAME" \
  --binding DB \
  --jurisdiction eu \
  --update-config
```

Omit `--jurisdiction eu` if you do not need EU-only storage. If you only want a location hint instead of a jurisdiction restriction, replace it with a `--location` value such as `weur`, `eeur`, `wnam`, or `enam`.

Confirm the remote database:

```sh
pnpm exec wrangler d1 info "$D1_DATABASE_NAME"
```

### AI Gateway

Wrangler does not currently expose an `ai-gateway create` command. Create the gateway through the Cloudflare API:

```sh
curl --fail --request POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai-gateway/gateways" \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  --header "Content-Type: application/json" \
  --data "{\"id\":\"${CF_AI_GATEWAY_ID}\",\"collect_logs\":true}"
```

Confirm the gateway:

```sh
curl --fail \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai-gateway/gateways/${CF_AI_GATEWAY_ID}" \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
```

Update `web/wrangler.jsonc` so `vars.CF_ACCOUNT_ID` and `vars.CF_AI_GATEWAY_ID` match the values above.

### Workers AI, Browser Rendering, and Durable Objects

These are configured as bindings in `web/wrangler.jsonc` and are provisioned/connected by Wrangler during deploy:

- `ai.binding = "AI"` enables Workers AI at `env.AI`.
- `browser.binding = "BROWSER"` enables Browser Rendering at `env.BROWSER`.
- `durable_objects.bindings` plus `migrations` creates/connects `ChatAgent`.

You can confirm Workers AI access from the CLI:

```sh
pnpm exec wrangler ai models --json
```

## 4. Configure secrets

Set required production secrets:

```sh
cd web
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put CF_API_TOKEN
```

Only when `BILLING_ENABLED=true`:

```sh
npx wrangler secret put POLAR_ACCESS_TOKEN
npx wrangler secret put POLAR_WEBHOOK_SECRET
```

Optional integrations:

```sh
npx wrangler secret put POSTHOG_API_KEY
npx wrangler secret put TAVILY_API_KEY
```

`POLAR_PRO_PRODUCT_ID` and `CF_ACCOUNT_ID` can live in `web/wrangler.jsonc` because they are identifiers, not credentials. If you prefer to keep them out of config, set them with `wrangler secret put` instead.

## 5. Configure Polar

Skip this section if `BILLING_ENABLED` is not `"true"`. Without billing, every signed-in user is treated as Pro and no Polar credentials are required.

In Polar:

1. Create or select the Pro product.
2. Add a production webhook endpoint: `https://<your-domain>/api/auth/polar/webhook`.
3. Subscribe to `subscription.updated`, `subscription.active`, `subscription.canceled`, `subscription.revoked`, and `customer.created`.
4. Copy the webhook signing secret into `POLAR_WEBHOOK_SECRET`.

When `LOCAL=false`, Polar runs against production. Use sandbox credentials only with local or preview environments.

## 6. Run remote migrations

```sh
cd web
pnpm run db:migrate:remote
```

Run this before the first deploy and whenever `web/drizzle/migrations/` changes.

## 7. Validate before deploy

```sh
pnpm -w run check
pnpm --dir web run typecheck
pnpm --dir web run build
```

The build requires a local `web/wrangler.jsonc`; use the example as a starting point if you are only validating CI-style builds.

## 8. Deploy

```sh
cd web
pnpm run deploy
```

The Worker serves the frontend assets and API from the same deployment.

## 9. Verify production

After deploy:

- Open `APP_URL` and confirm the landing page loads.
- Open `/auth` and confirm sign-in/sign-up renders.
- Sign up with a test user and send a short chat message.
- Complete a Polar checkout in the intended environment.
- Confirm the Polar webhook updates subscription state.
- Confirm optional PostHog and Tavily paths fail gracefully when not configured.

## Rollback

Use Wrangler deployments to inspect and roll back:

```sh
cd web
npx wrangler deployments list
npx wrangler rollback
```

If a migration caused the issue, rollback the Worker first, then decide whether the D1 schema needs a forward fix. Avoid destructive D1 changes without a backup/export.

## Production checklist

- `web/wrangler.jsonc` exists locally and remains ignored.
- `APP_URL` and `BETTER_AUTH_URL` match the deployed domain.
- Remote D1 `database_id` is configured.
- Required secrets are set with `wrangler secret put`.
- Polar webhook endpoint and events are configured.
- Launch blockers are reviewed: [#77](https://github.com/JoviDeCroock/le-chien/issues/77), [#78](https://github.com/JoviDeCroock/le-chien/issues/78), [#79](https://github.com/JoviDeCroock/le-chien/issues/79).
