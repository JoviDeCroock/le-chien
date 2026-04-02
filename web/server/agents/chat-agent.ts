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

type Memory = {
  id: string;
  key: string;
  value: string;
  created_at: number;
  updated_at: number;
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
    this.sql`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `;
    // Migration: add tool_calls column for existing DOs
    try {
      this.sql`ALTER TABLE messages ADD COLUMN tool_calls TEXT`;
    } catch {
      // Column already exists — ignore
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

    return { id, title, model: selectedModel, created_at: now, updated_at: now };
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
  }

  updateConversationTitle(conversationId: string, title: string): void {
    const now = Math.floor(Date.now() / 1000);
    this.sql`
      UPDATE conversations SET title = ${title}, updated_at = ${now}
      WHERE id = ${conversationId}
    `;
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

    const tools = createTools(this.env, {
      onSaveMemory: (key, value) => this.createMemory(key, value),
    });

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

      // Load user memories for context
      const memories = this.sql<{ key: string; value: string }>`
        SELECT key, value FROM memories ORDER BY updated_at DESC
      `;
      let systemPrompt = `You are le chien — a sharp, warm conversationalist who happens to know a lot.

Talk like a knowledgeable friend, not a service desk. Use natural language: contractions, occasional humor, and real opinions when asked. Match the user's energy — if they're casual, be casual; if they're deep in a problem, focus up.

Keep things concise but never robotic. A short answer can still have personality. Don't hedge everything with "I think" or "it's worth noting" — just say the thing.

Format your answers in markdown — use headings, lists, code blocks, and emphasis where they improve readability.

When something is genuinely interesting, show that. When you don't know, say so plainly instead of generating plausible-sounding filler.

You have tools available. Use the calculate tool for math instead of computing in your head. Use get_current_datetime for date/time questions. Use read_url to fetch web content. Reach for tools when they'd give a better answer — don't announce that you're using them unless it's relevant.`;

      if (memories.length > 0) {
        const memoryBlock = memories.map((m) => `- ${m.key}: ${m.value}`).join("\n");
        systemPrompt += `\n\nYou have the following memories about this user. Use them to personalize your responses when relevant:\n${memoryBlock}`;
      }

      const result = streamText({
        model: aiModel,
        system: systemPrompt,
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
callable()(proto.createMemory, {
  kind: "method",
  name: "createMemory",
} as ClassMethodDecoratorContext);
callable()(proto.updateMemory, {
  kind: "method",
  name: "updateMemory",
} as ClassMethodDecoratorContext);
callable()(proto.deleteMemory, {
  kind: "method",
  name: "deleteMemory",
} as ClassMethodDecoratorContext);
callable({ streaming: true })(proto.sendMessage, {
  kind: "method",
  name: "sendMessage",
} as ClassMethodDecoratorContext);
