import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import * as schema from "../db/schema";
import { Bindings, Variables } from "../types";
import { getAppOrigin } from "../utils/urls";
import { getGoogleAuthUrl, exchangeCodeForTokens, getGoogleUserInfo } from "../lib/google";

export const integrations = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /google/status — check if the user has a Google integration
integrations.get("/google/status", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("user")!.id;

  const rows = await db
    .select({
      provider: schema.integration.provider,
      providerAccountId: schema.integration.providerAccountId,
      providerAccountName: schema.integration.providerAccountName,
      scope: schema.integration.scope,
      createdAt: schema.integration.createdAt,
    })
    .from(schema.integration)
    .where(and(eq(schema.integration.userId, userId), eq(schema.integration.provider, "google")))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ connected: false });
  }

  return c.json({
    connected: true,
    account: rows[0].providerAccountId,
    name: rows[0].providerAccountName,
    scope: rows[0].scope,
    connectedAt: rows[0].createdAt,
  });
});

// GET /google/connect — redirect to Google OAuth consent screen
integrations.get("/google/connect", async (c) => {
  const userId = c.get("user")!.id;
  const appOrigin = getAppOrigin(c.env);

  // Encode user ID in state to verify on callback
  const state = btoa(JSON.stringify({ userId }));
  const url = getGoogleAuthUrl(c.env, appOrigin, state);

  return c.redirect(url);
});

// GET /google/callback — handle OAuth callback, store tokens
integrations.get("/google/callback", async (c) => {
  const appOrigin = getAppOrigin(c.env);
  const code = c.req.query("code");
  const stateParam = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.redirect(`${appOrigin}/integrations?error=${encodeURIComponent(error)}`);
  }

  if (!code || !stateParam) {
    return c.redirect(`${appOrigin}/integrations?error=missing_params`);
  }

  let stateUserId: string;
  try {
    const state = JSON.parse(atob(stateParam));
    stateUserId = state.userId;
  } catch {
    return c.redirect(`${appOrigin}/integrations?error=invalid_state`);
  }

  // Verify the state matches the logged-in user
  const sessionUser = c.get("user");
  if (!sessionUser || sessionUser.id !== stateUserId) {
    return c.redirect(`${appOrigin}/integrations?error=state_mismatch`);
  }

  try {
    const tokens = await exchangeCodeForTokens(c.env, appOrigin, code);

    if (!tokens.refresh_token) {
      return c.redirect(`${appOrigin}/integrations?error=no_refresh_token`);
    }

    // Get user info from Google
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    const db = drizzle(c.env.DB, { schema });
    const now = new Date();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db
      .insert(schema.integration)
      .values({
        id: crypto.randomUUID(),
        userId: sessionUser.id,
        provider: "google",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        scope: tokens.scope,
        accessTokenExpiresAt: expiresAt,
        providerAccountId: userInfo.email,
        providerAccountName: userInfo.name,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.integration.userId, schema.integration.provider],
        set: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          scope: tokens.scope,
          accessTokenExpiresAt: expiresAt,
          providerAccountId: userInfo.email,
          providerAccountName: userInfo.name,
          updatedAt: now,
        },
      });

    return c.redirect(`${appOrigin}/integrations?google=connected`);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return c.redirect(`${appOrigin}/integrations?error=token_exchange_failed`);
  }
});

// POST /google/disconnect — remove the Google integration
integrations.post("/google/disconnect", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("user")!.id;

  await db
    .delete(schema.integration)
    .where(and(eq(schema.integration.userId, userId), eq(schema.integration.provider, "google")));

  return c.json({ disconnected: true });
});
