import { Hono } from "hono";
import { z } from "zod";
import { renderDynamicArtifact } from "../lib/dynamic-workers";
import type { Bindings, Variables } from "../types";

const artifactEventSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.enum(["click", "input", "change", "submit"]),
  value: z.string().max(2_000).optional(),
  checked: z.boolean().optional(),
});

const artifactRenderSchema = z.object({
  code: z.string().min(1).max(24_000),
  state: z.array(z.unknown()).max(50).optional(),
  event: artifactEventSchema.optional(),
});

export const artifactRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

artifactRoutes.post("/render", async (c) => {
  const parsed = artifactRenderSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid artifact render request" }, 400);
  }

  const result = await renderDynamicArtifact(c.env, parsed.data);
  if (result.error) {
    return c.json(result, 400);
  }
  return c.json(result);
});
