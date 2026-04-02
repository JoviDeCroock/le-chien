import { Hono } from "hono";
import type { Bindings, Variables } from "../types";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const uploadRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

uploadRoutes.post("/", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return c.json({ error: "Expected multipart/form-data" }, 400);
  }

  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "Missing file field" }, 400);
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return c.json(
      { error: `Unsupported file type: ${file.type}. Allowed: ${[...ALLOWED_TYPES].join(", ")}` },
      400,
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      400,
    );
  }

  const key = `${user.id}/${crypto.randomUUID()}-${file.name}`;
  await c.env.UPLOADS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name, userId: user.id },
  });

  return c.json({
    key,
    name: file.name,
    type: file.type,
    size: file.size,
  });
});
