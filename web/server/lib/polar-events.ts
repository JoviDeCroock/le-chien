import { Polar } from "@polar-sh/sdk";
import { isProduction } from "../utils/isProduction";

type Env = Cloudflare.Env;

/**
 * Sends an LLM inference cost event to Polar for cost-insights tracking.
 * Fire-and-forget — errors are logged but never block the response.
 */
export async function trackInferenceCost(
  env: Env,
  userId: string,
  opts: {
    model: string;
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
          },
        },
      ],
    });
  } catch (err) {
    console.error("Failed to send Polar cost event:", err);
  }
}
