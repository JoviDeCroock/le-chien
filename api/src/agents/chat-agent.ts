import { Agent, callable, type StreamingResponse } from "agents";
import { streamText } from "ai";
import { getModel, MODELS, DEFAULT_MODEL } from "../lib/models";
import type { ModelId } from "../lib/models";

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
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `;
    this.sql`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, created_at)
    `;
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
      SELECT id, conversation_id, role, content, created_at
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

    // Load conversation history for context
    const history = this.sql<{ role: string; content: string }>`
      SELECT role, content FROM messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `;

    const aiModel = getModel(this.env, selectedModel);

    // Stream AI response
    let fullContent = "";
    const assistantMessageId = crypto.randomUUID();

    try {
      const result = streamText({
        model: aiModel,
        system: "You are a helpful AI assistant. Be concise and clear in your responses.",
        messages: history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });

      for await (const chunk of result.textStream) {
        fullContent += chunk;
        stream.send(chunk);
      }

      // Save assistant message
      const finishedAt = Math.floor(Date.now() / 1000);
      this.sql`
        INSERT INTO messages (id, conversation_id, role, content, created_at)
        VALUES (${assistantMessageId}, ${conversationId}, ${"assistant"}, ${fullContent}, ${finishedAt})
      `;

      // Auto-title: if this is the first exchange, generate a title from user message
      const messageCount = this.sql<{ count: number }>`
        SELECT COUNT(*) as count FROM messages WHERE conversation_id = ${conversationId}
      `;
      if (messageCount[0].count <= 2) {
        const title = content.length > 50 ? content.slice(0, 47) + "..." : content;
        this.sql`UPDATE conversations SET title = ${title}, updated_at = ${finishedAt} WHERE id = ${conversationId}`;
      }

      stream.end({ messageId: assistantMessageId });
    } catch (err) {
      stream.error(err instanceof Error ? err.message : "Stream failed");
    }
  }
}
