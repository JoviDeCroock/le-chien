import { Agent, callable, type StreamingResponse } from "agents";
import { streamText, stepCountIs } from "ai";
import { getModel, MODELS, DEFAULT_MODEL } from "../lib/models";
import type { ModelId } from "../lib/models";
import { createTools } from "../lib/tools";
import {
  deleteIndexedConversation,
  upsertIndexedConversation,
  type ConversationIndexRecord,
} from "../lib/conversation-index";

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

type PendingConversationIndexSync = {
  conversation_id: string;
  operation: "upsert" | "delete";
  attempts: number;
  next_retry_at: number;
  last_error: string | null;
};

const CONVERSATION_INDEX_RETRY_BASE_MS = 5_000;
const CONVERSATION_INDEX_RETRY_MAX_MS = 5 * 60_000;

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
      CREATE TABLE IF NOT EXISTS conversation_index_sync_queue (
        conversation_id TEXT PRIMARY KEY,
        operation TEXT NOT NULL CHECK(operation IN ('upsert', 'delete')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at INTEGER NOT NULL,
        last_error TEXT
      )
    `;
    this.sql`
      CREATE INDEX IF NOT EXISTS idx_conversation_index_sync_queue_retry
      ON conversation_index_sync_queue(next_retry_at)
    `;

    // Migration: add tool_calls column for existing DOs
    try {
      this.sql`ALTER TABLE messages ADD COLUMN tool_calls TEXT`;
    } catch {
      // Column already exists — ignore
    }
  }

  private get userId(): string {
    return this.name;
  }

  private getRetryDelayMs(attempts: number): number {
    return Math.min(
      CONVERSATION_INDEX_RETRY_BASE_MS * 2 ** Math.max(attempts - 1, 0),
      CONVERSATION_INDEX_RETRY_MAX_MS,
    );
  }

  private getConversationIndexRecord(conversationId: string): ConversationIndexRecord | null {
    const conversations = this.sql<Conversation>`
      SELECT id, title, model, created_at, updated_at
      FROM conversations
      WHERE id = ${conversationId}
    `;

    if (conversations.length === 0) {
      return null;
    }

    const conversation = conversations[0];
    return {
      id: conversation.id,
      userId: this.userId,
      title: conversation.title,
      model: conversation.model,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
    };
  }

  private async clearPendingConversationIndexSync(conversationId: string) {
    this.sql`
      DELETE FROM conversation_index_sync_queue
      WHERE conversation_id = ${conversationId}
    `;
  }

  private async scheduleConversationIndexRetry(nextRetryAt: number) {
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm === null || nextRetryAt < currentAlarm) {
      await this.ctx.storage.setAlarm(nextRetryAt);
    }
  }

  private async rescheduleConversationIndexRetry() {
    const rows = this.sql<{ next_retry_at: number | null }>`
      SELECT MIN(next_retry_at) AS next_retry_at
      FROM conversation_index_sync_queue
    `;
    const nextRetryAt = rows[0]?.next_retry_at;

    if (typeof nextRetryAt === "number") {
      await this.ctx.storage.setAlarm(nextRetryAt);
      return;
    }

    await this.ctx.storage.deleteAlarm();
  }

  private async enqueueConversationIndexSync(
    conversationId: string,
    operation: PendingConversationIndexSync["operation"],
    error: unknown,
    attemptsOverride?: number,
  ) {
    const existing = this.sql<PendingConversationIndexSync>`
      SELECT conversation_id, operation, attempts, next_retry_at, last_error
      FROM conversation_index_sync_queue
      WHERE conversation_id = ${conversationId}
    `[0];
    const attempts =
      attemptsOverride ?? (existing?.operation === operation ? existing.attempts + 1 : 1);
    const nextRetryAt = Date.now() + this.getRetryDelayMs(attempts);
    const lastError =
      error instanceof Error ? error.message : String(error ?? "Unknown sync error");

    this.sql`
      INSERT INTO conversation_index_sync_queue (
        conversation_id,
        operation,
        attempts,
        next_retry_at,
        last_error
      )
      VALUES (${conversationId}, ${operation}, ${attempts}, ${nextRetryAt}, ${lastError})
      ON CONFLICT(conversation_id) DO UPDATE SET
        operation = excluded.operation,
        attempts = excluded.attempts,
        next_retry_at = excluded.next_retry_at,
        last_error = excluded.last_error
    `;

    await this.scheduleConversationIndexRetry(nextRetryAt);
  }

  private async syncConversationIndex(
    conversationId: string,
    operation: PendingConversationIndexSync["operation"],
  ) {
    if (operation === "delete") {
      await deleteIndexedConversation(this.env, this.userId, conversationId);
      await this.clearPendingConversationIndexSync(conversationId);
      return;
    }

    const conversation = this.getConversationIndexRecord(conversationId);

    if (!conversation) {
      await deleteIndexedConversation(this.env, this.userId, conversationId);
      await this.clearPendingConversationIndexSync(conversationId);
      return;
    }

    await upsertIndexedConversation(this.env, conversation);
    await this.clearPendingConversationIndexSync(conversationId);
  }

  private async syncConversationIndexSafely(
    conversationId: string,
    operation: PendingConversationIndexSync["operation"],
  ) {
    try {
      await this.syncConversationIndex(conversationId, operation);
    } catch (error) {
      console.error("Conversation index sync failed", {
        userId: this.userId,
        conversationId,
        operation,
        error,
      });
      await this.enqueueConversationIndexSync(conversationId, operation, error);
    }
  }

  private async retryPendingConversationIndexSyncs() {
    const dueJobs = this.sql<PendingConversationIndexSync>`
      SELECT conversation_id, operation, attempts, next_retry_at, last_error
      FROM conversation_index_sync_queue
      WHERE next_retry_at <= ${Date.now()}
      ORDER BY next_retry_at ASC
    `;

    for (const job of dueJobs) {
      try {
        await this.syncConversationIndex(job.conversation_id, job.operation);
      } catch (error) {
        console.error("Conversation index retry failed", {
          userId: this.userId,
          conversationId: job.conversation_id,
          operation: job.operation,
          attempts: job.attempts + 1,
          error,
        });
        await this.enqueueConversationIndexSync(
          job.conversation_id,
          job.operation,
          error,
          job.attempts + 1,
        );
      }
    }

    await this.rescheduleConversationIndexRetry();
  }

  async alarm() {
    await super.alarm();
    await this.retryPendingConversationIndexSyncs();
  }

  @callable()
  async createConversation(title: string, model?: string): Promise<Conversation> {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const selectedModel = model && model in MODELS ? model : DEFAULT_MODEL;

    this.sql`
      INSERT INTO conversations (id, title, model, created_at, updated_at)
      VALUES (${id}, ${title}, ${selectedModel}, ${now}, ${now})
    `;

    await this.syncConversationIndexSafely(id, "upsert");

    return { id, title, model: selectedModel, created_at: now, updated_at: now };
  }

  @callable()
  listConversations(): Conversation[] {
    return this.sql<Conversation>`
      SELECT id, title, model, created_at, updated_at
      FROM conversations
      ORDER BY updated_at DESC
    `;
  }

  @callable()
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

  @callable()
  async deleteConversation(conversationId: string): Promise<void> {
    this.sql`DELETE FROM messages WHERE conversation_id = ${conversationId}`;
    this.sql`DELETE FROM conversations WHERE id = ${conversationId}`;
    await this.syncConversationIndexSafely(conversationId, "delete");
  }

  @callable()
  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    this.sql`
      UPDATE conversations SET title = ${title}, updated_at = ${now}
      WHERE id = ${conversationId}
    `;
    await this.syncConversationIndexSafely(conversationId, "upsert");
  }

  @callable({ streaming: true })
  async sendMessage(
    stream: StreamingResponse,
    conversationId: string,
    content: string,
    model?: string,
  ) {
    // Verify conversation exists
    const conversations = this.sql<Conversation>`
      SELECT id, model FROM conversations WHERE id = ${conversationId}
    `;
    if (conversations.length === 0) {
      stream.error("Conversation not found");
      return;
    }

    const conversation = conversations[0];
    const selectedModel = (model ?? conversation.model) as ModelId;
    const userMessageId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Save user message
    this.sql`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (${userMessageId}, ${conversationId}, ${"user"}, ${content}, ${now})
    `;

    // Update conversation timestamp
    this.sql`UPDATE conversations SET updated_at = ${now} WHERE id = ${conversationId}`;
    await this.syncConversationIndexSafely(conversationId, "upsert");

    // Load conversation history for context
    const history = this.sql<{ role: string; content: string }>`
      SELECT role, content FROM messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `;

    const aiModel = getModel(this.env, selectedModel, {
      sessionAffinity: conversationId,
    });

    const tools = createTools(this.env);

    // Stream AI response
    let fullContent = "";
    const toolCalls: { id: string; name: string; args: unknown; result: unknown }[] = [];
    const assistantMessageId = crypto.randomUUID();

    try {
      const result = streamText({
        model: aiModel,
        system:
          "You are a helpful AI assistant called le chien. Be concise and clear in your responses. You have access to tools — use them when they would help answer the user's question accurately. For math, use the calculate tool rather than computing in your head. For questions about current dates/times, use get_current_datetime. For web content, use read_url.",
        messages: history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        tools,
        stopWhen: stepCountIs(5),
      });

      for await (const part of result.fullStream) {
        switch (part.type) {
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

      // Save assistant message with tool call metadata
      const finishedAt = Math.floor(Date.now() / 1000);
      const toolCallsJson = toolCalls.length > 0 ? JSON.stringify(toolCalls) : null;
      this.sql`
        INSERT INTO messages (id, conversation_id, role, content, tool_calls, created_at)
        VALUES (${assistantMessageId}, ${conversationId}, ${"assistant"}, ${fullContent}, ${toolCallsJson}, ${finishedAt})
      `;

      // Auto-title: if this is the first exchange, generate a title from user message
      const messageCount = this.sql<{ count: number }>`
        SELECT COUNT(*) as count FROM messages WHERE conversation_id = ${conversationId}
      `;
      if (messageCount[0].count <= 2) {
        const title = content.length > 50 ? content.slice(0, 47) + "..." : content;
        this
          .sql`UPDATE conversations SET title = ${title}, updated_at = ${finishedAt} WHERE id = ${conversationId}`;
        await this.syncConversationIndexSafely(conversationId, "upsert");
      }

      stream.end({ messageId: assistantMessageId });
    } catch (err) {
      stream.error(err instanceof Error ? err.message : "Stream failed");
    }
  }
}
