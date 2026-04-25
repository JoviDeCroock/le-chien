# Security Policy

## Supported Versions

Security fixes target `main`. This project is pre-1.0, so older snapshots are not supported.

## Reporting a Vulnerability

Please do not open public issues for suspected vulnerabilities.

Report privately through GitHub Security Advisories if available, or contact the maintainer through the GitHub profile linked from this repository. Include:

- affected route, component, or file;
- reproduction steps;
- expected impact;
- any logs or screenshots with secrets redacted.

## Secrets

Do not commit real `.dev.vars`, `web/wrangler.jsonc`, API keys, account IDs that identify private infrastructure, or webhook secrets. Use `web/.dev.vars.example` and `web/wrangler.example.jsonc` as templates.
