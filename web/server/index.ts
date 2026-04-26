import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { Polar } from "@polar-sh/sdk";
import { getAgentByName } from "agents";
import { createAuth } from "./lib/auth";
import { subscription } from "./routes/subscription";
import { chatRoutes } from "./routes/chat";
import { ttsRoutes } from "./routes/tts";
import { artifactRoutes } from "./routes/artifacts";
import { Bindings, Variables } from "./types";
import { isProduction } from "./utils/isProduction";
import { isBillingEnabled } from "./utils/billingEnabled";
import { getAppOrigin } from "./utils/urls";
import { trackServerEvent } from "./lib/posthog";
import * as schema from "./db/schema";

export { ChatAgent } from "./agents/chat-agent";
export { ArtifactSession } from "./agents/artifact-session";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function getOptionalOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(env: Bindings) {
  const origins = new Set<string>();
  origins.add(getAppOrigin(env));

  if (!isProduction(env)) {
    origins.add("http://localhost:5173");
    origins.add("http://127.0.0.1:5173");
  }

  return origins;
}

function isAllowedOrigin(env: Bindings, origin: string | undefined) {
  if (!origin) return !isProduction(env);
  return getAllowedOrigins(env).has(origin);
}

function getAppCsp(env: Bindings) {
  const posthogOrigin = getOptionalOrigin(env.POSTHOG_HOST) ?? "https://eu.i.posthog.com";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' wss: ${posthogOrigin} https://eu.i.posthog.com https://*.posthog.com`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "manifest-src 'self'",
  ].join("; ");
}

function applySecurityHeaders(c: { env: Bindings; res: Response; req: { path: string } }) {
  const headers = new Headers(c.res.headers);
  const apiResponse = c.req.path.startsWith("/api/");

  if (isProduction(c.env)) {
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set(
    "Content-Security-Policy",
    apiResponse ? "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" : getAppCsp(c.env),
  );

  c.res = new Response(c.res.body, {
    status: c.res.status,
    statusText: c.res.statusText,
    headers,
  });
}

// Create auth instance once per request and store in context
app.use("/api/*", async (c, next) => {
  c.set("auth", createAuth(c.env));
  await next();
});

// Security response headers (skip WebSocket upgrades — status 101 can't be re-wrapped).
app.use("*", async (c, next) => {
  await next();
  if (c.res.status < 200 || c.res.status > 599) return;
  applySecurityHeaders(c);
});

app.get("/api/billing-success", async (c) => {
  if (!isBillingEnabled(c.env) || !c.env.POLAR_ACCESS_TOKEN) {
    return c.json({ error: "Billing is disabled" }, 404);
  }

  // Upgrade customer
  const db = drizzle(c.env.DB, { schema });

  const checkoutId = c.req.query("checkout_id");
  if (!checkoutId) {
    return c.json({ error: "Missing checkout_id parameter" }, 400);
  }

  // Initialize Polar client
  const polarClient = new Polar({
    accessToken: c.env.POLAR_ACCESS_TOKEN,
    server: isProduction(c.env) ? "production" : "sandbox",
  });

  // Get checkout session to retrieve customer_id
  const checkout = await polarClient.checkouts.get({ id: checkoutId });

  if (!checkout || !checkout.customerId) {
    return c.json({ error: "Invalid checkout session" }, 400);
  }

  if (typeof checkout.externalCustomerId !== "string" || checkout.externalCustomerId.length === 0) {
    return c.json({ error: "Checkout is missing a user reference" }, 400);
  }

  // List subscriptions for this customer
  const subscriptions = await polarClient.subscriptions.list({
    customerId: checkout.customerId,
    active: true,
  });

  // Find the active subscription (should be the most recent one)
  let activeSubscription = null;
  for await (const sub of subscriptions) {
    const page = sub.result;
    if (page.items && page.items.length > 0) {
      // Get the first active subscription
      activeSubscription = page.items[0];
      break;
    }
  }

  if (!activeSubscription) {
    return c.json({ error: "No active subscription found" }, 404);
  }

  // Upsert the subscription row to keep checkout success idempotent.
  const now = new Date();
  await db
    .insert(schema.subscription)
    .values({
      id: crypto.randomUUID(),
      plan: "pro",
      status: "active",
      createdAt: now,
      polarCustomerId: checkout.customerId,
      userId: checkout.externalCustomerId,
      polarSubscriptionId: activeSubscription.id,
      currentPeriodEnd: activeSubscription.currentPeriodEnd
        ? new Date(activeSubscription.currentPeriodEnd)
        : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.subscription.userId,
      set: {
        plan: "pro",
        status: "active",
        polarCustomerId: checkout.customerId,
        polarSubscriptionId: activeSubscription.id,
        currentPeriodEnd: activeSubscription.currentPeriodEnd
          ? new Date(activeSubscription.currentPeriodEnd)
          : null,
        updatedAt: now,
      },
    });

  trackServerEvent(c.env, checkout.externalCustomerId, "subscription_activated", {
    plan: "pro",
    polar_subscription_id: activeSubscription.id,
  });

  return c.redirect(`${getAppOrigin(c.env)}/?billing=success`);
});

// Mount BetterAuth handler
app.on(["GET", "POST"], "/api/auth/*", (c) => {
  try {
    return c.get("auth").handler(c.req.raw);
  } catch (error) {
    console.error("Error in auth handler:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// Session middleware for protected routes
app.use("/api/v1/*", async (c, next) => {
  const session = await c.get("auth").api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

// Example protected route
app.get("/api/v1/me", (c) => {
  return c.json({ user: c.get("user") });
});

// Subscription
app.route("/api/v1/subscription", subscription);

// Chat
app.route("/api/v1/chat", chatRoutes);

// Text-to-speech (read-aloud)
app.route("/api/v1/tts", ttsRoutes);

// Dynamic Worker-backed artifacts
app.route("/api/v1/artifacts", artifactRoutes);

// Agent WebSocket — forwards to per-user Durable Object
app.all("/api/v1/agent", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (!isAllowedOrigin(c.env, c.req.header("Origin"))) {
    return c.json({ error: "Forbidden origin" }, 403);
  }
  const agent = await getAgentByName(c.env.CHAT_AGENT as any, user.id, {
    jurisdiction: c.env.LOCAL ? undefined : "eu",
  });
  return agent.fetch(c.req.raw);
});

export default app;
