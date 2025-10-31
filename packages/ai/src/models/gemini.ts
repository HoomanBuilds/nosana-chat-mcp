import type { Model } from '../types.js';
import { Model as ModelP } from '../index.js';
import type { GEMINI_MODEL_AVAILABLE } from '../types.js';
import { generateText, generateObject, streamText } from 'ai';
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { z, ZodType } from 'zod';


export function GeminiModel(
  modelName: GEMINI_MODEL_AVAILABLE,
  apiKey?: string
): Model & {
  generateNostream: (messages: { role: "user" | "model"; content: string }[]) => Promise<string>;
  generateObjectGemini: <T>(
    messages: { role: "user" | "model"; content: string }[],
    schema: ZodType<T>,
  ) => Promise<T>;
} {
  const name = modelName;
  const provider = 'google';
  const google = createGoogleGenerativeAI({
    apiKey : apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY!
  });
  const model = google(modelName)

  
  async function generate(
    messages: { role: "user" | "model"; content: string }[],
    payload: {
      customConfig?: {
        temperature?: number;
        max_tokens?: number;
        frequency_penalty?: number;
        presence_penalty?: number;
        top_p?: number;
      };
      apiKeys?: Record<string, string>;
      signal?: AbortSignal;
    } = {},
    onChunk?: (chunk: string) => void
  ) {
    
    try {
      const { textStream } = streamText({
        model,
        messages: [
          {
            role: "system" as const,
            content:
              "You are a helpful assistant that provides accurate, relevant, and concise answers."
          },
          ...messages.map(m => ({
            role: m.role === "user" ? "user" as const : "assistant" as const,
            content: m.content
          }))
        ],
        frequencyPenalty: ModelP.ModelConfigs[modelName].NoPenalty ? 0 : payload?.customConfig?.frequency_penalty ?? 0,
        presencePenalty: ModelP.ModelConfigs[modelName].NoPenalty ? 0 : payload?.customConfig?.presence_penalty ?? 0,
        topP: payload?.customConfig?.top_p ?? 1,
        temperature: payload?.customConfig?.temperature ?? 0.7,
        maxOutputTokens: payload?.customConfig?.max_tokens ?? 3000,
        ...(payload?.signal instanceof AbortSignal ? { abortSignal: payload.signal } : {}),
        maxRetries: 2,
        
        onAbort: () => {
          console.error("aborted gemini response")
        }
      });

      let full = '';
      for await (const chunk of textStream) {
        full += chunk;
        onChunk?.(chunk);
      }

      return full;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        console.error("Streaming aborted by signal");
        return '';
      }
      console.error("===========\n Error streaming: \n============\n", err || (err as Error).message);
      return "";
    }
  }


  const generateNostream = async (
    messages: { role: "user" | "model"; content: string }[]
  ) => {
    const res = await generateText({
      model,
      messages: messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      })),
    });
    return res.text ?? '';
  };

  const generateObjectGemini = async <T>(
    messages: { role: "user" | "model"; content: string }[],
    schema?: ZodType<T>    
  ): Promise<T> => {
    const resolvedSchema: ZodType<T> = schema ?? (z.object({}) as unknown as ZodType<T>);

    const { object } = await generateObject({
      model,
      messages: messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      maxRetries: 1,
      providerOptions: {
        google: {
          structuredOutputs: true,
        },
      },
      schema: resolvedSchema,
    }) as { object: T };

    return object;
  };

  return { name, provider, generate, generateNostream, generateObjectGemini };
}
