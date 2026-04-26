import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { Polar } from "@polar-sh/sdk";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import * as schema from "../db/schema";
import { isProduction } from "../utils/isProduction";
import { isBillingEnabled } from "../utils/billingEnabled";
import { getAppOrigin } from "../utils/urls";

type Env = Cloudflare.Env;
type Auth = ReturnType<typeof buildAuth>;

const authCache = new WeakMap<object, Auth>();

function buildPolarPlugin(env: Env, db: ReturnType<typeof drizzle<typeof schema>>) {
  if (!isBillingEnabled(env)) return null;
  if (!env.POLAR_ACCESS_TOKEN || !env.POLAR_WEBHOOK_SECRET || !env.POLAR_PRO_PRODUCT_ID) {
    throw new Error(
      "BILLING_ENABLED=true requires POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, and POLAR_PRO_PRODUCT_ID.",
    );
  }

  const appOrigin = getAppOrigin(env);
  const polarClient = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: isProduction(env) ? "production" : "sandbox",
  });
  const polarProductId = env.POLAR_PRO_PRODUCT_ID;
  const polarWebhookSecret = env.POLAR_WEBHOOK_SECRET;

  return polar({
    client: polarClient,
    createCustomerOnSignUp: isProduction(env),
    use: [
      checkout({
        authenticatedUsersOnly: true,
        products: [
          {
            productId: polarProductId,
            slug: "pro",
          },
        ],
        // This success URL is more to support local-dev so we don't have to only use
        // webhooks. All though local webhooks are now possible with https://polar.sh/docs/integrate/webhooks/locally
        successUrl: `${appOrigin}/api/billing-success?checkout_id={CHECKOUT_ID}`,
        returnUrl: `${appOrigin}/`,
      }),
      portal(),
      webhooks({
        secret: polarWebhookSecret,
        onSubscriptionUpdated: async (payload) => {
          const customerId = payload.data.customerId;
          const currentPeriodEnd = payload.data.currentPeriodEnd
            ? new Date(payload.data.currentPeriodEnd)
            : null;

          await db
            .update(schema.subscription)
            .set({
              plan: payload.data.productId === polarProductId ? "pro" : "free",
              status: payload.data.status,
              currentPeriodEnd,
              updatedAt: new Date(),
            })
            .where(eq(schema.subscription.polarCustomerId, customerId));
        },
        onSubscriptionActive: async (payload) => {
          const customerId = payload.data.customerId;
          const subscriptionId = payload.data.id;
          const externalUserId = payload.data.customer.externalId;
          const currentPeriodEnd = payload.data.currentPeriodEnd
            ? new Date(payload.data.currentPeriodEnd)
            : null;
          const now = new Date();

          if (typeof externalUserId === "string" && externalUserId.length > 0) {
            await db
              .insert(schema.subscription)
              .values({
                id: crypto.randomUUID(),
                userId: externalUserId,
                polarCustomerId: customerId,
                polarSubscriptionId: subscriptionId,
                plan: "pro",
                status: "active",
                currentPeriodEnd,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: schema.subscription.userId,
                set: {
                  polarCustomerId: customerId,
                  polarSubscriptionId: subscriptionId,
                  plan: "pro",
                  status: "active",
                  currentPeriodEnd,
                  updatedAt: now,
                },
              });

            return;
          }

          await db
            .update(schema.subscription)
            .set({
              plan: "pro",
              status: "active",
              polarSubscriptionId: subscriptionId,
              currentPeriodEnd,
              updatedAt: now,
            })
            .where(eq(schema.subscription.polarCustomerId, customerId));
        },
        onSubscriptionCanceled: async (payload) => {
          const customerId = payload.data.customerId;

          await db
            .update(schema.subscription)
            .set({
              plan: "free",
              status: "canceled",
              updatedAt: new Date(),
            })
            .where(eq(schema.subscription.polarCustomerId, customerId));
        },
        onSubscriptionRevoked: async (payload) => {
          const customerId = payload.data.customerId;

          await db
            .update(schema.subscription)
            .set({
              plan: "free",
              status: "expired",
              updatedAt: new Date(),
            })
            .where(eq(schema.subscription.polarCustomerId, customerId));
        },
        onCustomerCreated: async (payload) => {
          const customerId = payload.data.id;
          const email = payload.data.email;

          // Find user by email and create subscription row
          const user = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.email, email))
            .get();

          if (user) {
            const now = new Date();

            await db
              .insert(schema.subscription)
              .values({
                id: crypto.randomUUID(),
                userId: user.id,
                polarCustomerId: customerId,
                plan: "free",
                status: "active",
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: schema.subscription.userId,
                set: {
                  polarCustomerId: customerId,
                  updatedAt: now,
                },
              });
          }
        },
      }),
    ],
  });
}

function buildAuth(env: Env) {
  const db = drizzle(env.DB, { schema });
  const appOrigin = getAppOrigin(env);
  const polarPlugin = buildPolarPlugin(env, db);

  return betterAuth({
    // We can improve this with CloudFlare KV based rate limits in the future if needed
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: appOrigin,
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins: [appOrigin],
    plugins: polarPlugin ? [polarPlugin] : [],
  });
}

export function createAuth(env: Env) {
  const cacheKey = env as object;
  const cachedAuth = authCache.get(cacheKey);
  if (cachedAuth) {
    return cachedAuth;
  }

  const auth = buildAuth(env);
  authCache.set(cacheKey, auth);
  return auth;
}
