import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Bindings, Variables } from "../types";
import * as schema from "../db/schema";
import {
  buildAuthorizationUrl,
  verifyState,
  exchangeCodeForTokens,
  getMicrosoftProfile,
} from "../lib/microsoft";
import { getAppOrigin } from "../utils/urls";

// Protected routes — mounted under /api/v1/microsoft
export const microsoftRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

microsoftRoutes.get("/connect", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  if (!c.env.MICROSOFT_CLIENT_ID || !c.env.MICROSOFT_CLIENT_SECRET) {
    return c.json({ error: "Microsoft integration is not configured" }, 503);
  }

  const url = await buildAuthorizationUrl(c.env, user.id);
  return c.json({ url });
});

microsoftRoutes.get("/status", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const db = drizzle(c.env.DB, { schema });
  const connection = await db
    .select({
      displayName: schema.microsoftConnection.displayName,
      email: schema.microsoftConnection.email,
    })
    .from(schema.microsoftConnection)
    .where(eq(schema.microsoftConnection.userId, user.id))
    .get();

  if (!connection) {
    return c.json({ connected: false });
  }

  return c.json({
    connected: true,
    displayName: connection.displayName,
    email: connection.email,
  });
});

microsoftRoutes.post("/disconnect", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const db = drizzle(c.env.DB, { schema });
  await db.delete(schema.microsoftConnection).where(eq(schema.microsoftConnection.userId, user.id));

  return c.json({ ok: true });
});

// Public callback handler — mounted at /api/microsoft/callback (outside session middleware)
export async function microsoftCallbackHandler(c: {
  req: { query: (key: string) => string | undefined };
  json: (data: unknown, status?: number) => Response;
  redirect: (url: string) => Response;
  env: Cloudflare.Env;
}): Promise<Response> {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  const appOrigin = getAppOrigin(c.env);

  if (error) {
    const description = c.req.query("error_description") ?? "Unknown error";
    return c.redirect(
      `${appOrigin}/integrations?microsoft=error&message=${encodeURIComponent(description)}`,
    );
  }

  if (!code || !state) {
    return c.redirect(
      `${appOrigin}/integrations?microsoft=error&message=${encodeURIComponent("Missing authorization code")}`,
    );
  }

  // Verify the HMAC-signed state
  const stateData = await verifyState(c.env, state);
  if (!stateData) {
    return c.redirect(
      `${appOrigin}/integrations?microsoft=error&message=${encodeURIComponent("Invalid or expired state")}`,
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(c.env, code);

    // Fetch Microsoft profile
    const profile = await getMicrosoftProfile(tokens.access_token);

    // Upsert into database
    const db = drizzle(c.env.DB, { schema });
    const now = new Date();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db
      .insert(schema.microsoftConnection)
      .values({
        id: crypto.randomUUID(),
        userId: stateData.userId,
        microsoftUserId: profile.id,
        displayName: profile.displayName,
        email: profile.mail,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt: expiresAt,
        scopes:
          "openid offline_access User.Read Files.Read.All Sites.Read.All ChannelMessage.Read.All Team.ReadBasic.All Chat.Read",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.microsoftConnection.userId,
        set: {
          microsoftUserId: profile.id,
          displayName: profile.displayName,
          email: profile.mail,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          accessTokenExpiresAt: expiresAt,
          updatedAt: now,
        },
      });

    return c.redirect(`${appOrigin}/integrations?microsoft=connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    console.error("Microsoft OAuth callback error:", err);
    return c.redirect(
      `${appOrigin}/integrations?microsoft=error&message=${encodeURIComponent(message)}`,
    );
  }
}
