# Open Source Release Checklist

Use this checklist when making the repository public.

## Before changing visibility

- Confirm `web/wrangler.jsonc` is not tracked and contains no production-only values in the public branch.
- Confirm `web/.dev.vars` is not tracked.
- Review `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, and issue templates.
- Keep launch limitations visible: [#77](https://github.com/JoviDeCroock/le-chien/issues/77), [#78](https://github.com/JoviDeCroock/le-chien/issues/78), and [#79](https://github.com/JoviDeCroock/le-chien/issues/79).
- Enable GitHub private vulnerability reporting if the repository will accept security reports.

## Publish

- Merge the OSS-readiness branch into `main`.
- Change the repository visibility to public.
- Add repository topics such as `cloudflare-workers`, `durable-objects`, `preact`, `ai-chat`, and `hono`.
- Create a `v0.1.0` tag from the public `main` branch.
- Announce it as a reference implementation/starter, not a fully production-hardened SaaS.

## After publish

- Keep launch readiness work in GitHub Issues.
- Convert high-context docs into smaller contributor-friendly issues.
- Add screenshots or a short demo video from a deployed preview environment.
