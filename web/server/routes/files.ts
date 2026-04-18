import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, sql } from "drizzle-orm";
import * as schema from "../db/schema";
import { getUserPlan, PLAN_LIMITS } from "../lib/plans";
import { deleteFromTenant, ensureTenant, uploadToTenant } from "../lib/ai-search";
import { isAllowedMimeType, normalizeMimeType } from "../lib/files";
import type { Bindings, Variables } from "../types";

export const filesRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type FileRow = {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  status: string;
  created_at: number;
};

function serializeFile(row: typeof schema.file.$inferSelect): FileRow {
  return {
    id: row.id,
    filename: row.filename,
    size: row.size,
    mime_type: row.mimeType,
    status: row.status,
    created_at: Math.floor(row.createdAt.getTime() / 1000),
  };
}

filesRoutes.get("/", async (c) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const db = drizzle(c.env.DB, { schema });
  const rows = await db
    .select()
    .from(schema.file)
    .where(eq(schema.file.userId, userId))
    .orderBy(desc(schema.file.createdAt))
    .all();

  const plan = await getUserPlan(db, userId);
  return c.json({
    files: rows.map(serializeFile),
    limits: {
      maxFiles: PLAN_LIMITS[plan].maxFiles,
      maxFileBytes: PLAN_LIMITS[plan].maxFileBytes,
    },
    plan,
  });
});

filesRoutes.post("/", async (c) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const db = drizzle(c.env.DB, { schema });
  const plan = await getUserPlan(db, userId);
  const limits = PLAN_LIMITS[plan];

  if (limits.maxFiles <= 0) {
    return c.json(
      { error: "Upgrade to Pro to add files to your knowledge base.", upgrade: true },
      402,
    );
  }

  const form = await c.req.formData().catch(() => null);
  const entry = form?.get("file");
  if (!(entry instanceof File)) {
    return c.json({ error: "Missing file upload" }, 400);
  }

  if (entry.size <= 0) return c.json({ error: "Empty file" }, 400);
  if (entry.size > limits.maxFileBytes) {
    return c.json(
      { error: `File exceeds max size of ${Math.floor(limits.maxFileBytes / 1024 / 1024)} MB` },
      413,
    );
  }

  const mimeType = normalizeMimeType(entry.type, entry.name);
  if (!isAllowedMimeType(mimeType)) {
    return c.json({ error: `Unsupported file type: ${mimeType}` }, 415);
  }

  const countRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.file)
    .where(eq(schema.file.userId, userId))
    .get();
  if ((countRow?.count ?? 0) >= limits.maxFiles) {
    return c.json(
      { error: `File limit reached (${limits.maxFiles}). Delete a file to upload a new one.` },
      409,
    );
  }

  // Provision the AI Search instance on first upload.
  await ensureTenant(c.env, db, userId);

  const fileId = crypto.randomUUID();
  const bytes = await entry.arrayBuffer();

  const { itemId, status } = await uploadToTenant(c.env, userId, fileId, entry.name, bytes, {
    userId,
    fileId,
    mimeType,
  });

  const now = new Date();
  const row = {
    id: fileId,
    userId,
    itemId,
    filename: entry.name,
    size: entry.size,
    mimeType,
    status: status === "completed" ? ("ready" as const) : ("indexing" as const),
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.file).values(row).run();

  return c.json({ file: serializeFile(row) }, 201);
});

filesRoutes.delete("/:id", async (c) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const fileId = c.req.param("id");
  const db = drizzle(c.env.DB, { schema });

  const row = await db
    .select()
    .from(schema.file)
    .where(and(eq(schema.file.id, fileId), eq(schema.file.userId, userId)))
    .get();
  if (!row) return c.json({ error: "File not found" }, 404);

  await deleteFromTenant(c.env, userId, row.itemId).catch((err) => {
    console.warn("[files] AI Search delete failed", err);
  });
  await db.delete(schema.file).where(eq(schema.file.id, fileId)).run();

  return c.json({ ok: true });
});
