## EU Region Validation

This document resolves the first engineering todo: validate whether the current stack can honestly support the product claim that user data stays in Europe.

## Short verdict

- D1 can be pinned to the EU.
- Durable Objects can be pinned to the EU.
- Workers runtime can be regionalized for normal Worker execution, but only with Cloudflare Data Localization features.
- Workers AI does not currently expose a documented EU-only inference pinning mechanism.
- Polar data residency is not confirmed from public docs.
- No email provider is configured in this repo today.

Result: we cannot honestly claim that AI inference and all customer data stay in the EU yet.

## Repo facts checked

- `api/wrangler.jsonc` binds `AI`, `DB`, and `CHAT_AGENT`, and now enables `placement.mode: "smart"` for backend latency.
- `README.md` tells operators to create D1 with `wrangler d1 create app-db`, which does not enforce EU jurisdiction.
- `README.md` now tells operators to create the production D1 database with `wrangler d1 create app-db --jurisdiction=eu`.
- `api/src/index.ts` now forwards chat traffic to the Durable Object with `getAgentByName(c.env.CHAT_AGENT, user.id, { jurisdiction: "eu" })`.
- `api/src/lib/models.ts` calls Workers AI directly through the `AI` binding.
- `api/src/lib/auth.ts` uses Polar for billing.
- The auth setup enables email/password auth, but there is no outbound email provider configuration in the repo.

## Findings

| Surface | What Cloudflare documents | Repo implication | Verdict |
| --- | --- | --- | --- |
| Worker runtime | Worker placement is about latency, not legal residency. `placement.mode`, `placement.region`, and `placement.host` optimize where `fetch` runs. Regional Services is the feature that keeps TLS termination and Worker execution inside a region. | `api/wrangler.jsonc` now enables Smart Placement, which is worth doing for performance, but it is still not an EU residency guarantee. | Improved latency posture, but still not sufficient for sovereignty claims on its own. |
| D1 | D1 supports `--jurisdiction=eu` at database creation time. Jurisdiction is a real constraint; location hints are only best effort. Jurisdiction cannot be changed after creation. | The setup docs now require `--jurisdiction=eu`, so new production databases can be created correctly. Existing non-EU databases would still need replacement. | Yes, D1 can be EU-pinned, and the repo now documents the correct creation path. |
| Durable Objects | Durable Objects support `namespace.jurisdiction("eu")` for a real jurisdiction constraint. `locationHint` is only best effort and only affects first placement. Cloudflare also notes Durable Object IDs may be logged outside the jurisdiction for billing/debugging. | The chat route now requests the agent with `jurisdiction: "eu"`, which is the right repo-side constraint for DO state locality. | Yes, DO data can be EU-constrained, and the repo now does that for chat. |
| Workers AI | Workers AI docs describe data usage and say customer content is not used for training. Cloudflare's Data Localization compatibility table marks Workers AI as compatible with Customer Metadata Boundary, but incompatible with Regional Services. I found no documented Workers AI feature that pins inference execution to the EU. | The app calls Workers AI directly via `env.AI`. There is no documented way in this repo or in Cloudflare docs to guarantee that prompts and outputs are processed only in EU regions. | Blocker. The product claim is not validated. |
| Customer logs/metadata | Customer Metadata Boundary keeps customer logs in the EU, but that only covers metadata/log storage, not where inference executes. | Useful for compliance hardening, but it does not fix the Workers AI inference-location problem. | Helpful, but not enough. |
| Polar | Public Polar product docs explain billing flows, but I did not find a public data residency guarantee for EU-only processing/storage from the docs reviewed. | Billing/customer data sent to Polar should be treated as non-validated for EU-only claims until legal/vendor confirmation exists. | Unresolved. |
| Email provider | No outbound email provider is configured in the repo today. The auth code does not define email verification or invite delivery infrastructure. | There is nothing to audit yet, but future verification/invite mail must choose an EU-acceptable provider before launch claims are made. | N/A for current code; open requirement for later. |

## What this means for the product claim

The statement "AI inference + conversations stay in Europe" is not supportable yet.

What we can potentially make true:

- D1 data stored in the EU.
- Durable Object state stored in the EU.
- Worker execution and TLS termination regionalized to the EU if we adopt the right Cloudflare enterprise features.

What is still missing:

- A documented EU-only guarantee for Workers AI inference.
- A documented EU-only guarantee for Polar.

## Required follow-up before launch copy

1. Ask Cloudflare directly whether Workers AI supports EU-only inference execution for prompts and outputs, and whether that guarantee is available on self-serve or only through enterprise agreements.
2. If the answer is no, change the product positioning away from "all AI stays in Europe" or replace Workers AI with an inference provider that contractually guarantees EU processing.
3. Recreate any existing non-EU production D1 database before launch if EU-only storage is a hard requirement.
4. Get a written Polar answer or DPA/subprocessor confirmation before making any EU-only billing/data residency statement.
5. When email verification or invites are added, choose and document an EU-acceptable provider.

## Source documents reviewed

- Cloudflare D1 data location: `https://developers.cloudflare.com/d1/configuration/data-location/`
- Cloudflare Durable Objects data location: `https://developers.cloudflare.com/durable-objects/reference/data-location/`
- Cloudflare Workers placement: `https://developers.cloudflare.com/workers/configuration/placement/`
- Cloudflare Workers AI data usage: `https://developers.cloudflare.com/workers-ai/platform/data-usage/`
- Cloudflare Data Localization compatibility: `https://developers.cloudflare.com/data-localization/compatibility/`
- Cloudflare Regional Services: `https://developers.cloudflare.com/data-localization/regional-services/`
- Cloudflare Customer Metadata Boundary: `https://developers.cloudflare.com/data-localization/metadata-boundary/`
- Polar docs index: `https://polar.sh/docs/llms.txt`
