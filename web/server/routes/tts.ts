import { Hono } from "hono";
import type { Bindings, Variables } from "../types";

export const ttsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_INPUT_CHARS = 4000;

/** Strip markdown formatting so the TTS model only speaks the prose. */
function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images → alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → label
    .replace(/^>+\s?/gm, "") // blockquotes
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^\s*[-*+]\s+/gm, "") // bullet markers
    .replace(/^\s*\d+\.\s+/gm, "") // ordered list markers
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/~~([^~]+)~~/g, "$1") // strikethrough
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

ttsRoutes.post("/", async (c) => {
  let body: { text?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return c.json({ error: "Missing text" }, 400);
  }

  const cleaned = stripMarkdown(body.text).slice(0, MAX_INPUT_CHARS);
  if (cleaned.length === 0) {
    return c.json({ error: "Nothing to read" }, 400);
  }

  try {
    const result = (await c.env.AI.run(
      "@cf/myshell-ai/melotts" as keyof AiModels,
      {
        prompt: cleaned,
      } as never,
    )) as { audio?: string };

    if (!result.audio) {
      return c.json({ error: "TTS model returned no audio" }, 502);
    }

    // The model returns base64-encoded MP3; decode to bytes and stream back.
    const binary = Uint8Array.from(atob(result.audio), (ch) => ch.charCodeAt(0));
    return new Response(binary as BodyInit, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("TTS synthesis failed:", err);
    return c.json({ error: "TTS synthesis failed" }, 500);
  }
});
