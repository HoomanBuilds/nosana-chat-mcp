export interface ModelParams {
  temperature?: number;        
  max_tokens?: number;         
  top_p?: number;              
  presence_penalty?: number; 
  frequency_penalty?: number;
  stop?: string[];
  followUp?: boolean;
  context ?: {
    absoluteMaxTokens?: number;
    maxContextTokens?: number;
    prevChatLimit?: number;
    truncateFrom?: "start" | "end";
  }
}

export type PromptMode = "zero" | "auto"

export interface StreamThrottleConfig {
  chunkSize?: number;
  minDelay?: number;
  maxDelay?: number;
}
