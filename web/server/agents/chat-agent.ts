import { Agent, callable, type StreamingResponse } from "agents";
import { streamText, stepCountIs } from "ai";
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
import { trackServerEvent, captureServerException } from "../lib/posthog";
import { trackInferenceCost } from "../lib/polar-events";
import { isProduction } from "../utils/isProduction";

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

/**
 * Rough token estimate: ~4 characters per token.
 * Budget leaves room for system prompt + response.
 */
const MAX_HISTORY_CHARS = 48_000; // ~12k tokens

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
    enabledExtras?: string[],
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

    const isPremium = isPremiumModel(selectedModel);
    let premiumUsageReserved = false;
    const enforceRateLimits = isProduction(this.env);

    if (enforceRateLimits && subscription.plan === "free") {
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
        subscription = await getSubscriptionSnapshot(db, userId);
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
          // Roll back the general message increment
          await decrementDailyMessageUsage(this.env.DB, userId, usageDate);
          usageReserved = false;
          subscription = await getSubscriptionSnapshot(db, userId);
          stream.end({ blocked: true, reason: "premium_limit", subscription });
          return;
        }
        premiumUsageReserved = true;
        subscription = buildSubscriptionSnapshot("free", usedCount, undefined, premiumUsedCount);
      } else {
        subscription = buildSubscriptionSnapshot("free", usedCount);
      }
    }

    const extras = new Set(enabledExtras ?? []);

    const aiModel = getModel(this.env, selectedModel, {
      sessionAffinity: conversationId,
    });

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
- Proactively use save_memory when the person shares something worth remembering: their name, role, preferences, projects, tech stack, goals, or any context they'd expect you to know next time. Don't save throwaway details or things only relevant to the current question. Before saving, check the existing memories listed below — if a memory with the same topic already exists, update it instead of creating a duplicate. Never save two memories about the same thing.`;

      if (memories.length > 0) {
        const memoryBlock = memories.map((m) => `- ${m.key}: ${m.value}`).join("\n");
        systemPrompt += `\n\nStuff you know about this person — use it when it's relevant, ignore it when it's not:\n${memoryBlock}`;
      }

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

      trackServerEvent(this.env, userId, "chat_completion", {
        model: selectedModel,
        conversation_id: conversationId,
        tool_calls_count: toolCalls.length,
        response_length: fullContent.length,
      });

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

      stream.end({ messageId: assistantMessageId, subscription });
    } catch (err) {
      if (usageReserved) {
        await decrementDailyMessageUsage(this.env.DB, userId, usageDate);
      }
      if (premiumUsageReserved) {
        await decrementDailyPremiumMessageUsage(this.env.DB, userId, usageDate);
      }
      captureServerException(
        this.env,
        userId,
        err instanceof Error ? err : new Error("Stream failed"),
        { model: selectedModel, conversation_id: conversationId },
      );
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
callable()(proto.deleteMemory, {
  kind: "method",
  name: "deleteMemory",
} as ClassMethodDecoratorContext);
callable({ streaming: true })(proto.sendMessage, {
  kind: "method",
  name: "sendMessage",
} as ClassMethodDecoratorContext);
