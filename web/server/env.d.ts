/**
 * Secrets set via `wrangler secret put` that aren't included
 * in the auto-generated worker-configuration.d.ts.
 */
declare namespace Cloudflare {
  interface Env {
    BETTER_AUTH_SECRET: string;
    /** "true" to enable Polar billing and rate limits; anything else disables. */
    BILLING_ENABLED?: string;
    POLAR_ACCESS_TOKEN?: string;
    POLAR_WEBHOOK_SECRET?: string;
    POLAR_PRO_PRODUCT_ID?: string;
    OPENAI_API_KEY: string;
    CF_API_TOKEN: string;
    CF_ACCOUNT_ID: string;
    POSTHOG_API_KEY?: string;
    POSTHOG_HOST?: string;
    TAVILY_API_KEY?: string;
    LOADER: WorkerLoader;
    ARTIFACT_SESSION: DurableObjectNamespace<import("./index").ArtifactSession>;
  }
}

interface WorkerStub {
  getDurableObjectClass(name: string): DurableObjectClass;
}

interface DurableObjectFacetStartupOptions {
  class: DurableObjectClass;
  id?: DurableObjectId | string;
}

interface DurableObjectFacets {
  get(
    name: string,
    getStartupOptions: () =>
      | DurableObjectFacetStartupOptions
      | Promise<DurableObjectFacetStartupOptions>,
  ): Fetcher;
  abort(name: string, reason?: unknown): void;
  delete(name: string): void;
}

interface DurableObjectState<Props = unknown> {
  readonly facets: DurableObjectFacets;
}
