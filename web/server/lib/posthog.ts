import { PostHog } from "posthog-node";

let client: PostHog | null = null;

export function getPostHog(env: Cloudflare.Env): PostHog | null {
  if (!env.POSTHOG_API_KEY) return null;

  if (!client) {
    client = new PostHog(env.POSTHOG_API_KEY, {
      host: env.POSTHOG_HOST || "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return client;
}

export function trackServerEvent(
  env: Cloudflare.Env,
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  const ph = getPostHog(env);
  if (!ph) return;
  ph.capture({
    distinctId: userId,
    event,
    properties,
  });
}

export function captureServerException(
  env: Cloudflare.Env,
  userId: string,
  error: Error,
  context?: Record<string, unknown>,
) {
  const ph = getPostHog(env);
  if (!ph) return;
  ph.captureException(error, userId, context);
}

export async function shutdownPostHog() {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
