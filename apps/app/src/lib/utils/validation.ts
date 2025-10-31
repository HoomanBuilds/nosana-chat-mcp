import { z } from "zod";

const chatItemSchema = z.object({
  role: z.enum(["user", "model"]),
  content: z.string().min(1),
  metadata: z
    .object({
      status: z.string().default("message"),
      id: z.string().optional(),
      reasoning: z.string().optional(),
      model: z.string().optional(),
    })
    .default({ status: "sent" }), 
});

export const chatRequestSchema = z.object({
  query: z.string().min(1, "Query cannot be empty."),
  model: z.string().regex(/^[^\/]+\/[^\/]+$/, 'Model must be in "provider/modename" format'),
  customConfig: z.object({
    temperature: z.number().min(0).max(1).default(0.7),
    max_tokens: z.number().max(10000).default(2000),
    top_p: z.number().min(0).max(1).default(1),
    presence_penalty: z.number().min(-2).max(2).default(0),
    frequency_penalty: z.number().min(-2).max(2).default(0),
    stop: z.array(z.string()).default([]),
    followUp: z.boolean().default(true),
    context: z.object({
      absoluteMaxTokens: z.number().max(10000).default(5000),
      maxContextTokens: z.number().max(10000).default(3000),
      prevChatLimit: z.number().max(30).default(6),
      truncateFrom: z.enum(["start", "end"]).default("end"),
    }).default(() => ({
      absoluteMaxTokens: 5000,
      maxContextTokens: 3000,
      prevChatLimit: 6,
      truncateFrom: "end" as const,
    })),
  }).default(() => ({
    temperature: 0.7,
    max_tokens: 2000,
    top_p: 1,
    presence_penalty: 0,
    frequency_penalty: 0,
    stop: [],
    followUp: true,
    context: {
      absoluteMaxTokens: 5000,
      maxContextTokens: 3000,
      prevChatLimit: 6,
      truncateFrom: "end" as const,
    },
  })),
  mode : z.enum(["deployer"]).optional(),
  thinking: z.boolean().default(false),
  websearch: z.boolean().default(false),
  chats: z.array(chatItemSchema)
    .max(50, "Maximum 50 messages allowed")
    .default([]),
  customPrompt: z.string().max(1000, "Maximum 1000 characters allowed").nullable().default(null),
  threadId: z.string().optional(),
  chatId: z.string().nullable().optional(),
  apiKeys: z.record(z.string(), z.string()).optional(),
  walletPublicKey: z.string().optional(),
});


type ChatRequest = z.infer<typeof chatRequestSchema>;
// type ModelParams = z.infer<typeof chatRequestSchema.shape.customConfig>;

export type Payload = ChatRequest & {
  signal?: AbortSignal;
  apiKeys?: Record<string, string>;
  geo?: {
    country: string,
    region: string,
    city: string
  }
};
