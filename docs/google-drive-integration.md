# Google Drive Integration

## Overview

Users can connect their Google account to let le chien search, browse, and read
files from Google Drive. The integration is read-only (`drive.readonly` scope).

## Architecture

### OAuth Flow

1. User clicks "Connect Google Drive" on `/integrations`
2. Redirects to `/api/v1/integrations/google/connect`, which builds a Google
   OAuth consent URL and redirects
3. Google redirects back to `/api/v1/integrations/google/callback` with an auth
   code
4. Server exchanges code for access + refresh tokens, fetches user info, and
   upserts into the `integration` table
5. Redirects to `/integrations?google=connected`

State is a base64-encoded JSON with `{ userId }` to verify the callback matches
the logged-in session.

### Token Storage

Tokens are stored in the `integration` D1 table. The table is generic (keyed by
`userId` + `provider`) so it can be reused for future integrations (Notion,
Slack, etc).

Access tokens are auto-refreshed when they expire within 5 minutes, via
`getValidGoogleToken()` in `server/lib/google.ts`.

### Tools

Three tools are conditionally included when a user has a Google integration:

| Tool                  | Description                                   |
| --------------------- | --------------------------------------------- |
| `google_drive_search` | Full-text search across Drive files            |
| `google_drive_list`   | List recent files or contents of a folder      |
| `google_drive_read`   | Read file content (exports Google Docs as text)|

Tools are defined in `server/lib/google-drive-tools.ts` and wired into
`createTools()` via the `googleAccessToken` option.

### Frontend

- `/integrations` page: connect/disconnect Google, view status, see upcoming
  integrations
- `ToolCallCard` renders Drive results as clickable file cards (similar to web
  search results)
- Nav link added to TopBar in the Chat page

## Environment Variables

Two new secrets are required:

- `GOOGLE_CLIENT_ID` — from Google Cloud Console OAuth credentials
- `GOOGLE_CLIENT_SECRET` — from Google Cloud Console OAuth credentials

The OAuth redirect URI must be configured in Google Cloud Console as:
`{APP_URL}/api/v1/integrations/google/callback`

## Google Scopes

- `drive.readonly` — read files and metadata
- `userinfo.email` — identify the connected account
- `userinfo.profile` — display name for the connected account
