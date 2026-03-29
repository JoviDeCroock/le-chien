/**
 * Secrets set via `wrangler secret put` that aren't included
 * in the auto-generated worker-configuration.d.ts.
 */
declare namespace Cloudflare {
  interface Env {
    BETTER_AUTH_SECRET: string;
    POLAR_ACCESS_TOKEN: string;
    POLAR_WEBHOOK_SECRET: string;
    POLAR_PRO_PRODUCT_ID: string;
    OPENAI_API_KEY: string;
    CF_ACCOUNT_ID: string;
    CF_AI_GATEWAY_ID: string;
  }
}
