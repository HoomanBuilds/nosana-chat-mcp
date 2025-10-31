export interface Message {
  id: string;
  content: string;
  role: 'user' | 'model';
  type?: 'aborted' | 'messsage' | 'error';
  timestamp: Date;
}

export interface Model {
  name: string;
  provider: string;
  generate: (messages: any[], payload?: any, onChunk?: (chunk: string) => void) => Promise<string>;
}

export type GEMINI_MODEL_AVAILABLE = "gemini-2.5-flash" | "gemini-2.0-flash" | "gemini-2.5-pro" | "gemini-2.0-flash-lite" | "gemini-2.5-flash-lite"
export const SELF_MODEL_AVAILABLE = ["qwen3:0.6b", "llama-3.8b", "deepseek-r1:7b", "mistral-7b" , "qwen3:4b"] as const;

export type SELF_MODEL_AVAILABLE = typeof SELF_MODEL_AVAILABLE[number];

export type MODEL_AVAILABLE = GEMINI_MODEL_AVAILABLE | SELF_MODEL_AVAILABLE
export enum ModelProvider {
  GEMINI = 'gemini',
  SELF = 'self',
}

export type PROVIDER_AVAILABLE = `${ModelProvider}`;


export interface ModelConfig {
  name: string;
  provider: ModelProvider;
  search: boolean;
  contextWindow: number;
  maxTokens: number;
  retry: boolean
  thinking: boolean;
  NoPenalty?: boolean
}


export interface SearchRequest {
  query: string;
  topic?: "general" | "news" | "finance";
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
  country?: string;
  maxTokens?: number;
}

export interface ChatMessage {
  role: "user" | "model",
  content: string
}