import { Polar } from "@polar-sh/sdk";
import { isProduction } from "../utils/isProduction";
import type { ModelId } from "./models";

type Env = Cloudflare.Env;

/**
 * Per-million-token pricing from Cloudflare Workers AI.
 * @see https://developers.cloudflare.com/workers-ai/models/
 */
const MODEL_PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  "glm-4.7-flash": { inputPerM: 0.06, outputPerM: 0.4 },
  "llama-4-scout": { inputPerM: 0.27, outputPerM: 0.85 },
  "gemma-4-26b": { inputPerM: 0.1, outputPerM: 0.3 },
  "gpt-oss-120b": { inputPerM: 0.35, outputPerM: 0.75 },
  "nemotron-3-120b": { inputPerM: 0.5, outputPerM: 1.5 },
  "kimi-k2.5": { inputPerM: 0.6, outputPerM: 3.0 },
};

/** Returns estimated cost in USD, or null if pricing is unknown. */
export function estimateCost(
  model: ModelId,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;
  return (
    (inputTokens / 1_000_000) * pricing.inputPerM + (outputTokens / 1_000_000) * pricing.outputPerM
  );
}

/**
 * Sends an LLM inference cost event to Polar for cost-insights tracking.
 * Fire-and-forget — errors are logged but never block the response.
 */
export async function trackInferenceCost(
  env: Env,
  userId: string,
  opts: {
    model: ModelId;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    conversationId: string;
  },
) {
  try {
    const polar = new Polar({
      accessToken: env.POLAR_ACCESS_TOKEN,
      server: isProduction(env) ? "production" : "sandbox",
    });

    const costUsd = estimateCost(opts.model, opts.inputTokens, opts.outputTokens);

    await polar.events.ingest({
      events: [
        {
          name: "llm.inference",
          externalCustomerId: userId,
          metadata: {
            _llm: {
              vendor: "cloudflare",
              model: opts.model,
              inputTokens: opts.inputTokens,
              outputTokens: opts.outputTokens,
              totalTokens: opts.totalTokens,
            },
            conversation_id: opts.conversationId,
            ...(costUsd != null && { cost_usd: costUsd }),
          },
        },
      ],
    });
  } catch (err) {
    console.error("Failed to send Polar cost event:", err);
  }
}
