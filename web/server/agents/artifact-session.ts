import { DurableObject } from "cloudflare:workers";
import {
  ARTIFACT_FACET_EXPORT_NAME,
  loadDynamicArtifactWorker,
  prepareDynamicArtifactWorker,
  type ArtifactRenderInput,
  type ArtifactRenderResult,
} from "../lib/dynamic-workers";

type ArtifactSessionRequest = ArtifactRenderInput & {
  userId: string;
};

type ArtifactSessionMetadata = {
  artifactId: string;
  codeHash: string;
  componentName: string;
  createdAt: number;
  ownerUserId: string;
  updatedAt: number;
};

const FACET_NAME = "runtime";
const METADATA_KEY = "metadata";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function json(body: ArtifactRenderResult | { error: string }, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isArtifactSessionRequest(value: unknown): value is ArtifactSessionRequest {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<ArtifactSessionRequest>;
  return (
    typeof input.userId === "string" &&
    input.userId.length > 0 &&
    typeof input.artifactId === "string" &&
    input.artifactId.length > 0 &&
    typeof input.code === "string" &&
    input.code.length > 0
  );
}

async function readArtifactSessionRequest(request: Request) {
  const body = await request.json().catch(() => null);
  return isArtifactSessionRequest(body) ? body : null;
}

export class ArtifactSession extends DurableObject<Cloudflare.Env> {
  #queue: Promise<unknown> = Promise.resolve();

  fetch(request: Request): Promise<Response> {
    const run = this.#queue.then(() => this.render(request));
    this.#queue = run.catch(() => {});
    return run;
  }

  async alarm() {
    const metadata = this.ctx.storage.kv.get<ArtifactSessionMetadata>(METADATA_KEY);
    if (!metadata) return;

    const expiresAt = metadata.updatedAt + SESSION_TTL_MS;
    if (Date.now() < expiresAt) {
      await this.ctx.storage.setAlarm(expiresAt);
      return;
    }

    this.ctx.facets.delete(FACET_NAME);
    await this.ctx.storage.deleteAll();
  }

  private async render(request: Request): Promise<Response> {
    const input = await readArtifactSessionRequest(request);
    if (!input) return json({ error: "Invalid artifact session request" }, 400);

    let metadata = this.ctx.storage.kv.get<ArtifactSessionMetadata>(METADATA_KEY);
    if (metadata && metadata.ownerUserId !== input.userId) {
      return json({ error: "Artifact session owner mismatch" }, 403);
    }
    if (metadata && metadata.artifactId !== input.artifactId) {
      return json({ error: "Artifact session id mismatch" }, 409);
    }

    const prepared = await prepareDynamicArtifactWorker(input.code);
    if ("error" in prepared) return json(prepared, 400);

    const now = Date.now();
    const sourceChanged = !metadata || metadata.codeHash !== prepared.cacheId;
    if (sourceChanged && metadata) {
      this.ctx.facets.delete(FACET_NAME);
    }

    metadata = {
      artifactId: input.artifactId,
      codeHash: prepared.cacheId,
      componentName: prepared.componentName,
      createdAt: metadata?.createdAt ?? now,
      ownerUserId: metadata?.ownerUserId ?? input.userId,
      updatedAt: now,
    };
    this.ctx.storage.kv.put(METADATA_KEY, metadata);
    await this.ctx.storage.setAlarm(now + SESSION_TTL_MS);

    const worker = loadDynamicArtifactWorker(this.env, prepared);
    const artifactClass = worker.getDurableObjectClass(ARTIFACT_FACET_EXPORT_NAME);
    const facet = this.ctx.facets.get(FACET_NAME, () => ({ class: artifactClass }));

    const response = await facet.fetch("https://artifact.local/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: input.event }),
    });

    const body = (await response.json().catch(() => null)) as ArtifactRenderResult | null;
    if (!body) return json({ error: "Artifact facet returned invalid JSON" }, 502);
    if (!response.ok || body.error) {
      return json({ error: body.error ?? "Artifact facet render failed" }, response.status);
    }
    return json({ tree: body.tree ?? "" });
  }
}
