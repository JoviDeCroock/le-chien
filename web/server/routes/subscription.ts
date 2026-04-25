import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { getSubscriptionSnapshot } from "../lib/plans";
import { Bindings, Variables } from "../types";

export const subscription = new Hono<{ Bindings: Bindings; Variables: Variables }>();

subscription.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.get("user")?.id;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return c.json(await getSubscriptionSnapshot(c.env, db, userId));
});
