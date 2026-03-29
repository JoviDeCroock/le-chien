import { Hono } from "hono";
import { listModels, DEFAULT_MODEL } from "../lib/models";
import { listIndexedConversations } from "../lib/conversation-index";
import type { Bindings, Variables } from "../types";

export const chatRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

chatRoutes.get("/conversations", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const conversations = await listIndexedConversations(c.env, user.id);
  return c.json({ conversations });
});

chatRoutes.get("/models", (c) => {
  return c.json({ models: listModels(), default: DEFAULT_MODEL });
});
