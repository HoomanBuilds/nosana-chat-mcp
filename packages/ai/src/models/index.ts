import type { MODEL_AVAILABLE } from '../types.js';
import { ModelConfigs } from '../model.js';
import { Gemini, Self, type Types } from '../index.js';

export function modelSupportsWebSearch(modelName: string): boolean {
  const config = ModelConfigs[modelName as MODEL_AVAILABLE];
  return config ? config.search : false;
}

type ModelMap = {
  gemini: Types.GEMINI_MODEL_AVAILABLE;
  self: Types.SELF_MODEL_AVAILABLE;
};

export function getModelInstance<P extends keyof ModelMap>(
  provider: P,
  modelName: ModelMap[P],
  apiKeys?: Record<"gemini" | "openai", string>
) {
  switch (provider) {
    case "gemini":
      return Gemini.GeminiModel(modelName as Types.GEMINI_MODEL_AVAILABLE, apiKeys?.gemini);
    case "self":
      return Self.SelfModel(modelName as Types.SELF_MODEL_AVAILABLE);
    default:
      throw new Error("Invalid provider");
  }
}