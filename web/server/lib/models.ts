import { createWorkersAI } from "workers-ai-provider";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type ModelId =
  | "glm-4.7-flash"
  | "kimi-k2.5"
  | "llama-4-scout"
  | "gpt-oss-20b"
  | "gpt-oss-120b"
  | "nemotron-3-120b"
  | "gpt-4.1"
  | "gpt-4.1-mini"
  | "gpt-4.1-nano"
  | "o3"
  | "o4-mini";

type WorkersAiModelSpec = {
  provider: "workers-ai";
  name: string;
  workersAiId: string;
  description: string;
};

type OpenAIModelSpec = {
  provider: "openai";
  name: string;
  openaiId: string;
  description: string;
};

type ModelSpec = WorkersAiModelSpec | OpenAIModelSpec;

/** Models exposed to users in the model picker. */
export const MODELS: Record<ModelId, ModelSpec> = {
  "glm-4.7-flash": {
    provider: "workers-ai",
    name: "GLM 4.7 Flash",
    workersAiId: "@cf/zai-org/glm-4.7-flash",
    description: "Fast and efficient general-purpose model",
  },
  "kimi-k2.5": {
    provider: "workers-ai",
    name: "Kimi K2.5",
    workersAiId: "@cf/moonshotai/kimi-k2.5",
    description: "Moonshot AI's latest conversational model",
  },
  "llama-4-scout": {
    provider: "workers-ai",
    name: "Llama 4 Scout",
    workersAiId: "@cf/meta/llama-4-scout-17b-16e-instruct",
    description: "Meta's instruction-tuned Llama 4",
  },
  "gpt-oss-20b": {
    provider: "workers-ai",
    name: "GPT-OSS 20B",
    workersAiId: "@cf/openai/gpt-oss-20b",
    description: "OpenAI's open-source 20B parameter model",
  },
  "gpt-oss-120b": {
    provider: "workers-ai",
    name: "GPT-OSS 120B",
    workersAiId: "@cf/openai/gpt-oss-120b",
    description: "OpenAI's open-source 120B parameter model",
  },
  "nemotron-3-120b": {
    provider: "workers-ai",
    name: "Nemotron 3 120B",
    workersAiId: "@cf/nvidia/nemotron-3-120b-a12b",
    description: "NVIDIA's 120B mixture-of-experts model",
  },
  "gpt-4.1": {
    provider: "openai",
    name: "GPT-4.1",
    openaiId: "gpt-4.1",
    description: "OpenAI's flagship model",
  },
  "gpt-4.1-mini": {
    provider: "openai",
    name: "GPT-4.1 Mini",
    openaiId: "gpt-4.1-mini",
    description: "Fast and cost-efficient OpenAI model",
  },
  "gpt-4.1-nano": {
    provider: "openai",
    name: "GPT-4.1 Nano",
    openaiId: "gpt-4.1-nano",
    description: "Fastest OpenAI model",
  },
  o3: {
    provider: "openai",
    name: "o3",
    openaiId: "o3",
    description: "OpenAI's reasoning model",
  },
  "o4-mini": {
    provider: "openai",
    name: "o4-mini",
    openaiId: "o4-mini",
    description: "OpenAI's fast reasoning model",
  },
};

export const DEFAULT_MODEL: ModelId = "glm-4.7-flash";

/** IDs of models not yet exposed to users. */
const INTERNAL_MODELS: Set<ModelId> = new Set([
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "o3",
  "o4-mini",
]);

type ModelEnv = {
  AI: Ai;
  OPENAI_API_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_AI_GATEWAY_ID?: string;
};

export function getModel(
  env: ModelEnv,
  modelId: ModelId,
  options?: { sessionAffinity?: string },
): LanguageModel {
  const spec = MODELS[modelId];
  if (!spec) throw new Error(`Unknown model: ${modelId}`);

  if (spec.provider === "openai") {
    if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    if (!env.CF_ACCOUNT_ID || !env.CF_AI_GATEWAY_ID) {
      throw new Error("CF_ACCOUNT_ID and CF_AI_GATEWAY_ID are required for OpenAI models");
    }

    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_AI_GATEWAY_ID}/openai`,
    });

    return openai(spec.openaiId);
  }

  const workersai = createWorkersAI({ binding: env.AI });
  return workersai(spec.workersAiId, {
    sessionAffinity: options?.sessionAffinity,
  });
}

/** Only returns models that are publicly exposed to users. */
export function listModels() {
  return Object.entries(MODELS)
    .filter(([id]) => !INTERNAL_MODELS.has(id as ModelId))
    .map(([id, spec]) => ({
      id,
      name: spec.name,
      description: spec.description,
    }));
}
