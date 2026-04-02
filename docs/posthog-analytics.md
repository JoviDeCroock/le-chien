# PostHog Analytics & Error Detection

## Overview

PostHog is integrated on both client (web) and server (API) for product analytics and error detection.

## Configuration

### Web (client-side)

Set these environment variables (Vite):

- `VITE_POSTHOG_KEY` — PostHog project API key (required to enable tracking)
- `VITE_POSTHOG_HOST` — PostHog instance URL (defaults to `https://us.i.posthog.com`)

If `VITE_POSTHOG_KEY` is not set, all tracking is silently disabled.

### API (server-side)

Set these via `wrangler secret put`:

- `POSTHOG_API_KEY` — PostHog project API key (required to enable tracking)
- `POSTHOG_HOST` — PostHog instance URL (optional, defaults to `https://us.i.posthog.com`)

## Tracked Events

### Client-side

| Event | When | Properties |
|-------|------|------------|
| `$pageview` | Route change | `$current_url` |
| `message_sent` | User sends a message | `model`, `conversation_id`, `message_length` |
| `message_completed` | Stream finishes | `model`, `conversation_id`, `duration_ms` |
| `message_blocked` | Free tier limit hit | `reason`, `plan` |
| `conversation_created` | New conversation | `model` |
| `model_selected` | Model switcher used | `model` |
| `checkout_started` | User clicks upgrade | `plan` |
| `user_signed_out` | User signs out | — |

### Server-side

| Event | When | Properties |
|-------|------|------------|
| `chat_completion` | AI response fully streamed | `model`, `conversation_id`, `tool_calls_count`, `response_length` |
| `subscription_activated` | Billing checkout succeeds | `plan`, `polar_subscription_id` |

## Error Detection

### Client-side

- **Global exception capture**: `capture_exceptions: true` in PostHog config catches unhandled errors automatically
- **Error boundary**: Preact `useErrorBoundary` in the app root catches render errors and reports via `captureException`
- **Explicit capture**: All catch blocks in auth and chat models report errors with context (source, model, conversation ID)

### Server-side

- Stream failures and AI model errors are captured with `captureServerException` including model and conversation context

## User Identification

Users are identified via `posthog.identify()` when their session is loaded (on page load or login). Properties sent: `name`, `email`. On sign out, `posthog.reset()` clears the identity.

## Architecture

- `web/src/lib/posthog.ts` — Client-side PostHog wrapper (init, identify, track, capture)
- `api/src/lib/posthog.ts` — Server-side PostHog wrapper (singleton client, track, capture)
- PostHog is configured with `flushAt: 1` and `flushInterval: 0` on the server to flush immediately (appropriate for Workers where the process may terminate after the response).
