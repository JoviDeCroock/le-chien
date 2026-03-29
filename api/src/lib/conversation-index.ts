import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";

type Env = Cloudflare.Env;

export type ConversationIndexRecord = {
  id: string;
  userId: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
};

export type IndexedConversation = {
  id: string;
  title: string;
  model: string;
  created_at: number;
  updated_at: number;
};

function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export async function listIndexedConversations(
  env: Env,
  userId: string,
): Promise<IndexedConversation[]> {
  const rows = await getDb(env)
    .select()
    .from(schema.conversationIndex)
    .where(eq(schema.conversationIndex.userId, userId))
    .orderBy(desc(schema.conversationIndex.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    model: row.model,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }));
}

export async function upsertIndexedConversation(
  env: Env,
  record: ConversationIndexRecord,
): Promise<void> {
  await getDb(env)
    .insert(schema.conversationIndex)
    .values(record)
    .onConflictDoUpdate({
      target: schema.conversationIndex.id,
      set: {
        userId: record.userId,
        title: record.title,
        model: record.model,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
}

export async function deleteIndexedConversation(
  env: Env,
  userId: string,
  conversationId: string,
): Promise<void> {
  await getDb(env)
    .delete(schema.conversationIndex)
    .where(
      and(
        eq(schema.conversationIndex.id, conversationId),
        eq(schema.conversationIndex.userId, userId),
      ),
    );
}
