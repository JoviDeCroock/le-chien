import { Hono } from "hono";
import { z } from "zod";
import type { Bindings, Variables } from "../types";
import { isProduction } from "../utils/isProduction";

const artifactEventSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.enum(["click", "input", "change", "submit"]),
  value: z.string().max(2_000).optional(),
  checked: z.boolean().optional(),
});

const artifactRenderSchema = z.object({
  artifactId: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[A-Za-z0-9:_.-]+$/),
  code: z.string().min(1).max(24_000),
  event: artifactEventSchema.optional(),
});

export const artifactRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

artifactRoutes.post("/render", async (c) => {
  const parsed = artifactRenderSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid artifact render request" }, 400);
  }

  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const namespace = isProduction(c.env)
    ? c.env.ARTIFACT_SESSION.jurisdiction("eu")
    : c.env.ARTIFACT_SESSION;
  const sessionId = namespace.idFromName(`${user.id}:${parsed.data.artifactId}`);
  const session = namespace.get(sessionId);
  const response = await session.fetch("https://artifact-session.local/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...parsed.data,
      userId: user.id,
    }),
  });
  const result = await response.json();
  return c.json(result, response.status as 200 | 400 | 403 | 405);
});
