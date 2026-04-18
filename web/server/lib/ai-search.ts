import { eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

/**
 * One AI Search instance per user, all living under the `bark` namespace
 * (configured as the `AI_SEARCH` binding in wrangler.jsonc). Each instance
 * uses built-in managed storage — we don't need R2.
 *
 * Isolation is index-level: `env.AI_SEARCH.get(tenantId).search(...)` only
 * ever sees that instance's items. A filter-syntax slip can't leak because
 * there is no filter.
 *
 * Instance IDs must match `^[a-z0-9_]+(?:-[a-z0-9_]+)*$` and fit in 32
 * chars. Our user IDs are already URL-safe; we lowercase and replace any
 * unexpected chars as defence-in-depth.
 */
const INSTANCE_ID_MAX_LEN = 32;

export function tenantIdFor(userId: string): string {
  const normalized = userId.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const prefix = "u-";
  return `${prefix}${normalized}`.slice(0, INSTANCE_ID_MAX_LEN);
}

export type RetrievedSource = {
  id: string;
  filename: string;
  snippet: string;
  score: number;
};

export type RetrievalResult = {
  chunks: { text: string; source: RetrievedSource }[];
  sources: RetrievedSource[];
};

export type UploadResult = {
  itemId: string;
  /** `completed` means ready to query; other states mean still processing. */
  status: "completed" | "error" | "skipped" | "queued" | "processing" | "outdated";
};

function buildSnippet(text: string, maxLen = 280): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen - 1)}…` : trimmed;
}

/** Uploaded name = `{fileId}-{filename}` to avoid in-tenant name collisions. */
export function itemNameFor(fileId: string, filename: string): string {
  return `${fileId}-${filename}`;
}

function displayFilenameFromKey(key: string): string {
  // Strip the leading `{fileId}-` prefix we added at upload time.
  const dash = key.indexOf("-");
  return dash > 0 ? key.slice(dash + 1) : key;
}

/**
 * Create the user's AI Search instance if they don't have one yet. We detect
 * first-time use by checking the `file` D1 table — zero rows → no instance.
 * Any create error is logged and swallowed; if the instance already exists,
 * subsequent uploads still work.
 */
export async function ensureTenant(
  env: Cloudflare.Env,
  db: DrizzleD1Database<typeof schema>,
  userId: string,
): Promise<void> {
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.file)
    .where(eq(schema.file.userId, userId))
    .get();
  if ((existing?.count ?? 0) > 0) return;

  try {
    await env.AI_SEARCH.create({ id: tenantIdFor(userId) });
  } catch (err) {
    console.warn("[ai-search] create tenant failed (may already exist)", err);
  }
}

/** Upload a file to the user's instance. Returns the AI Search item id. */
export async function uploadToTenant(
  env: Cloudflare.Env,
  userId: string,
  fileId: string,
  filename: string,
  content: ArrayBuffer,
  metadata?: Record<string, unknown>,
): Promise<UploadResult> {
  const instance = env.AI_SEARCH.get(tenantIdFor(userId));
  const info = await instance.items.upload(
    itemNameFor(fileId, filename),
    content,
    metadata ? { metadata } : undefined,
  );
  return { itemId: info.id, status: info.status };
}

/** Delete a file from the user's instance. */
export async function deleteFromTenant(
  env: Cloudflare.Env,
  userId: string,
  itemId: string,
): Promise<void> {
  const instance = env.AI_SEARCH.get(tenantIdFor(userId));
  await instance.items.delete(itemId);
}

/** Delete the user's entire instance. For account-deletion flows. */
export async function deleteTenant(env: Cloudflare.Env, userId: string): Promise<void> {
  try {
    await env.AI_SEARCH.delete(tenantIdFor(userId));
  } catch (err) {
    console.warn("[ai-search] delete tenant failed", err);
  }
}

/**
 * Retrieve relevant chunks from the user's knowledge base. Returns
 * `{ chunks: [], sources: [] }` on any error (including "instance not
 * found" for users who've never uploaded anything) so chat flow never
 * blocks on RAG failure.
 */
export async function retrieveForUser(
  env: Cloudflare.Env,
  userId: string,
  query: string,
  maxResults = 5,
): Promise<RetrievalResult> {
  if (!query.trim()) return { chunks: [], sources: [] };

  try {
    const instance = env.AI_SEARCH.get(tenantIdFor(userId));
    const response = await instance.search({
      messages: [{ role: "user", content: query }],
      ai_search_options: {
        retrieval: {
          retrieval_type: "hybrid",
          max_num_results: maxResults,
        },
      },
    });

    const sources = new Map<string, RetrievedSource>();
    const chunks: RetrievalResult["chunks"] = [];

    for (const chunk of response.chunks) {
      const key = chunk.item.key;
      const existing = sources.get(key);
      const source: RetrievedSource = existing ?? {
        id: key,
        filename: displayFilenameFromKey(key),
        snippet: buildSnippet(chunk.text),
        score: chunk.score,
      };
      if (!existing) sources.set(key, source);
      chunks.push({ text: chunk.text, source });
    }

    return { chunks, sources: [...sources.values()] };
  } catch (err) {
    console.warn("[ai-search] retrieval failed", err);
    return { chunks: [], sources: [] };
  }
}
