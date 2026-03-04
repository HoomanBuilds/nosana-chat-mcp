export interface ChatMessage {
  role: "user" | "model" | "system";
  content: string;
  metadata?: {
    status?: string;
    id?: string;
    reasoning?: string;
    model?: string;
  };
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "X-Accel-Buffering": "no",
} as const;

export type SearchResult = {
  title: string;
  url: string;
  content: string;
};