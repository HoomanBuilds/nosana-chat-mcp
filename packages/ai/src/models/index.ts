import type { MODEL_AVAILABLE } from '../types.js';
import { ModelConfigs } from '../model.js';
import { Self, type Types } from '../index.js';

export function modelSupportsWebSearch(modelName: string): boolean {
  const config = ModelConfigs[modelName as MODEL_AVAILABLE];
  return config ? config.search : false;
}

type ModelMap = {
  self: Types.SELF_MODEL_AVAILABLE;
};

export function getModelInstance<P extends keyof ModelMap>(
  provider: P,
  modelName: ModelMap[P],
  apiKeys?: Record<"openai", string>
) {
  switch (provider) {
    case "self":
      return Self.SelfModel(modelName as Types.SELF_MODEL_AVAILABLE);
    default:
      throw new Error("Invalid provider");
  }
}
