# Security Hardening Notes - 2026-04-25

## Dynamic Workers for untrusted JavaScript

Security review findings SEC-001 and SEC-002 were addressed by moving
untrusted artifact and `run_javascript` execution out of the app Worker and into
Cloudflare Dynamic Workers. The app Worker uses the Worker Loader binding
(`LOADER`) and passes `globalOutbound: null` so dynamically loaded code does not
inherit outbound network access.

The browser artifact path now renders sanitized JSON VDOM returned by the
server. It no longer evaluates model-generated JavaScript and no longer trusts a
worker to replay DOM operations into the main document.

Useful Cloudflare references:

- https://blog.cloudflare.com/dynamic-workers/
- https://developers.cloudflare.com/dynamic-workers/
- https://developers.cloudflare.com/dynamic-workers/usage/egress-control/

## URL Reading Boundary

`read_url` is now a fetch-only public HTTP(S) reader with a local URL policy:

- rejects non-http(s) schemes;
- rejects embedded credentials;
- rejects local, private, reserved, multicast, and link-local IP literals;
- rejects common local/internal host suffixes;
- follows redirects manually and revalidates every hop;
- caps response bytes before text extraction.

The previous Browser Rendering fallback was removed because a browser session is
a much larger SSRF and rendering primitive. If JS-heavy page support comes back,
it needs request interception and the same redirect/egress policy before
navigating.

## Agent RPC Boundary

Durable Object callable methods now normalize and bound user-controllable
arguments before SQL or model calls:

- UUID-shaped ids for conversation and memory methods;
- title, message, memory key, and memory value length limits;
- model ids restricted to the configured model map;
- enabled extra tools restricted to the known allowlist.

The Agent forwarding route also rejects production WebSocket/RPC requests whose
`Origin` does not match the configured app origin.

## App Headers

Security headers moved from API-only responses to all app responses. API routes
keep a `default-src 'none'` CSP, while the app shell gets a stricter allowlist
for scripts, styles, fonts, images, media, workers, and PostHog connections.
