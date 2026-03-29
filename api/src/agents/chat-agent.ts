import { Agent, callable, type StreamingResponse } from "agents";
import { streamText, stepCountIs } from "ai";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { getModel, MODELS, DEFAULT_MODEL } from "../lib/models";
import type { ModelId } from "../lib/models";
import { createTools } from "../lib/tools";
import {
  buildSubscriptionSnapshot,
  decrementDailyMessageUsage,
  getSubscriptionSnapshot,
  getUsageDate,
  tryIncrementDailyMessageUsage,
} from "../lib/plans";

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
    // Migration: add tool_calls column for existing DOs
    try {
      this.sql`ALTER TABLE messages ADD COLUMN tool_calls TEXT`;
    } catch {
      // Column already exists — ignore
    }
  }

  @callable()
  createConversation(title: string, model?: string): Conversation {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const selectedModel = model && model in MODELS ? model : DEFAULT_MODEL;

    this.sql`
      INSERT INTO conversations (id, title, model, created_at, updated_at)
      VALUES (${id}, ${title}, ${selectedModel}, ${now}, ${now})
    `;

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
  deleteConversation(conversationId: string): void {
    this.sql`DELETE FROM messages WHERE conversation_id = ${conversationId}`;
    this.sql`DELETE FROM conversations WHERE id = ${conversationId}`;
  }

  @callable()
  updateConversationTitle(conversationId: string, title: string): void {
    const now = Math.floor(Date.now() / 1000);
    this.sql`
      UPDATE conversations SET title = ${title}, updated_at = ${now}
      WHERE id = ${conversationId}
    `;
  }

  @callable({ streaming: true })
  async sendMessage(
    stream: StreamingResponse,
    conversationId: string,
    content: string,
    model?: string,
  ) {
    const db = drizzle(this.env.DB, { schema });
    const userId = this.name;

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
    const usageDate = getUsageDate();
    let subscription = await getSubscriptionSnapshot(db, userId);
    let usageReserved = false;

    if (subscription.plan === "free") {
      if (subscription.usage.limitReached) {
        stream.end({ blocked: true, reason: "daily_limit", subscription });
        return;
      }

      const usedCount = await tryIncrementDailyMessageUsage(this.env.DB, userId, usageDate);
      if (usedCount === null) {
        subscription = await getSubscriptionSnapshot(db, userId);
        stream.end({ blocked: true, reason: "daily_limit", subscription });
        return;
      }

      usageReserved = true;
      subscription = buildSubscriptionSnapshot("free", usedCount);
    }

    const aiModel = getModel(this.env, selectedModel, {
      sessionAffinity: conversationId,
    });

    const tools = createTools(this.env);

    // Stream AI response
    let fullContent = "";
    const toolCalls: { id: string; name: string; args: unknown; result: unknown }[] = [];
    const assistantMessageId = crypto.randomUUID();

    try {
      this.sql`
        INSERT INTO messages (id, conversation_id, role, content, created_at)
        VALUES (${userMessageId}, ${conversationId}, ${"user"}, ${content}, ${now})
      `;

      this.sql`UPDATE conversations SET updated_at = ${now} WHERE id = ${conversationId}`;

      const history = this.sql<{ role: string; content: string }>`
        SELECT role, content FROM messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at ASC
      `;

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
      }

      stream.end({ messageId: assistantMessageId, subscription });
    } catch (err) {
      if (usageReserved) {
        await decrementDailyMessageUsage(this.env.DB, userId, usageDate);
      }
      stream.error(err instanceof Error ? err.message : "Stream failed");
    }
  }
}
