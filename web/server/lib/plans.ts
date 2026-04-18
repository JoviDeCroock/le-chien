import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

export type Plan = "free" | "pro";

type PlanLimits = {
  dailyMessages: number | null;
  dailyPremiumMessages: number | null;
  dailyImageGenerations: number | null;
  dailyWebSearches: number | null;
};

export type SubscriptionSnapshot = {
  plan: Plan;
  limits: PlanLimits;
  usage: {
    dailyMessagesUsed: number;
    dailyMessagesRemaining: number | null;
    limitReached: boolean;
    dailyPremiumMessagesUsed: number;
    dailyPremiumMessagesRemaining: number | null;
    premiumLimitReached: boolean;
    dailyImageGenerationsUsed: number;
    dailyImageGenerationsRemaining: number | null;
    imageGenerationLimitReached: boolean;
    dailyWebSearchesUsed: number;
    dailyWebSearchesRemaining: number | null;
    webSearchLimitReached: boolean;
    usageDate: string;
    resetsAt: string;
  };
};

export const PLAN_LIMITS = {
  free: {
    dailyMessages: 20,
    dailyPremiumMessages: 5,
    dailyImageGenerations: 5,
    dailyWebSearches: 3,
  },
  pro: {
    dailyMessages: null,
    dailyPremiumMessages: null,
    dailyImageGenerations: null,
    dailyWebSearches: 50,
  },
} as const;

export function getUsageDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function getUsageResetAt(date = new Date()) {
  const resetAt = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1),
  );
  return resetAt.toISOString();
}

export function buildSubscriptionSnapshot(
  plan: Plan,
  dailyMessagesUsed: number,
  date = new Date(),
  dailyPremiumMessagesUsed = 0,
  dailyImageGenerationsUsed = 0,
  dailyWebSearchesUsed = 0,
): SubscriptionSnapshot {
  const limits = PLAN_LIMITS[plan];
  const dailyMessagesRemaining =
    limits.dailyMessages === null ? null : Math.max(limits.dailyMessages - dailyMessagesUsed, 0);
  const dailyPremiumMessagesRemaining =
    limits.dailyPremiumMessages === null
      ? null
      : Math.max(limits.dailyPremiumMessages - dailyPremiumMessagesUsed, 0);
  const dailyImageGenerationsRemaining =
    limits.dailyImageGenerations === null
      ? null
      : Math.max(limits.dailyImageGenerations - dailyImageGenerationsUsed, 0);
  const dailyWebSearchesRemaining =
    limits.dailyWebSearches === null
      ? null
      : Math.max(limits.dailyWebSearches - dailyWebSearchesUsed, 0);

  return {
    plan,
    limits,
    usage: {
      dailyMessagesUsed,
      dailyMessagesRemaining,
      limitReached: limits.dailyMessages !== null && dailyMessagesUsed >= limits.dailyMessages,
      dailyPremiumMessagesUsed,
      dailyPremiumMessagesRemaining,
      premiumLimitReached:
        limits.dailyPremiumMessages !== null &&
        dailyPremiumMessagesUsed >= limits.dailyPremiumMessages,
      dailyImageGenerationsUsed,
      dailyImageGenerationsRemaining,
      imageGenerationLimitReached:
        limits.dailyImageGenerations !== null &&
        dailyImageGenerationsUsed >= limits.dailyImageGenerations,
      dailyWebSearchesUsed,
      dailyWebSearchesRemaining,
      webSearchLimitReached:
        limits.dailyWebSearches !== null && dailyWebSearchesUsed >= limits.dailyWebSearches,
      usageDate: getUsageDate(date),
      resetsAt: getUsageResetAt(date),
    },
  };
}

export async function getUserPlan(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
): Promise<Plan> {
  const row = await db
    .select({ plan: schema.subscription.plan })
    .from(schema.subscription)
    .where(eq(schema.subscription.userId, userId))
    .get();

  if (!row || row.plan !== "pro") return "free";
  return "pro";
}

export async function getDailyMessageUsage(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  usageDate = getUsageDate(),
) {
  const row = await db
    .select({ messageCount: schema.dailyMessageUsage.messageCount })
    .from(schema.dailyMessageUsage)
    .where(
      and(
        eq(schema.dailyMessageUsage.userId, userId),
        eq(schema.dailyMessageUsage.usageDate, usageDate),
      ),
    )
    .get();

  return row?.messageCount ?? 0;
}

export async function getDailyPremiumMessageUsage(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  usageDate = getUsageDate(),
) {
  const row = await db
    .select({ messageCount: schema.dailyPremiumMessageUsage.messageCount })
    .from(schema.dailyPremiumMessageUsage)
    .where(
      and(
        eq(schema.dailyPremiumMessageUsage.userId, userId),
        eq(schema.dailyPremiumMessageUsage.usageDate, usageDate),
      ),
    )
    .get();

  return row?.messageCount ?? 0;
}

export async function getDailyImageGenerationUsage(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  usageDate = getUsageDate(),
) {
  const row = await db
    .select({ messageCount: schema.dailyImageGenerationUsage.messageCount })
    .from(schema.dailyImageGenerationUsage)
    .where(
      and(
        eq(schema.dailyImageGenerationUsage.userId, userId),
        eq(schema.dailyImageGenerationUsage.usageDate, usageDate),
      ),
    )
    .get();

  return row?.messageCount ?? 0;
}

export async function getDailyWebSearchUsage(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  usageDate = getUsageDate(),
) {
  const row = await db
    .select({ messageCount: schema.dailyWebSearchUsage.messageCount })
    .from(schema.dailyWebSearchUsage)
    .where(
      and(
        eq(schema.dailyWebSearchUsage.userId, userId),
        eq(schema.dailyWebSearchUsage.usageDate, usageDate),
      ),
    )
    .get();

  return row?.messageCount ?? 0;
}

export async function getSubscriptionSnapshot(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
  date = new Date(),
): Promise<SubscriptionSnapshot> {
  const plan = await getUserPlan(db, userId);
  const usageDate = getUsageDate(date);
  const dailyMessagesUsed = plan === "free" ? await getDailyMessageUsage(db, userId, usageDate) : 0;
  const dailyPremiumMessagesUsed =
    plan === "free" ? await getDailyPremiumMessageUsage(db, userId, usageDate) : 0;
  const dailyImageGenerationsUsed =
    plan === "free" ? await getDailyImageGenerationUsage(db, userId, usageDate) : 0;
  const dailyWebSearchesUsed = await getDailyWebSearchUsage(db, userId, usageDate);

  return buildSubscriptionSnapshot(
    plan,
    dailyMessagesUsed,
    date,
    dailyPremiumMessagesUsed,
    dailyImageGenerationsUsed,
    dailyWebSearchesUsed,
  );
}

export async function tryIncrementDailyMessageUsage(
  db: D1Database,
  userId: string,
  usageDate: string,
) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      `
        INSERT INTO daily_message_usage (id, user_id, usage_date, message_count, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(user_id, usage_date) DO UPDATE SET
          message_count = message_count + 1,
          updated_at = excluded.updated_at
        WHERE message_count < ?
        RETURNING message_count
      `,
    )
    .bind(crypto.randomUUID(), userId, usageDate, now, now, PLAN_LIMITS.free.dailyMessages)
    .first<{ message_count: number }>();

  return row?.message_count ?? null;
}

export async function decrementDailyMessageUsage(
  db: D1Database,
  userId: string,
  usageDate: string,
) {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
        UPDATE daily_message_usage
        SET message_count = MAX(message_count - 1, 0), updated_at = ?
        WHERE user_id = ? AND usage_date = ?
      `,
    )
    .bind(now, userId, usageDate)
    .run();
}

export async function tryIncrementDailyPremiumMessageUsage(
  db: D1Database,
  userId: string,
  usageDate: string,
) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      `
        INSERT INTO daily_premium_message_usage (id, user_id, usage_date, message_count, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(user_id, usage_date) DO UPDATE SET
          message_count = message_count + 1,
          updated_at = excluded.updated_at
        WHERE message_count < ?
        RETURNING message_count
      `,
    )
    .bind(crypto.randomUUID(), userId, usageDate, now, now, PLAN_LIMITS.free.dailyPremiumMessages)
    .first<{ message_count: number }>();

  return row?.message_count ?? null;
}

export async function decrementDailyPremiumMessageUsage(
  db: D1Database,
  userId: string,
  usageDate: string,
) {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `
        UPDATE daily_premium_message_usage
        SET message_count = MAX(message_count - 1, 0), updated_at = ?
        WHERE user_id = ? AND usage_date = ?
      `,
    )
    .bind(now, userId, usageDate)
    .run();
}

export async function tryIncrementDailyImageGenerationUsage(
  db: D1Database,
  userId: string,
  usageDate: string,
) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      `
        INSERT INTO daily_image_generation_usage (id, user_id, usage_date, message_count, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(user_id, usage_date) DO UPDATE SET
          message_count = message_count + 1,
          updated_at = excluded.updated_at
        WHERE message_count < ?
        RETURNING message_count
      `,
    )
    .bind(crypto.randomUUID(), userId, usageDate, now, now, PLAN_LIMITS.free.dailyImageGenerations)
    .first<{ message_count: number }>();

  return row?.message_count ?? null;
}

export async function tryIncrementDailyWebSearchUsage(
  db: D1Database,
  userId: string,
  usageDate: string,
  plan: Plan,
) {
  const limit = PLAN_LIMITS[plan].dailyWebSearches;
  if (limit === null) return 1; // unlimited
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      `
        INSERT INTO daily_web_search_usage (id, user_id, usage_date, message_count, created_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(user_id, usage_date) DO UPDATE SET
          message_count = message_count + 1,
          updated_at = excluded.updated_at
        WHERE message_count < ?
        RETURNING message_count
      `,
    )
    .bind(crypto.randomUUID(), userId, usageDate, now, now, limit)
    .first<{ message_count: number }>();

  return row?.message_count ?? null;
}
