# Worker Runtime Notes

## Better Auth isolate caching

`api/src/lib/auth.ts` caches the Better Auth instance in a module-level `WeakMap`, keyed by the Worker `env` object.

Why this exists:

- Cloudflare reuses the same module instance across requests within a Worker isolate.
- Without caching, each authenticated request rebuilt Better Auth, Drizzle, and the Polar client even though the configuration was identical for that isolate.
- Keying by `env` keeps the cache isolate-local and avoids leaking auth instances across environments.

This is a per-isolate optimization only. New isolates still construct their own auth instance on first use.
