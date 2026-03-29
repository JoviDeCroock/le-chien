import { Hono } from "hono";
import { streamText } from "ai";
import { z } from "zod/v4";
import { getModel, MODELS, DEFAULT_MODEL, listModels } from "../lib/models";
import type { ModelId } from "../lib/models";
import type { Bindings, Variables } from "../types";

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  model: z.string().optional(),
});

export const chatRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

chatRoutes.get("/models", (c) => {
  return c.json({ models: listModels(), default: DEFAULT_MODEL });
});

chatRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: z.prettifyError(parsed.error) }, 400);
  }

  const { messages, model: modelId } = parsed.data;
  const selectedModel: ModelId =
    modelId && modelId in MODELS ? (modelId as ModelId) : DEFAULT_MODEL;

  const model = getModel(c.env, selectedModel);

  const result = streamText({
    model,
    messages,
    system: "You are a helpful AI assistant. Be concise and clear in your responses.",
  });

  return result.toTextStreamResponse();
});
