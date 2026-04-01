import { Hono } from "hono";
import { listModels, DEFAULT_MODEL } from "../lib/models";
import type { Bindings, Variables } from "../types";

export const chatRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

chatRoutes.get("/models", (c) => {
  return c.json({ models: listModels(), default: DEFAULT_MODEL });
});
