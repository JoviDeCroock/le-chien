# Microsoft Graph Integration

## Overview

Businesses can connect their Microsoft 365 account so the chat assistant can search and read their OneDrive/SharePoint files and Teams conversations. This is a separate data-access integration, not a social login — users still authenticate via email/password.

## Architecture

### OAuth Flow

Uses Microsoft identity platform v2.0 with the `/common/` tenant (multi-org support). The flow:

1. User clicks "Connect Microsoft 365" on `/integrations`
2. Frontend calls `GET /api/v1/microsoft/connect` to get the authorization URL
3. User is redirected to Microsoft login with a HMAC-signed state parameter
4. On callback (`GET /api/microsoft/callback`), the state is verified, tokens are exchanged, and the Microsoft profile is fetched
5. Tokens are stored in the `microsoft_connection` table (one connection per user)

The callback is a public route (outside session middleware) because it's a browser redirect from Microsoft. Authentication is handled via the signed state parameter, which encodes the userId and has a 5-minute expiration.

### Token Management

- Access tokens expire after ~1 hour
- `getValidAccessToken()` checks expiration with a 5-minute buffer and auto-refreshes
- If the refresh token is revoked (`invalid_grant`), the connection is deleted
- Tokens are stored encrypted-at-rest via D1

### Graph API Tools

Three tools are conditionally available when the user has an active Microsoft connection and enables "Microsoft 365" in the chat extras dropdown:

| Tool | Graph Endpoint | Purpose |
|------|---------------|---------|
| `microsoft_search_files` | `POST /v1.0/search/query` (driveItem) | Search OneDrive/SharePoint files |
| `microsoft_read_file` | `GET /v1.0/drives/{driveId}/items/{id}/content` | Read file content (text-based) |
| `microsoft_search_teams` | `POST /v1.0/search/query` (chatMessage) | Search Teams messages |

All tools use raw `fetch` (no Microsoft Graph SDK) for Cloudflare Workers compatibility.

### Scopes

`openid offline_access User.Read Files.Read.All Sites.Read.All ChannelMessage.Read.All Team.ReadBasic.All Chat.Read`

## Setup

### Azure AD App Registration

1. Register an app in Azure Portal > Azure Active Directory > App registrations
2. Set redirect URI: `https://chien.resynapse.dev/api/microsoft/callback`
3. Add API permissions (Delegated): all scopes listed above
4. Create a client secret
5. Set environment variables:
   - `MICROSOFT_CLIENT_ID` — in `wrangler.jsonc` vars
   - `MICROSOFT_CLIENT_SECRET` — via `wrangler secret put`

### Database

Run the migration to create the `microsoft_connection` table:

```sh
cd web
pnpm db:migrate:local   # local
pnpm db:migrate:remote  # production
```

## Key Files

| File | Purpose |
|------|---------|
| `web/server/lib/microsoft.ts` | OAuth flow, token management, Graph API helpers |
| `web/server/lib/microsoft-tools.ts` | AI SDK tool definitions for Graph API |
| `web/server/routes/microsoft.ts` | API routes (connect, callback, status, disconnect) |
| `web/server/db/schema.ts` | `microsoftConnection` table definition |
| `web/src/pages/Integrations/index.tsx` | Integrations settings page |
| `web/src/models/integrations.ts` | Frontend state model |

## Error Handling

- **401 (token expired)**: Tools return a message asking the user to reconnect
- **403 (scope not granted)**: Tools explain the org hasn't approved the app
- **Token refresh failure**: Connection is automatically deleted, user must reconnect
- **OAuth errors**: Redirected back to integrations page with error message in query params
