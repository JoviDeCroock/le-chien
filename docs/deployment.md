# Deployment Guide

This guide deploys le chien to Cloudflare Workers with D1, Durable Objects, Workers AI, Polar, and optional analytics/search integrations.

## Prerequisites

- Node.js 20+ and pnpm.
- A Cloudflare account with Workers, D1, Durable Objects, Workers AI, Browser Rendering, and AI Gateway access.
- A Polar account and Pro product if billing is enabled.
- Optional PostHog and Tavily accounts.

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
- `POLAR_PRO_PRODUCT_ID`: Polar Pro product ID.
- `d1_databases[0].database_id`: remote D1 database ID after creation.

## 2. Log in to Cloudflare

```sh
cd web
npx wrangler login
```

## 3. Create D1

Create the remote database once:

```sh
npx wrangler d1 create chien-db
```

Copy the returned `database_id` into `web/wrangler.jsonc`. If you need EU data location, create it with `--jurisdiction=eu`; jurisdiction cannot be changed later.

## 4. Configure secrets

Set required production secrets:

```sh
cd web
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put POLAR_ACCESS_TOKEN
npx wrangler secret put POLAR_WEBHOOK_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put CF_API_TOKEN
```

Optional integrations:

```sh
npx wrangler secret put POSTHOG_API_KEY
npx wrangler secret put TAVILY_API_KEY
```

`POLAR_PRO_PRODUCT_ID` and `CF_ACCOUNT_ID` can live in `web/wrangler.jsonc` because they are identifiers, not credentials. If you prefer to keep them out of config, set them with `wrangler secret put` instead.

## 5. Configure Polar

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
