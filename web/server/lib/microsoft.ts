import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { getAppOrigin } from "../utils/urls";

type Env = Cloudflare.Env;

const MICROSOFT_SCOPES =
  "openid offline_access User.Read Files.Read.All Sites.Read.All ChannelMessage.Read.All Team.ReadBasic.All Chat.Read";

const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

// ── State signing (HMAC-SHA256) ─────────────────────────────

async function getSigningKey(env: Env): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(env.BETTER_AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function buildAuthorizationUrl(env: Env, userId: string): Promise<string> {
  const callbackUrl = `${getAppOrigin(env)}/api/microsoft/callback`;

  const payload = JSON.stringify({ userId, exp: Date.now() + 5 * 60 * 1000 });
  const enc = new TextEncoder();
  const key = await getSigningKey(env);
  const payloadBytes = enc.encode(payload);
  const sig = await crypto.subtle.sign("HMAC", key, payloadBytes.buffer as ArrayBuffer);
  const state = `${toBase64Url(payloadBytes.buffer as ArrayBuffer)}.${toBase64Url(sig)}`;

  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: callbackUrl,
    scope: MICROSOFT_SCOPES,
    state,
    response_mode: "query",
    prompt: "consent",
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function verifyState(env: Env, state: string): Promise<{ userId: string } | null> {
  const parts = state.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  const key = await getSigningKey(env);

  const payloadBytes = fromBase64Url(payloadB64);
  const sigBytes = fromBase64Url(sigB64);

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes.buffer as ArrayBuffer,
    payloadBytes.buffer as ArrayBuffer,
  );
  if (!valid) return null;

  const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  if (payload.exp < Date.now()) return null;

  return { userId: payload.userId };
}

// ── Token exchange ──────────────────────────────────────────

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

export async function exchangeCodeForTokens(env: Env, code: string): Promise<TokenResponse> {
  const callbackUrl = `${getAppOrigin(env)}/api/microsoft/callback`;

  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID!,
    client_secret: env.MICROSOFT_CLIENT_SECRET!,
    code,
    redirect_uri: callbackUrl,
    grant_type: "authorization_code",
    scope: MICROSOFT_SCOPES,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function refreshAccessToken(env: Env, refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID!,
    client_secret: env.MICROSOFT_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: MICROSOFT_SCOPES,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ── High-level helpers ──────────────────────────────────────

export async function getValidAccessToken(
  db: D1Database,
  env: Env,
  userId: string,
): Promise<string | null> {
  const drizzleDb = drizzle(db, { schema });
  const connection = await drizzleDb
    .select()
    .from(schema.microsoftConnection)
    .where(eq(schema.microsoftConnection.userId, userId))
    .get();

  if (!connection) return null;

  // If token is still valid (with 5-minute buffer), return it
  const bufferMs = 5 * 60 * 1000;
  if (connection.accessTokenExpiresAt.getTime() > Date.now() + bufferMs) {
    return connection.accessToken;
  }

  // Token expired or expiring soon — refresh
  try {
    const tokens = await refreshAccessToken(env, connection.refreshToken);
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await drizzleDb
      .update(schema.microsoftConnection)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt: newExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.microsoftConnection.userId, userId));

    return tokens.access_token;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // If the refresh token is revoked, delete the connection
    if (message.includes("invalid_grant") || message.includes("AADSTS")) {
      await drizzleDb
        .delete(schema.microsoftConnection)
        .where(eq(schema.microsoftConnection.userId, userId));
    }
    return null;
  }
}

export async function graphFetch(
  url: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

export async function getMicrosoftProfile(
  accessToken: string,
): Promise<{ id: string; displayName: string; mail: string | null }> {
  const res = await graphFetch("https://graph.microsoft.com/v1.0/me", accessToken);
  if (!res.ok) throw new Error(`Failed to fetch Microsoft profile: ${res.status}`);
  return res.json();
}
