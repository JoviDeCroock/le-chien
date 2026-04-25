import { Agent, callable, type StreamingResponse } from "agents";
import {
  APICallError,
  EmptyResponseBodyError,
  LoadAPIKeyError,
  NoContentGeneratedError,
  NoSuchModelError,
  streamText,
  stepCountIs,
} from "ai";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { getModel, MODELS, DEFAULT_MODEL, isPremiumModel } from "../lib/models";
import type { ModelId } from "../lib/models";
import { createTools } from "../lib/tools";
import {
  buildSubscriptionSnapshot,
  decrementDailyMessageUsage,
  decrementDailyPremiumMessageUsage,
  getSubscriptionSnapshot,
  getUsageDate,
  tryIncrementDailyMessageUsage,
  tryIncrementDailyPremiumMessageUsage,
} from "../lib/plans";
import type { SubscriptionSnapshot } from "../lib/plans";
import { trackServerEvent, captureServerException } from "../lib/posthog";
import { trackInferenceCost } from "../lib/polar-events";
import { isProduction } from "../utils/isProduction";
import { isBillingEnabled } from "../utils/billingEnabled";

type Conversation = {
  id: string;
  title: string;
  model: string;
  created_at: number;
  updated_at: number;
};

type Message = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  tool_calls: string | null;
  created_at: number;
};

type ConversationIndexSyncAction = "upsert" | "delete";

type ConversationIndexSyncRow = {
  conversation_id: string;
  action: ConversationIndexSyncAction;
  sync_token: string;
  title: string | null;
  model: string | null;
  conversation_created_at: number | null;
  conversation_updated_at: number | null;
  attempts: number;
  last_error: string | null;
  next_attempt_at: number;
  queued_at: number;
  updated_at: number;
};

type Memory = {
  id: string;
  key: string;
  value: string;
  created_at: number;
  updated_at: number;
};

type PetMood = "ecstatic" | "happy" | "content" | "bored" | "sad" | "neglected";

type PetRow = {
  id: string;
  name: string;
  hunger: number;
  happiness: number;
  energy: number;
  last_fed: number;
  last_played: number;
  last_petted: number;
  created_at: number;
  updated_at: number;
};

type PetState = {
  name: string;
  hunger: number;
  happiness: number;
  energy: number;
  mood: PetMood;
  last_fed: number;
  last_played: number;
  last_petted: number;
};

/**
 * Rough token estimate: ~4 characters per token.
 * Budget leaves room for system prompt + response.
 */
const MAX_HISTORY_CHARS = 48_000; // ~12k tokens
const CONVERSATION_INDEX_SYNC_INTERVAL_SECONDS = 60;
const CONVERSATION_INDEX_RECONCILE_INTERVAL_SECONDS = 60 * 60;
const CONVERSATION_INDEX_SYNC_BATCH_SIZE = 25;
const MAX_SYNC_ERROR_LENGTH = 500;
const MAX_CONVERSATION_INDEX_SYNC_PASSES = 5;

class EmptyAssistantResponseError extends Error {
  constructor() {
    super("The model finished without returning a response. Please try again.");
    this.name = "EmptyAssistantResponseError";
  }
}

function toError(err: unknown, fallback = "Unknown error") {
  return err instanceof Error ? err : new Error(typeof err === "string" ? err : fallback);
}

function isAiServiceError(err: unknown) {
  return (
    APICallError.isInstance(err) ||
    EmptyResponseBodyError.isInstance(err) ||
    LoadAPIKeyError.isInstance(err) ||
    NoContentGeneratedError.isInstance(err) ||
    NoSuchModelError.isInstance(err)
  );
}

function getClientErrorMessage(err: unknown) {
  if (err instanceof EmptyAssistantResponseError) return err.message;
  if (isAiServiceError(err)) {
    return "The AI service failed to respond. Please try again in a moment.";
  }
  return "Something went wrong while sending your message. Please try again.";
}

function getFailureType(err: unknown) {
  if (err instanceof EmptyAssistantResponseError) return "empty_response";
  if (isAiServiceError(err)) return "ai_service";
  return "generic";
}

function getConversationIndexRetryDelaySeconds(attempts: number) {
  return Math.min(300, 2 ** Math.min(attempts, 8));
}

function trimHistory(
  messages: { role: string; content: string }[],
): { role: string; content: string }[] {
  // Fast path: if everything fits, send it all
  let totalChars = 0;
  for (const m of messages) totalChars += m.content.length;
  if (totalChars <= MAX_HISTORY_CHARS) return messages;

  // Always keep the latest messages; walk backwards until we hit the budget
  const kept: { role: string; content: string }[] = [];
  let budget = MAX_HISTORY_CHARS;
  for (let i = messages.length - 1; i >= 0; i--) {
    const cost = messages[i].content.length;
    if (budget - cost < 0 && kept.length > 0) break;
    budget -= cost;
    kept.unshift(messages[i]);
  }

  return kept;
}

export class ChatAgent extends Agent<Cloudflare.Env> {
  async onStart() {
    this.sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'glm-4.7-flash',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        tool_calls TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `;
    this.sql`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, created_at)
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS pet (
        id TEXT PRIMARY KEY DEFAULT 'default',
        name TEXT NOT NULL DEFAULT 'le chien',
        hunger INTEGER NOT NULL DEFAULT 50,
        happiness INTEGER NOT NULL DEFAULT 50,
        energy INTEGER NOT NULL DEFAULT 50,
        last_fed INTEGER NOT NULL DEFAULT (unixepoch()),
        last_played INTEGER NOT NULL DEFAULT (unixepoch()),
        last_petted INTEGER NOT NULL DEFAULT (unixepoch()),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS conversation_d1_sync_queue (
        conversation_id TEXT PRIMARY KEY,
        action TEXT NOT NULL CHECK(action IN ('upsert', 'delete')),
        sync_token TEXT NOT NULL,
        title TEXT,
        model TEXT,
        conversation_created_at INTEGER,
        conversation_updated_at INTEGER,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_attempt_at INTEGER NOT NULL DEFAULT 0,
        queued_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `;
    this.sql`
      CREATE INDEX IF NOT EXISTS idx_conversation_d1_sync_due
      ON conversation_d1_sync_queue(next_attempt_at, updated_at)
    `;
    this.sql`
      CREATE TABLE IF NOT EXISTS conversation_d1_sync_meta (
        key TEXT PRIMARY KEY,
        value INTEGER NOT NULL
      )
    `;
    // Migration: add tool_calls column for existing DOs
    try {
      this.sql`ALTER TABLE messages ADD COLUMN tool_calls TEXT`;
    } catch {
      // Column already exists — ignore
    }
    try {
      this
        .sql`ALTER TABLE conversation_d1_sync_queue ADD COLUMN sync_token TEXT NOT NULL DEFAULT ''`;
    } catch {
      // Column already exists — ignore
    }

    await this.scheduleEvery<null>(
      CONVERSATION_INDEX_SYNC_INTERVAL_SECONDS,
      "flushConversationIndexSyncQueue",
      null,
      { retry: { maxAttempts: 1 } },
    );
    this.reconcileConversationIndexIfStale();
  }

  private kickConversationIndexSync(): void {
    this.queue<null>("flushConversationIndexSyncQueue", null, { retry: { maxAttempts: 1 } }).catch(
      (err) => {
        captureServerException(this.env, this.name, toError(err, "Failed to queue D1 sync"), {
          source: "conversation_index",
        });
      },
    );
  }

  private enqueueConversationIndexSync(conversation: Conversation, kick = true): void {
    const queuedAt = Math.floor(Date.now() / 1000);
    const syncToken = crypto.randomUUID();
    try {
      this.sql`
        INSERT INTO conversation_d1_sync_queue (
          conversation_id,
          action,
          sync_token,
          title,
          model,
          conversation_created_at,
          conversation_updated_at,
          attempts,
          last_error,
          next_attempt_at,
          queued_at,
          updated_at
        )
        VALUES (
          ${conversation.id},
          ${"upsert"},
          ${syncToken},
          ${conversation.title},
          ${conversation.model},
          ${conversation.created_at},
          ${conversation.updated_at},
          ${0},
          ${null},
          ${0},
          ${queuedAt},
          ${queuedAt}
        )
        ON CONFLICT(conversation_id) DO UPDATE SET
          action = excluded.action,
          sync_token = excluded.sync_token,
          title = excluded.title,
          model = excluded.model,
          conversation_created_at = excluded.conversation_created_at,
          conversation_updated_at = excluded.conversation_updated_at,
          attempts = 0,
          last_error = NULL,
          next_attempt_at = 0,
          updated_at = excluded.updated_at
      `;
      if (kick) this.kickConversationIndexSync();
    } catch (err) {
      captureServerException(
        this.env,
        this.name,
        toError(err, "Failed to enqueue conversation index sync"),
        { source: "conversation_index", conversation_id: conversation.id, action: "upsert" },
      );
    }
  }

  private enqueueConversationIndexDelete(conversationId: string): void {
    const queuedAt = Math.floor(Date.now() / 1000);
    const syncToken = crypto.randomUUID();
    try {
      this.sql`
        INSERT INTO conversation_d1_sync_queue (
          conversation_id,
          action,
          sync_token,
          title,
          model,
          conversation_created_at,
          conversation_updated_at,
          attempts,
          last_error,
          next_attempt_at,
          queued_at,
          updated_at
        )
        VALUES (
          ${conversationId},
          ${"delete"},
          ${syncToken},
          ${null},
          ${null},
          ${null},
          ${null},
          ${0},
          ${null},
          ${0},
          ${queuedAt},
          ${queuedAt}
        )
        ON CONFLICT(conversation_id) DO UPDATE SET
          action = excluded.action,
          sync_token = excluded.sync_token,
          title = NULL,
          model = NULL,
          conversation_created_at = NULL,
          conversation_updated_at = NULL,
          attempts = 0,
          last_error = NULL,
          next_attempt_at = 0,
          updated_at = excluded.updated_at
      `;
      this.kickConversationIndexSync();
    } catch (err) {
      captureServerException(
        this.env,
        this.name,
        toError(err, "Failed to enqueue conversation index delete"),
        { source: "conversation_index", conversation_id: conversationId, action: "delete" },
      );
    }
  }

  private getConversationForIndex(conversationId: string): Conversation | null {
    const rows = this.sql<Conversation>`
      SELECT id, title, model, created_at, updated_at
      FROM conversations
      WHERE id = ${conversationId}
    `;
    return rows[0] ?? null;
  }

  private getConversationIndexSyncRow(conversationId: string): ConversationIndexSyncRow | null {
    const rows = this.sql<ConversationIndexSyncRow>`
      SELECT
        conversation_id,
        action,
        sync_token,
        title,
        model,
        conversation_created_at,
        conversation_updated_at,
        attempts,
        last_error,
        next_attempt_at,
        queued_at,
        updated_at
      FROM conversation_d1_sync_queue
      WHERE conversation_id = ${conversationId}
    `;
    return rows[0] ?? null;
  }

  private reconcileConversationIndexIfStale(): void {
    const now = Math.floor(Date.now() / 1000);
    const rows = this.sql<{ value: number }>`
      SELECT value FROM conversation_d1_sync_meta WHERE key = 'last_reconcile_at'
    `;
    const lastReconciledAt = rows[0]?.value ?? 0;
    if (now - lastReconciledAt < CONVERSATION_INDEX_RECONCILE_INTERVAL_SECONDS) return;

    for (const conversation of this.listConversations()) {
      this.enqueueConversationIndexSync(conversation, false);
    }

    this.sql`
      INSERT INTO conversation_d1_sync_meta (key, value)
      VALUES ('last_reconcile_at', ${now})
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `;
    this.kickConversationIndexSync();
  }

  private async syncConversationIndexRow(row: ConversationIndexSyncRow): Promise<void> {
    if (row.action === "delete") {
      await this.env.DB.prepare("DELETE FROM conversation_index WHERE id = ? AND user_id = ?")
        .bind(row.conversation_id, this.name)
        .run();
      return;
    }

    if (
      row.title === null ||
      row.model === null ||
      row.conversation_created_at === null ||
      row.conversation_updated_at === null
    ) {
      throw new Error("Conversation index upsert is missing metadata");
    }

    const syncedAt = Math.floor(Date.now() / 1000);
    await this.env.DB.prepare(
      `
        INSERT INTO conversation_index (id, user_id, title, model, created_at, updated_at, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          title = excluded.title,
          model = excluded.model,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          synced_at = excluded.synced_at
      `,
    )
      .bind(
        row.conversation_id,
        this.name,
        row.title,
        row.model,
        row.conversation_created_at,
        row.conversation_updated_at,
        syncedAt,
      )
      .run();
  }

  private async processConversationIndexSyncRow(
    initialRow: ConversationIndexSyncRow,
    now: number,
  ): Promise<void> {
    let row: ConversationIndexSyncRow | null = initialRow;

    for (let pass = 0; pass < MAX_CONVERSATION_INDEX_SYNC_PASSES; pass++) {
      if (!row || row.next_attempt_at > now) return;

      try {
        await this.syncConversationIndexRow(row);
        this.sql`
          DELETE FROM conversation_d1_sync_queue
          WHERE conversation_id = ${row.conversation_id}
            AND sync_token = ${row.sync_token}
        `;

        const latestRow = this.getConversationIndexSyncRow(row.conversation_id);
        if (!latestRow) {
          if (row.attempts > 0) {
            trackServerEvent(this.env, this.name, "conversation_index_sync_recovered", {
              conversation_id: row.conversation_id,
              action: row.action,
              attempts: row.attempts,
            });
          }
          return;
        }

        if (latestRow.sync_token === row.sync_token) return;
        row = latestRow;
      } catch (err) {
        const error = toError(err, "Conversation index sync failed");
        const attempts = row.attempts + 1;
        const nextAttemptAt = now + getConversationIndexRetryDelaySeconds(attempts);
        const lastError = error.message.slice(0, MAX_SYNC_ERROR_LENGTH);

        this.sql`
          UPDATE conversation_d1_sync_queue
          SET
            attempts = ${attempts},
            last_error = ${lastError},
            next_attempt_at = ${nextAttemptAt},
            updated_at = ${now}
          WHERE conversation_id = ${row.conversation_id}
            AND sync_token = ${row.sync_token}
        `;

        const latestRow = this.getConversationIndexSyncRow(row.conversation_id);
        if (!latestRow) return;
        if (latestRow.sync_token !== row.sync_token) {
          row = latestRow;
          continue;
        }

        trackServerEvent(this.env, this.name, "conversation_index_sync_failed", {
          conversation_id: row.conversation_id,
          action: row.action,
          attempts,
          next_attempt_at: nextAttemptAt,
        });
        captureServerException(this.env, this.name, error, {
          source: "conversation_index",
          conversation_id: row.conversation_id,
          action: row.action,
          attempts,
        });
        return;
      }
    }
  }

  async flushConversationIndexSyncQueue(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const rows = this.sql<ConversationIndexSyncRow>`
      SELECT
        conversation_id,
        action,
        sync_token,
        title,
        model,
        conversation_created_at,
        conversation_updated_at,
        attempts,
        last_error,
        next_attempt_at,
        queued_at,
        updated_at
      FROM conversation_d1_sync_queue
      WHERE next_attempt_at <= ${now}
      ORDER BY updated_at ASC
      LIMIT ${CONVERSATION_INDEX_SYNC_BATCH_SIZE}
    `;

    for (const row of rows) {
      const latestRow = this.getConversationIndexSyncRow(row.conversation_id);
      if (!latestRow || latestRow.next_attempt_at > now) continue;
      await this.processConversationIndexSyncRow(latestRow, now);
    }
  }

  createConversation(title: string, model?: string): Conversation {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const selectedModel = model && model in MODELS ? model : DEFAULT_MODEL;

    this.sql`
      INSERT INTO conversations (id, title, model, created_at, updated_at)
      VALUES (${id}, ${title}, ${selectedModel}, ${now}, ${now})
    `;

    const conversation = { id, title, model: selectedModel, created_at: now, updated_at: now };
    this.enqueueConversationIndexSync(conversation);
    return conversation;
  }

  listConversations(): Conversation[] {
    return this.sql<Conversation>`
      SELECT id, title, model, created_at, updated_at
      FROM conversations
      ORDER BY updated_at DESC
    `;
  }

  getConversation(conversationId: string): { conversation: Conversation; messages: Message[] } {
    const conversations = this.sql<Conversation>`
      SELECT id, title, model, created_at, updated_at
      FROM conversations WHERE id = ${conversationId}
    `;
    if (conversations.length === 0) throw new Error("Conversation not found");

    const messages = this.sql<Message>`
      SELECT id, conversation_id, role, content, tool_calls, created_at
      FROM messages WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `;

    return { conversation: conversations[0], messages };
  }

  deleteConversation(conversationId: string): void {
    this.sql`DELETE FROM messages WHERE conversation_id = ${conversationId}`;
    this.sql`DELETE FROM conversations WHERE id = ${conversationId}`;
    this.enqueueConversationIndexDelete(conversationId);
  }

  updateConversationTitle(conversationId: string, title: string): void {
    const now = Math.floor(Date.now() / 1000);
    this.sql`
      UPDATE conversations SET title = ${title}, updated_at = ${now}
      WHERE id = ${conversationId}
    `;
    const conversation = this.getConversationForIndex(conversationId);
    if (conversation) this.enqueueConversationIndexSync(conversation);
  }

  listMemories(): Memory[] {
    return this.sql<Memory>`
      SELECT id, key, value, created_at, updated_at
      FROM memories
      ORDER BY updated_at DESC
    `;
  }

  createMemory(key: string, value: string): Memory {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    this.sql`
      INSERT INTO memories (id, key, value, created_at, updated_at)
      VALUES (${id}, ${key}, ${value}, ${now}, ${now})
    `;
    return { id, key, value, created_at: now, updated_at: now };
  }

  updateMemory(memoryId: string, key: string, value: string): Memory {
    const now = Math.floor(Date.now() / 1000);
    this.sql`
      UPDATE memories SET key = ${key}, value = ${value}, updated_at = ${now}
      WHERE id = ${memoryId}
    `;
    const rows = this
      .sql<Memory>`SELECT id, key, value, created_at, updated_at FROM memories WHERE id = ${memoryId}`;
    if (rows.length === 0) throw new Error("Memory not found");
    return rows[0];
  }

  deleteMemory(memoryId: string): void {
    this.sql`DELETE FROM memories WHERE id = ${memoryId}`;
  }

  private computeMood(hunger: number, happiness: number, energy: number): PetMood {
    const avg = (hunger + happiness + energy) / 3;
    if (avg >= 80) return "ecstatic";
    if (avg >= 60) return "happy";
    if (avg >= 40) return "content";
    if (avg >= 20) return "bored";
    if (avg >= 5) return "sad";
    return "neglected";
  }

  private applyDecay(row: PetRow): { hunger: number; happiness: number; energy: number } {
    const now = Math.floor(Date.now() / 1000);
    const lastInteraction = Math.max(row.last_fed, row.last_played, row.last_petted);
    const elapsedHours = (now - row.updated_at) / 3600;

    const hunger = Math.max(0, row.hunger - elapsedHours * 4);
    const happiness = Math.max(0, row.happiness - elapsedHours * 3);

    // Split elapsed window into active (≤2h post-interaction, energy drains)
    // and resting (>2h post-interaction, energy recovers) portions.
    const restStartSec = lastInteraction + 2 * 3600;
    const activeSec = Math.max(0, Math.min(restStartSec, now) - row.updated_at);
    const restingSec = Math.max(0, now - Math.max(restStartSec, row.updated_at));
    const energy = row.energy - (activeSec / 3600) * 2 + (restingSec / 3600) * 3;

    return {
      hunger: Math.round(Math.max(0, Math.min(100, hunger))),
      happiness: Math.round(Math.max(0, Math.min(100, happiness))),
      energy: Math.round(Math.max(0, Math.min(100, energy))),
    };
  }

  private ensurePetExists(): PetRow {
    const rows = this.sql<PetRow>`SELECT * FROM pet WHERE id = 'default'`;
    if (rows.length > 0) return rows[0];
    this.sql`INSERT OR IGNORE INTO pet (id) VALUES ('default')`;
    return this.sql<PetRow>`SELECT * FROM pet WHERE id = 'default'`[0];
  }

  private persistPet(hunger: number, happiness: number, energy: number): void {
    const now = Math.floor(Date.now() / 1000);
    this.sql`
      UPDATE pet SET hunger = ${hunger}, happiness = ${happiness}, energy = ${energy}, updated_at = ${now}
      WHERE id = 'default'
    `;
  }

  getPetState(): PetState {
    const row = this.ensurePetExists();
    const { hunger, happiness, energy } = this.applyDecay(row);
    this.persistPet(hunger, happiness, energy);
    return {
      name: row.name,
      hunger,
      happiness,
      energy,
      mood: this.computeMood(hunger, happiness, energy),
      last_fed: row.last_fed,
      last_played: row.last_played,
      last_petted: row.last_petted,
    };
  }

  feedPet(): PetState {
    const row = this.ensurePetExists();
    const decayed = this.applyDecay(row);
    const hunger = Math.min(100, decayed.hunger + 25);
    const happiness = Math.min(100, decayed.happiness + 5);
    const energy = decayed.energy;
    const now = Math.floor(Date.now() / 1000);
    this.sql`
      UPDATE pet SET hunger = ${hunger}, happiness = ${happiness}, energy = ${energy},
        last_fed = ${now}, updated_at = ${now}
      WHERE id = 'default'
    `;
    return {
      name: row.name,
      hunger,
      happiness,
      energy,
      mood: this.computeMood(hunger, happiness, energy),
      last_fed: now,
      last_played: row.last_played,
      last_petted: row.last_petted,
    };
  }

  playWithPet(): PetState {
    const row = this.ensurePetExists();
    const decayed = this.applyDecay(row);
    const hunger = Math.max(0, decayed.hunger - 10);
    const happiness = Math.min(100, decayed.happiness + 20);
    const energy = Math.max(0, decayed.energy - 15);
    const now = Math.floor(Date.now() / 1000);
    this.sql`
      UPDATE pet SET hunger = ${hunger}, happiness = ${happiness}, energy = ${energy},
        last_played = ${now}, updated_at = ${now}
      WHERE id = 'default'
    `;
    return {
      name: row.name,
      hunger,
      happiness,
      energy,
      mood: this.computeMood(hunger, happiness, energy),
      last_fed: row.last_fed,
      last_played: now,
      last_petted: row.last_petted,
    };
  }

  petTheDog(): PetState {
    const row = this.ensurePetExists();
    const decayed = this.applyDecay(row);
    const hunger = decayed.hunger;
    const happiness = Math.min(100, decayed.happiness + 10);
    const energy = Math.min(100, decayed.energy + 5);
    const now = Math.floor(Date.now() / 1000);
    this.sql`
      UPDATE pet SET hunger = ${hunger}, happiness = ${happiness}, energy = ${energy},
        last_petted = ${now}, updated_at = ${now}
      WHERE id = 'default'
    `;
    return {
      name: row.name,
      hunger,
      happiness,
      energy,
      mood: this.computeMood(hunger, happiness, energy),
      last_fed: row.last_fed,
      last_played: row.last_played,
      last_petted: now,
    };
  }

  async sendMessage(
    stream: StreamingResponse,
    conversationId: string,
    content: string,
    model?: string,
    enabledExtras?: string[],
  ) {
    const db = drizzle(this.env.DB, { schema });
    const userId = this.name;

    // Verify conversation exists
    const conversations = this.sql<Conversation>`
      SELECT id, model FROM conversations WHERE id = ${conversationId}
    `;
    if (conversations.length === 0) {
      stream.end({
        error: "Conversation not found.",
        failureType: "generic",
        discardOptimistic: true,
      });
      return;
    }

    const conversation = conversations[0];
    const selectedModel = (model ?? conversation.model) as ModelId;
    const userMessageId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const usageDate = getUsageDate();
    let subscription: SubscriptionSnapshot;
    try {
      subscription = await getSubscriptionSnapshot(this.env, db, userId);
    } catch (err) {
      captureServerException(this.env, userId, toError(err, "Failed to load subscription"), {
        model: selectedModel,
        conversation_id: conversationId,
        source: "subscription",
      });
      stream.end({
        error: "We couldn't verify your plan or usage. Please try again.",
        failureType: "generic",
        discardOptimistic: true,
      });
      return;
    }
    let usageReserved = false;

    const isPremium = isPremiumModel(selectedModel);
    let premiumUsageReserved = false;
    const enforceRateLimits = isProduction(this.env) && isBillingEnabled(this.env);

    const releaseUsageReservation = async () => {
      try {
        if (usageReserved) {
          await decrementDailyMessageUsage(this.env.DB, userId, usageDate);
          usageReserved = false;
        }
        if (premiumUsageReserved) {
          await decrementDailyPremiumMessageUsage(this.env.DB, userId, usageDate);
          premiumUsageReserved = false;
        }
      } catch (err) {
        captureServerException(
          this.env,
          userId,
          toError(err, "Failed to roll back usage reservation"),
          { model: selectedModel, conversation_id: conversationId, source: "usage" },
        );
      }
    };

    if (enforceRateLimits && subscription.plan === "free") {
      try {
        if (subscription.usage.limitReached) {
          stream.end({ blocked: true, reason: "daily_limit", subscription });
          return;
        }

        if (isPremium && subscription.usage.premiumLimitReached) {
          stream.end({ blocked: true, reason: "premium_limit", subscription });
          return;
        }

        const usedCount = await tryIncrementDailyMessageUsage(this.env.DB, userId, usageDate);
        if (usedCount === null) {
          subscription = await getSubscriptionSnapshot(this.env, db, userId);
          stream.end({ blocked: true, reason: "daily_limit", subscription });
          return;
        }

        usageReserved = true;

        if (isPremium) {
          const premiumUsedCount = await tryIncrementDailyPremiumMessageUsage(
            this.env.DB,
            userId,
            usageDate,
          );
          if (premiumUsedCount === null) {
            await releaseUsageReservation();
            subscription = await getSubscriptionSnapshot(this.env, db, userId);
            stream.end({ blocked: true, reason: "premium_limit", subscription });
            return;
          }
          premiumUsageReserved = true;
          subscription = buildSubscriptionSnapshot(
            "free",
            usedCount,
            undefined,
            premiumUsedCount,
            subscription.usage.dailyImageGenerationsUsed,
            subscription.usage.dailyWebSearchesUsed,
            subscription.billingEnabled,
          );
        } else {
          subscription = buildSubscriptionSnapshot(
            "free",
            usedCount,
            undefined,
            subscription.usage.dailyPremiumMessagesUsed,
            subscription.usage.dailyImageGenerationsUsed,
            subscription.usage.dailyWebSearchesUsed,
            subscription.billingEnabled,
          );
        }
      } catch (err) {
        await releaseUsageReservation();
        captureServerException(this.env, userId, toError(err, "Failed to reserve usage"), {
          model: selectedModel,
          conversation_id: conversationId,
          source: "usage",
        });
        stream.end({
          error: "We couldn't verify your plan or usage. Please try again.",
          failureType: "generic",
          discardOptimistic: true,
        });
        return;
      }
    }

    const extras = new Set(enabledExtras ?? []);

    let aiModel: ReturnType<typeof getModel>;
    try {
      aiModel = getModel(this.env, selectedModel, {
        sessionAffinity: conversationId,
      });
    } catch (err) {
      await releaseUsageReservation();
      captureServerException(this.env, userId, toError(err, "Failed to load model"), {
        model: selectedModel,
        conversation_id: conversationId,
      });
      stream.end({
        error: getClientErrorMessage(err),
        failureType: getFailureType(err),
        discardOptimistic: true,
        subscription,
      });
      return;
    }

    const tools = createTools(this.env, {
      onSaveMemory: (key, value) => this.createMemory(key, value),
      onUpdateMemory: (id, key, value) => this.updateMemory(id, key, value),
      existingMemories: () =>
        this.sql<{ id: string; key: string; value: string }>`
          SELECT id, key, value FROM memories ORDER BY updated_at DESC
        `,
      rateLimit: enforceRateLimits
        ? {
            db: this.env.DB,
            userId,
            plan: subscription.plan,
          }
        : undefined,
      enabledExtras: enabledExtras ?? [],
      imageGenerationLimitReached:
        enforceRateLimits && subscription.usage.imageGenerationLimitReached,
      webSearchLimitReached: enforceRateLimits && subscription.usage.webSearchLimitReached,
    });

    // Stream AI response
    let fullContent = "";
    const toolCalls: { id: string; name: string; args: unknown; result: unknown }[] = [];
    const assistantMessageId = crypto.randomUUID();
    let userMessagePersisted = false;
    let responseCompleted = false;
    let assistantMessagePersisted = false;

    try {
      this.sql`
        INSERT INTO messages (id, conversation_id, role, content, created_at)
        VALUES (${userMessageId}, ${conversationId}, ${"user"}, ${content}, ${now})
      `;
      userMessagePersisted = true;

      this.sql`UPDATE conversations SET updated_at = ${now} WHERE id = ${conversationId}`;
      const updatedConversation = this.getConversationForIndex(conversationId);
      if (updatedConversation) this.enqueueConversationIndexSync(updatedConversation);

      const history = this.sql<{ role: string; content: string }>`
        SELECT role, content FROM messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at ASC
      `;

      // Load user memories for context
      const memories = this.sql<{ key: string; value: string }>`
        SELECT key, value FROM memories ORDER BY updated_at DESC
      `;
      let systemPrompt = `You're le chien. You talk like a person — not a chatbot, not a customer support agent, not a press release.

Rules:
- Use contractions. Say "don't" not "do not". Say "it's" not "it is".
- Never start a response with "Great question", "Absolutely!", "Certainly!", "Of course!", or any other filler opener. Just answer.
- Never say "It's worth noting", "I should mention", "Let me clarify", "As an AI", "I'd be happy to", "Interestingly enough", or "That's a fantastic question".
- Never use "delve", "leverage", "utilize", "facilitate", "streamline", "empower", "robust", "comprehensive", "cutting-edge", "game-changer", or "revolutionize".
- Don't list five things when one will do. Don't pad answers with disclaimers.
- If you don't know something, say "I don't know" — don't dress it up.
- Have opinions when asked. Don't sit on the fence with "it depends on your use case" when you can give a straight answer.
- Match how the person talks to you. Short question, short answer. Long detailed question, longer detailed answer.
- Use markdown formatting (headings, lists, code blocks) when it helps — not to make short answers look longer.
- You have tools: use calculate for math, get_current_datetime for time, ${extras.has("web_search") ? "web_search to search the web for current info, " : ""}${extras.has("read_url") ? "read_url for web pages, " : ""}${extras.has("generate_image") ? "generate_image for pictures, " : ""}run_javascript to run code. Always run code rather than just showing it when asked to test something. Just use tools — don't narrate that you're using them.
- When you use web_search, always cite your sources inline. Use numbered markdown links like [1](url), [2](url) etc. next to the claims they support. At the end of your response, list all sources with their titles. This lets people verify what you're saying.
- Proactively use save_memory when the person shares something worth remembering: their name, role, preferences, projects, tech stack, goals, or any context they'd expect you to know next time. Don't save throwaway details or things only relevant to the current question. Before saving, check the existing memories listed below — if a memory with the same topic already exists, update it instead of creating a duplicate. Never save two memories about the same thing.

Live UI artifacts:
- When the user asks for an interactive component, demo, widget, or anything best shown as a live UI (calculator, chart, form playground, animated visual, mini-game, prototype), emit a \`\`\`preact code block. The app runs it in a sandboxed worker and shows the rendered component inline.
- Strict rules for the \`\`\`preact block:
  - No JSX. Use \`h(tag, props, ...children)\` calls. Example: \`h("button", { onClick: () => setN(n + 1), style: { padding: "6px 12px", background: "#7c3aed", color: "#fff", borderRadius: "8px" } }, "Click")\`.
  - No \`import\` or \`export\` statements. The runtime injects globals: \`h\`, \`Fragment\`, \`useState\`, \`useEffect\`, \`useRef\`, \`useMemo\`, \`useCallback\`. Nothing else is available.
  - No network or storage: \`fetch\`, \`XMLHttpRequest\`, \`WebSocket\`, \`localStorage\`, \`sessionStorage\`, \`navigator\` are all blocked.
  - End the block with a single PascalCase function (or \`const Foo = ...\`) — that's the component the runtime renders. Place it last.
  - Style with inline \`style={{ ... }}\` objects, NOT Tailwind classes. The host page's Tailwind is JIT-compiled from source, so any utility you invent (\`bg-violet-600\`, \`text-neutral-200\`, etc.) will silently not exist at runtime and your component will render unstyled. Inline styles always apply. Use camelCase keys (\`backgroundColor\`, \`borderRadius\`) and string values.
  - Theme: the artifact renders on a dark card. Default to dark surfaces (\`background: "#171717"\` or transparent), light body text (\`color: "#d4d4d4"\`), white for headings (\`color: "#fff"\`), violet for accents/primary actions (\`background: "#7c3aed"\`, \`color: "#a78bfa"\`), and \`#404040\` borders. If you pick a light background, use dark text (\`color: "#171717"\`) so content is readable.
  - Size to content. Don't set \`minHeight: "100vh"\`, \`height: "100vh"\`, \`position: "fixed"\`, or \`inset: 0\` on the root — the artifact is a card inside a chat bubble, not a full page. Keep the component roughly the size of a chat message.
  - Every button and interactive element needs visible text or an aria-label plus an icon — don't render empty buttons.
  - Keep components self-contained — no external data, no side effects beyond the component tree.
- Don't reach for artifacts on every reply. Use them when a live, interactive thing is genuinely better than text or a static code block. For "show me the code" questions, a normal \`\`\`tsx fence is still right.`;

      if (memories.length > 0) {
        const memoryBlock = memories.map((m) => `- ${m.key}: ${m.value}`).join("\n");
        systemPrompt += `\n\nStuff you know about this person — use it when it's relevant, ignore it when it's not:\n${memoryBlock}`;
      }

      // Inject pet state
      const pet = this.getPetState();
      const petNow = Math.floor(Date.now() / 1000);
      const hoursSinceFed = ((petNow - pet.last_fed) / 3600).toFixed(1);
      const hoursSincePlayed = ((petNow - pet.last_played) / 3600).toFixed(1);
      const hoursSincePetted = ((petNow - pet.last_petted) / 3600).toFixed(1);
      let petContext = `\n\nThis person has a virtual pet dog named "${pet.name}" in the app. Current mood: ${pet.mood}. Hunger: ${pet.hunger}/100, Happiness: ${pet.happiness}/100, Energy: ${pet.energy}/100. Last fed: ${hoursSinceFed}h ago. Last played with: ${hoursSincePlayed}h ago. Last petted: ${hoursSincePetted}h ago.`;
      if (pet.mood === "neglected" || pet.mood === "sad") {
        petContext += ` The dog seems lonely — mention it if it feels natural, don't force it.`;
      } else if (pet.mood === "ecstatic") {
        petContext += ` The dog is thriving. A brief warm nod is fine if the moment calls for it.`;
      }
      systemPrompt += petContext;

      const trimmed = trimHistory(history);

      const result = streamText({
        model: aiModel,
        system: systemPrompt,
        messages: trimmed.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        tools,
        stopWhen: stepCountIs(5),
      });

      for await (const part of result.fullStream) {
        switch (part.type) {
          case "reasoning-delta":
            stream.send({
              __event: "reasoning",
              text: part.text,
            });
            break;
          case "text-delta":
            fullContent += part.text;
            stream.send(part.text);
            break;
          case "tool-call":
            stream.send({
              __event: "tool-call",
              id: part.toolCallId,
              name: part.toolName,
              args: part.input,
            });
            break;
          case "tool-result":
            toolCalls.push({
              id: part.toolCallId,
              name: part.toolName,
              args: part.input,
              result: part.output,
            });
            stream.send({
              __event: "tool-result",
              id: part.toolCallId,
              name: part.toolName,
              result: part.output,
            });
            break;
        }
      }

      responseCompleted = true;

      if (fullContent.trim().length === 0 && toolCalls.length === 0) {
        throw new EmptyAssistantResponseError();
      }

      // Save assistant message with tool call metadata
      const finishedAt = Math.floor(Date.now() / 1000);
      const toolCallsJson = toolCalls.length > 0 ? JSON.stringify(toolCalls) : null;
      this.sql`
        INSERT INTO messages (id, conversation_id, role, content, tool_calls, created_at)
        VALUES (${assistantMessageId}, ${conversationId}, ${"assistant"}, ${fullContent}, ${toolCallsJson}, ${finishedAt})
      `;
      assistantMessagePersisted = true;

      try {
        // Auto-title: if this is the first exchange, generate a title from user message
        const messageCount = this.sql<{ count: number }>`
          SELECT COUNT(*) as count FROM messages WHERE conversation_id = ${conversationId}
        `;
        if (messageCount[0].count <= 2) {
          const title = content.length > 50 ? content.slice(0, 47) + "..." : content;
          this
            .sql`UPDATE conversations SET title = ${title}, updated_at = ${finishedAt} WHERE id = ${conversationId}`;
        }
        const finishedConversation = this.getConversationForIndex(conversationId);
        if (finishedConversation) this.enqueueConversationIndexSync(finishedConversation);
      } catch (err) {
        captureServerException(
          this.env,
          userId,
          toError(err, "Failed to update conversation metadata"),
          { model: selectedModel, conversation_id: conversationId, source: "conversation" },
        );
      }

      trackServerEvent(this.env, userId, "chat_completion", {
        model: selectedModel,
        conversation_id: conversationId,
        tool_calls_count: toolCalls.length,
        response_length: fullContent.length,
      });

      try {
        const usage = await result.usage;
        if (usage.inputTokens != null && usage.outputTokens != null) {
          trackInferenceCost(this.env, userId, {
            model: selectedModel,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens ?? usage.inputTokens + usage.outputTokens,
            conversationId,
          });
        }
      } catch (err) {
        captureServerException(this.env, userId, toError(err, "Failed to track usage"), {
          model: selectedModel,
          conversation_id: conversationId,
          source: "usage_tracking",
        });
      }

      stream.end({ messageId: assistantMessageId, subscription });
    } catch (err) {
      const error = toError(err, "Stream failed");
      const failureType =
        responseCompleted && fullContent.trim().length > 0 && !assistantMessagePersisted
          ? "save_failed"
          : getFailureType(error);
      if (!responseCompleted || error instanceof EmptyAssistantResponseError) {
        await releaseUsageReservation();
      }
      captureServerException(this.env, userId, error, {
        model: selectedModel,
        conversation_id: conversationId,
        failure_type: failureType,
      });
      stream.end({
        error:
          failureType === "save_failed"
            ? "The response was generated, but we couldn't save it. Please try again."
            : getClientErrorMessage(error),
        failureType,
        discardOptimistic: !userMessagePersisted,
        subscription,
      });
    }
  }
}

// Apply callable metadata manually — decorator syntax isn't supported by the CF vite plugin bundler
const proto = ChatAgent.prototype;
callable()(proto.createConversation, {
  kind: "method",
  name: "createConversation",
} as ClassMethodDecoratorContext);
callable()(proto.listConversations, {
  kind: "method",
  name: "listConversations",
} as ClassMethodDecoratorContext);
callable()(proto.getConversation, {
  kind: "method",
  name: "getConversation",
} as ClassMethodDecoratorContext);
callable()(proto.deleteConversation, {
  kind: "method",
  name: "deleteConversation",
} as ClassMethodDecoratorContext);
callable()(proto.updateConversationTitle, {
  kind: "method",
  name: "updateConversationTitle",
} as ClassMethodDecoratorContext);
callable()(proto.listMemories, {
  kind: "method",
  name: "listMemories",
} as ClassMethodDecoratorContext);
callable()(proto.deleteMemory, {
  kind: "method",
  name: "deleteMemory",
} as ClassMethodDecoratorContext);
callable()(proto.getPetState, {
  kind: "method",
  name: "getPetState",
} as ClassMethodDecoratorContext);
callable()(proto.feedPet, {
  kind: "method",
  name: "feedPet",
} as ClassMethodDecoratorContext);
callable()(proto.playWithPet, {
  kind: "method",
  name: "playWithPet",
} as ClassMethodDecoratorContext);
callable()(proto.petTheDog, {
  kind: "method",
  name: "petTheDog",
} as ClassMethodDecoratorContext);
callable({ streaming: true })(proto.sendMessage, {
  kind: "method",
  name: "sendMessage",
} as ClassMethodDecoratorContext);
