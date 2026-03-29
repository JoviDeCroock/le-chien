import { tool } from "ai";
import { z } from "zod";

export function createTools(_env: Cloudflare.Env) {
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

    read_url: tool({
      description:
        "Fetch and read the text content of a web page. Returns extracted text with HTML tags stripped. Useful for reading articles, docs, or any public URL.",
      inputSchema: z.object({
        url: z.url().describe("The URL to fetch"),
      }),
      execute: async ({ url }) => {
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent": "le-chien/1.0 (AI Assistant)",
              Accept: "text/html,application/xhtml+xml,text/plain,application/json",
            },
            redirect: "follow",
          });
          if (!res.ok) return { url, error: `HTTP ${res.status}: ${res.statusText}` };

          const contentType = res.headers.get("content-type") || "";
          const raw = await res.text();

          // If HTML, strip tags to get readable text
          const text = contentType.includes("html") ? htmlToText(raw) : raw;

          const maxLen = 12000;
          const truncated =
            text.length > maxLen ? text.slice(0, maxLen) + "\n...[truncated]" : text;
          return { url, content: truncated, length: text.length };
        } catch (e) {
          return { url, error: e instanceof Error ? e.message : "Failed to fetch URL" };
        }
      },
    }),
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
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
