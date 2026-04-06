import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import * as schema from "../db/schema";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export function getGoogleAuthUrl(env: Cloudflare.Env, appOrigin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${appOrigin}/api/v1/integrations/google/callback`,
    response_type: "code",
    scope: GOOGLE_DRIVE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

export async function exchangeCodeForTokens(
  env: Cloudflare.Env,
  appOrigin: string,
  code: string,
): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${appOrigin}/api/v1/integrations/google/callback`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<TokenResponse>;
}

export async function refreshAccessToken(
  env: Cloudflare.Env,
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export async function getGoogleUserInfo(
  accessToken: string,
): Promise<{ email: string; name: string }> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Google user info");
  return res.json() as Promise<{ email: string; name: string }>;
}

/**
 * Get a valid access token for a user's Google integration, refreshing if needed.
 * Returns null if no integration exists.
 */
export async function getValidGoogleToken(
  env: Cloudflare.Env,
  db: ReturnType<typeof drizzle>,
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select()
    .from(schema.integration)
    .where(and(eq(schema.integration.userId, userId), eq(schema.integration.provider, "google")))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  const now = new Date();

  // Refresh if token expires within 5 minutes
  if (row.accessTokenExpiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(env, row.refreshToken);
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);

    await db
      .update(schema.integration)
      .set({
        accessToken: refreshed.access_token,
        accessTokenExpiresAt: newExpiry,
        updatedAt: now,
      })
      .where(eq(schema.integration.id, row.id));

    return refreshed.access_token;
  }

  return row.accessToken;
}
