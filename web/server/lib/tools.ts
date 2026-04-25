import { tool } from "ai";
import { z } from "zod";
import { runDynamicJavaScript } from "./dynamic-workers";
import { readResponseTextWithLimit, safeFetchHttpUrl } from "./safe-url";
import type { Plan } from "./plans";
import {
  getUsageDate,
  tryIncrementDailyImageGenerationUsage,
  tryIncrementDailyWebSearchUsage,
} from "./plans";

type ToolOptions = {
  onSaveMemory?: (key: string, value: string) => void;
  onUpdateMemory?: (id: string, key: string, value: string) => void;
  existingMemories?: () => { id: string; key: string; value: string }[];
  /** When set, image generation is rate-limited for free users. */
  rateLimit?: {
    db: D1Database;
    userId: string;
    plan: Plan;
  };
  /** Which expensive tools the user has opted into for this message. */
  enabledExtras?: string[];
  /** When true, the image generation tool is excluded entirely. */
  imageGenerationLimitReached?: boolean;
  /** When true, the web search tool is excluded entirely. */
  webSearchLimitReached?: boolean;
};

export function createTools(env: Cloudflare.Env, options: ToolOptions = {}) {
  const extras = new Set(options.enabledExtras ?? []);

  return {
    get_current_datetime: tool({
      description: "Get the current date, time, and day of the week.",
      inputSchema: z.object({
        timezone: z
          .string()
          .optional()
          .describe("IANA timezone (e.g. 'America/New_York'). Defaults to UTC."),
      }),
      execute: async ({ timezone }) => {
        const tz = timezone || "UTC";
        const now = new Date();
        return {
          iso: now.toISOString(),
          formatted: now.toLocaleString("en-US", { timeZone: tz }),
          date: now.toLocaleDateString("en-US", { timeZone: tz }),
          time: now.toLocaleTimeString("en-US", { timeZone: tz }),
          day: now.toLocaleDateString("en-US", { timeZone: tz, weekday: "long" }),
          timezone: tz,
          unix: Math.floor(now.getTime() / 1000),
        };
      },
    }),

    calculate: tool({
      description:
        "Evaluate a mathematical expression. Supports arithmetic (+, -, *, /, %), exponents (**), parentheses, and functions (sqrt, abs, ceil, floor, round, sin, cos, tan, log, log2, log10, min, max, pow). Constants: PI, E.",
      inputSchema: z.object({
        expression: z
          .string()
          .describe("The mathematical expression to evaluate, e.g. '(2 + 3) * 4' or 'sqrt(144)'"),
      }),
      execute: async ({ expression }) => {
        try {
          const result = evaluateMath(expression);
          return { expression, result };
        } catch (e) {
          return { expression, error: e instanceof Error ? e.message : "Invalid expression" };
        }
      },
    }),

    ...(extras.has("generate_image") && !options.imageGenerationLimitReached
      ? {
          generate_image: tool({
            description:
              "Generate an image from a text description. Use this when the user asks you to create, draw, or generate an image, picture, or illustration.",
            inputSchema: z.object({
              prompt: z.string().describe("Detailed description of the image to generate"),
            }),
            execute: async ({ prompt }) => {
              try {
                // Enforce image generation limit for free users
                if (options.rateLimit?.plan === "free") {
                  const { db, userId } = options.rateLimit;
                  const usageDate = getUsageDate();
                  const count = await tryIncrementDailyImageGenerationUsage(db, userId, usageDate);
                  if (count === null) {
                    return {
                      prompt,
                      error:
                        "You've reached your daily image generation limit on the free plan. Upgrade to Pro for unlimited image generation.",
                    };
                  }
                }

                const result = await env.AI.run(
                  "@cf/black-forest-labs/flux-1-schnell",
                  { prompt },
                  { gateway: { id: env.CF_AI_GATEWAY_ID } },
                );
                if (!result.image) {
                  return { prompt, error: `Image generation failed` };
                }
                return { prompt, image: `data:image/png;base64,${result.image}` };
              } catch (e) {
                return {
                  prompt,
                  error: e instanceof Error ? e.message : "Image generation failed",
                };
              }
            },
          }),
        }
      : {}),

    run_javascript: tool({
      description:
        "Execute JavaScript code and return the result. Use this to run calculations, data transformations, string operations, or any JavaScript code the user asks about. The code runs in an isolated Dynamic Worker with outbound network access disabled.",
      inputSchema: z.object({
        code: z
          .string()
          .describe(
            "The JavaScript code to execute. Use an explicit return statement for the result.",
          ),
      }),
      execute: async ({ code }) => {
        const result = await runDynamicJavaScript(env, code);
        return { code, ...result };
      },
    }),

    ...(options.onSaveMemory
      ? {
          save_memory: tool({
            description:
              "Remember something about this person for future conversations. Use when they share a preference, something about themselves, or context they'd expect you to recall next time. Skip throwaway details. Check existing memories first to avoid duplicates — if a memory with the same key exists, update the value instead of creating a new one.",
            inputSchema: z.object({
              key: z
                .string()
                .describe("Short label for the memory (e.g. 'Preferred language', 'Role', 'Name')"),
              value: z
                .string()
                .describe("The information to remember (e.g. 'TypeScript', 'Frontend engineer')"),
            }),
            execute: async ({ key, value }) => {
              const existing = options.existingMemories?.();
              const duplicate = existing?.find((m) => m.key.toLowerCase() === key.toLowerCase());
              if (duplicate) {
                if (duplicate.value.toLowerCase() === value.toLowerCase()) {
                  return { saved: false, reason: "duplicate", key, value };
                }
                options.onUpdateMemory!(duplicate.id, key, value);
                return { saved: true, updated: true, key, value };
              }
              options.onSaveMemory!(key, value);
              return { saved: true, key, value };
            },
          }),
        }
      : {}),

    ...(extras.has("web_search") && env.TAVILY_API_KEY && !options.webSearchLimitReached
      ? {
          web_search: tool({
            description:
              "Search the web for current information. Use this for questions about recent events, products, people, or anything that benefits from up-to-date information.",
            inputSchema: z.object({
              query: z.string().describe("The search query"),
              count: z.number().optional().default(5).describe("Number of results (1-10)"),
            }),
            execute: async ({ query, count }) => {
              try {
                // Enforce web search limit for all plans
                if (options.rateLimit) {
                  const { db, userId, plan } = options.rateLimit;
                  const usageDate = getUsageDate();
                  const used = await tryIncrementDailyWebSearchUsage(db, userId, usageDate, plan);
                  if (used === null) {
                    return {
                      query,
                      error:
                        plan === "free"
                          ? "You've reached your daily web search limit on the free plan. Upgrade to Pro for more web searches."
                          : "You've reached your daily web search limit. Your limit resets at midnight UTC.",
                    };
                  }
                }

                const res = await fetch("https://api.tavily.com/search", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    api_key: env.TAVILY_API_KEY,
                    query,
                    max_results: Math.min(count, 10),
                    include_answer: true,
                  }),
                });
                if (!res.ok) return { query, error: `Tavily API error: HTTP ${res.status}` };
                const data = (await res.json()) as {
                  answer?: string;
                  results: { title: string; url: string; content: string }[];
                };
                return {
                  query,
                  answer: data.answer,
                  results: data.results.map((r) => ({
                    title: r.title,
                    url: r.url,
                    snippet: r.content,
                  })),
                };
              } catch (e) {
                return { query, error: e instanceof Error ? e.message : "Search failed" };
              }
            },
          }),
        }
      : {}),

    ...(extras.has("read_url")
      ? {
          read_url: tool({
            description:
              "Fetch and read the text content of a public web page. Returns extracted text with HTML tags stripped. Private, local, reserved, and non-http(s) URLs are rejected.",
            inputSchema: z.object({
              url: z.url().describe("The URL to fetch"),
            }),
            execute: async ({ url }) => {
              const maxLen = 12000;

              const truncate = (text: string) =>
                text.length > maxLen ? text.slice(0, maxLen) + "\n...[truncated]" : text;

              // -- Attempt 1: plain fetch --
              try {
                const { response: res, finalUrl } = await safeFetchHttpUrl(url, {
                  headers: {
                    "User-Agent": "le-chien/1.0",
                    Accept:
                      "text/html,application/xhtml+xml,text/plain,text/markdown,application/json",
                  },
                });

                if (res.ok) {
                  const contentType = res.headers.get("content-type") || "";
                  const raw = await readResponseTextWithLimit(res);
                  const text = contentType.includes("html") ? htmlToText(raw) : raw;
                  // If we got meaningful content, return it
                  if (text.trim().length > 100) {
                    return { url: finalUrl, content: truncate(text), length: text.length };
                  }
                }
                return { url: finalUrl, error: `Fetch returned HTTP ${res.status}` };
              } catch (e) {
                return {
                  url,
                  error: e instanceof Error ? e.message : "Fetch failed",
                };
              }
            },
          }),
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Safe math expression evaluator (no eval)
// ---------------------------------------------------------------------------

const MATH_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log,
  log2: Math.log2,
  log10: Math.log10,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
};

const MATH_CONSTANTS: Record<string, number> = {
  PI: Math.PI,
  E: Math.E,
};

type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma"; value: "," }
  | { type: "ident"; value: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < expr.length && /[0-9.eE]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push({ type: "number", value: Number(num) });
      if (Number.isNaN(Number(num))) throw new Error(`Invalid number: ${num}`);
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "/" || ch === "%") {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if (ch === "*") {
      if (expr[i + 1] === "*") {
        tokens.push({ type: "op", value: "**" });
        i += 2;
      } else {
        tokens.push({ type: "op", value: "*" });
        i++;
      }
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma", value: "," });
      i++;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let name = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        name += expr[i++];
      }
      tokens.push({ type: "ident", value: name });
      continue;
    }
    throw new Error(`Unexpected character: ${ch}`);
  }
  return tokens;
}

function evaluateMath(expr: string): number {
  const tokens = tokenize(expr);
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }
  function next(): Token {
    return tokens[pos++];
  }

  function parseExpression(): number {
    let left = parseTerm();
    while (peek()?.type === "op" && (peek()!.value === "+" || peek()!.value === "-")) {
      const op = (next() as { type: "op"; value: string }).value;
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseExponent();
    while (
      peek()?.type === "op" &&
      (peek()!.value === "*" || peek()!.value === "/" || peek()!.value === "%")
    ) {
      const op = (next() as { type: "op"; value: string }).value;
      const right = parseExponent();
      if (op === "*") left *= right;
      else if (op === "/") left /= right;
      else left %= right;
    }
    return left;
  }

  function parseExponent(): number {
    let base = parseUnary();
    while (peek()?.type === "op" && peek()!.value === "**") {
      next();
      const exp = parseUnary();
      base = base ** exp;
    }
    return base;
  }

  function parseUnary(): number {
    if (peek()?.type === "op" && (peek()!.value === "+" || peek()!.value === "-")) {
      const op = (next() as { type: "op"; value: string }).value;
      const val = parseUnary();
      return op === "-" ? -val : val;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const tok = peek();
    if (!tok) throw new Error("Unexpected end of expression");

    if (tok.type === "number") {
      next();
      return tok.value;
    }

    if (tok.type === "paren" && tok.value === "(") {
      next();
      const val = parseExpression();
      const closing = next();
      if (closing?.type !== "paren" || closing.value !== ")") {
        throw new Error("Missing closing parenthesis");
      }
      return val;
    }

    if (tok.type === "ident") {
      const name = tok.value;
      next();

      // Check for constant
      if (name in MATH_CONSTANTS && peek()?.type !== "paren") {
        return MATH_CONSTANTS[name];
      }

      // Must be a function call
      const fn = MATH_FUNCTIONS[name];
      if (!fn) throw new Error(`Unknown function or constant: ${name}`);

      const open = next();
      if (open?.type !== "paren" || open.value !== "(") {
        throw new Error(`Expected '(' after function ${name}`);
      }

      const fnArgs: number[] = [];
      if (peek()?.type !== "paren" || (peek() as { value: string }).value !== ")") {
        fnArgs.push(parseExpression());
        while (peek()?.type === "comma") {
          next();
          fnArgs.push(parseExpression());
        }
      }

      const close = next();
      if (close?.type !== "paren" || close.value !== ")") {
        throw new Error(`Missing closing ')' for function ${name}`);
      }

      return fn(...fnArgs);
    }

    throw new Error(`Unexpected token: ${JSON.stringify(tok)}`);
  }

  const result = parseExpression();
  if (pos < tokens.length) {
    throw new Error(`Unexpected token at position ${pos}: ${JSON.stringify(tokens[pos])}`);
  }
  return result;
}

function htmlToText(html: string): string {
  return (
    html
      // Remove noise elements: scripts, styles, nav, footer, header, aside, ads
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      // Convert structural elements to newlines
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr|article|section|blockquote)>/gi, "\n")
      // Strip remaining tags
      .replace(/<[^>]+>/g, " ")
      // Decode common entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/")
      // Normalize whitespace
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
