# Dependency compatibility notes

## Polar Better Auth plugin

`@polar-sh/better-auth@1.8.0` imports `createAuthEndpoint` from `better-auth/plugins`, but `better-auth@1.6.9` exports that helper from `better-auth/api`. This causes Vite/Rolldown dependency optimization to fail with a missing export error.

Use `@polar-sh/better-auth >= 1.8.3` with `@polar-sh/sdk >= 0.46.4`; the plugin imports Better Auth endpoint helpers from `better-auth/api` in that version line.
