import { ModelProvider, type MODEL_AVAILABLE, type ModelConfig } from "./types";

export const ModelConfigs: Record<MODEL_AVAILABLE, ModelConfig> = {
  'gemini-2.5-flash': {
    name: 'gpt-4-1',
    provider: ModelProvider.GEMINI,
    search: true,
    thinking: true,
    contextWindow: 128000,
    maxTokens: 4096,
    retry: true,
    NoPenalty : true
  },
  'gemini-2.5-pro': {
    name: 'gemini-2.5-pro',
    provider: ModelProvider.GEMINI,
    search: true,
    thinking: false,
    retry: true,
    contextWindow: 128000,
    maxTokens: 4096
  },
  'gemini-2.0-flash': {
    name: 'gemini-2-flash',
    provider: ModelProvider.GEMINI,
    search: true,
    contextWindow: 1048576,
    maxTokens: 8192,
    retry: true,
    thinking: false
  },
  'qwen3:0.6b': {
    name: 'qwen3-0.6b',
    provider: ModelProvider.SELF,
    search: false,
    thinking: false,
    retry: true,
    contextWindow: 1048576,
    maxTokens: 8192
  },
  'llama-3.8b': {
    name: 'llama-3.8b',
    provider: ModelProvider.SELF,
    search: false,
    thinking: false,
    retry: true,
    contextWindow: 1048576,
    maxTokens: 8192
  },
  'deepseek-r1:7b': {
    name: 'deepseek-r1:7b',
    provider: ModelProvider.SELF,
    search: false,
    thinking: false,
    retry: true,
    contextWindow: 1048576,
    maxTokens: 8192
  },
  'mistral-7b': {
    name: 'mistral-7b',
    provider: ModelProvider.SELF,
    search: false,
    thinking: false,
    retry: true,
    contextWindow: 1048576,
    maxTokens: 8192
  },
   'gemini-2.0-flash-lite': {
    name: 'mistral-7b',
    provider: ModelProvider.SELF,
    search: false,
    thinking: false,
    retry: true,
    contextWindow: 1048576,
    maxTokens: 8192
  },
   'gemini-2.5-flash-lite': {
    name: 'mistral-7b',
    provider: ModelProvider.SELF,
    search: false,
    thinking: false,
    retry: true,
    contextWindow: 1048576,
    maxTokens: 8192
  },
   'qwen3:4b': {
    name: 'qwen3:4b',
    provider: ModelProvider.SELF,
    search: false,
    thinking: false,
    retry: true,
    contextWindow: 1048576,
    maxTokens: 8192
  }
};