import { DurableObject } from "cloudflare:workers";
import {
  renderDynamicArtifact,
  type ArtifactNode,
  type ArtifactRenderInput,
} from "../lib/dynamic-workers";

type ArtifactSessionRenderRequest = {
  userId: string;
  artifactId: string;
  code: string;
  event?: ArtifactRenderInput["event"];
};

type ArtifactSessionState = {
  artifactId: string;
  ownerUserId: string;
  codeHash: string;
  state: unknown[];
  version: number;
  createdAt: number;
  updatedAt: number;
};

export type ArtifactSessionRenderResponse = {
  tree?: ArtifactNode;
  version?: number;
  error?: string;
};

const STORAGE_KEY = "session";
const ARTIFACT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ARTIFACT_ID_CHARS = 160;
const MAX_CODE_CHARS = 24_000;
const MAX_EVENT_ID_CHARS = 120;
const MAX_EVENT_VALUE_CHARS = 2_000;
const ALLOWED_EVENT_TYPES = new Set(["click", "input", "change", "submit"]);

function json(body: ArtifactSessionRenderResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidEvent(value: unknown): value is ArtifactRenderInput["event"] {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== "string" || value.id.length === 0) return false;
  if (value.id.length > MAX_EVENT_ID_CHARS) return false;
  if (typeof value.type !== "string" || !ALLOWED_EVENT_TYPES.has(value.type)) return false;
  if (value.value !== undefined) {
    if (typeof value.value !== "string" || value.value.length > MAX_EVENT_VALUE_CHARS) {
      return false;
    }
  }
  if (value.checked !== undefined && typeof value.checked !== "boolean") return false;
  return true;
}

function parseRenderRequest(value: unknown): ArtifactSessionRenderRequest | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.userId !== "string" || value.userId.length === 0) return null;
  if (typeof value.artifactId !== "string" || value.artifactId.length === 0) return null;
  if (value.artifactId.length > MAX_ARTIFACT_ID_CHARS) return null;
  if (
    typeof value.code !== "string" ||
    value.code.length === 0 ||
    value.code.length > MAX_CODE_CHARS
  ) {
    return null;
  }
  if (value.event !== undefined && !isValidEvent(value.event)) return null;

  return {
    userId: value.userId,
    artifactId: value.artifactId,
    code: value.code,
    event: value.event,
  };
}

async function hashCode(code: string) {
  const encoded = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class ArtifactSession extends DurableObject<Cloudflare.Env> {
  private queue: Promise<void> = Promise.resolve();

  async fetch(request: Request) {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const input = parseRenderRequest(await request.json().catch(() => null));
    if (!input) {
      return json({ error: "Invalid artifact session request" }, 400);
    }

    return this.enqueue(() => this.render(input));
  }

  async alarm() {
    const session = await this.ctx.storage.get<ArtifactSessionState>(STORAGE_KEY);
    if (!session) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    const expiresAt = session.updatedAt + ARTIFACT_SESSION_TTL_MS;
    if (expiresAt <= Date.now()) {
      await this.ctx.storage.deleteAll();
      return;
    }

    await this.ctx.storage.setAlarm(expiresAt);
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.then(
      () => {},
      () => {},
    );
    return next;
  }

  private async render(input: ArtifactSessionRenderRequest) {
    const now = Date.now();
    const codeHash = await hashCode(input.code);
    const existing = await this.ctx.storage.get<ArtifactSessionState>(STORAGE_KEY);

    if (existing && existing.ownerUserId !== input.userId) {
      return json({ error: "Artifact session belongs to another user" }, 403);
    }

    const codeChanged = existing?.codeHash !== codeHash;
    const baseSession: ArtifactSessionState = {
      artifactId: input.artifactId,
      ownerUserId: input.userId,
      codeHash,
      state: codeChanged ? [] : (existing?.state ?? []),
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const result = await renderDynamicArtifact(this.env, {
      code: input.code,
      state: baseSession.state,
      event: codeChanged ? undefined : input.event,
    });

    const nextSession: ArtifactSessionState = {
      ...baseSession,
      state: result.error ? baseSession.state : (result.state ?? []),
    };

    await this.ctx.storage.put(STORAGE_KEY, nextSession);
    await this.ctx.storage.setAlarm(now + ARTIFACT_SESSION_TTL_MS);

    if (result.error) {
      return json({ error: result.error, version: nextSession.version }, 400);
    }

    return json({ tree: result.tree ?? "", version: nextSession.version });
  }
}
