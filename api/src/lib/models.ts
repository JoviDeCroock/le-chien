import { createWorkersAI } from "workers-ai-provider";
import type { LanguageModel } from "ai";

export type ModelId =
  | "glm-4.7-flash"
  | "kimi-k2.5"
  | "llama-4-scout"
  | "gpt-oss-20b"
  | "gpt-oss-120b"
  | "nemotron-3-120b";

type ModelSpec = {
  name: string;
  workersAiId: string;
  description: string;
};

export const MODELS: Record<ModelId, ModelSpec> = {
  "glm-4.7-flash": {
    name: "GLM 4.7 Flash",
    workersAiId: "@cf/zai-org/glm-4.7-flash",
    description: "Fast and efficient general-purpose model",
  },
  "kimi-k2.5": {
    name: "Kimi K2.5",
    workersAiId: "@cf/moonshotai/kimi-k2.5",
    description: "Moonshot AI's latest conversational model",
  },
  "llama-4-scout": {
    name: "Llama 4 Scout",
    workersAiId: "@cf/meta/llama-4-scout-17b-16e-instruct",
    description: "Meta's instruction-tuned Llama 4",
  },
  "gpt-oss-20b": {
    name: "GPT-OSS 20B",
    workersAiId: "@cf/openai/gpt-oss-20b",
    description: "OpenAI's open-source 20B parameter model",
  },
  "gpt-oss-120b": {
    name: "GPT-OSS 120B",
    workersAiId: "@cf/openai/gpt-oss-120b",
    description: "OpenAI's open-source 120B parameter model",
  },
  "nemotron-3-120b": {
    name: "Nemotron 3 120B",
    workersAiId: "@cf/nvidia/nemotron-3-120b-a12b",
    description: "NVIDIA's 120B mixture-of-experts model",
  },
};

export const DEFAULT_MODEL: ModelId = "glm-4.7-flash";

export function getModel(
  env: { AI: Ai },
  modelId: ModelId,
  options?: { sessionAffinity?: string },
): LanguageModel {
  const spec = MODELS[modelId];
  if (!spec) throw new Error(`Unknown model: ${modelId}`);
  const workersai = createWorkersAI({ binding: env.AI });
  return workersai(spec.workersAiId, {
    sessionAffinity: options?.sessionAffinity,
  });
}

export function listModels() {
  return Object.entries(MODELS).map(([id, spec]) => ({
    id,
    name: spec.name,
    description: spec.description,
  }));
}
