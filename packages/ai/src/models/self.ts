import type { Model, SELF_MODEL_AVAILABLE } from "../types";
import OpenAI from "openai";

export function SelfModel(
    modelName: SELF_MODEL_AVAILABLE
): Model {
    const name = modelName;
    const provider = 'self';
    const client = new OpenAI({
        apiKey: process.env.SELF_HOSTED_API_KEY,
        baseURL: process.env.SELF_HOSTED_URL || "https://apiplatform.cldflred.ink/v1",
    });
    
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
            signal?: AbortSignal;
        },
        onChunk?: (chunk: string) => void
    ) {
        const stream = await client.chat.completions.create(
            {
                model: modelName,
                stream: true,
                messages: messages.map(m => ({
                    role: m.role === "user" ? "user" : "assistant",
                    content: m.content,
                })),
                temperature: payload.customConfig?.temperature ?? 0.7,
                max_tokens: payload.customConfig?.max_tokens ?? 3000,
                frequency_penalty: payload.customConfig?.frequency_penalty ?? 0,
                presence_penalty: payload.customConfig?.presence_penalty ?? 0,
                top_p: payload.customConfig?.top_p ?? 1,
            },
            {
                signal: payload.signal,
                timeout: modelName === "qwen3:0.6b" ? 15000 : 30000,
            }
        );

        let full = "";
        for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content ?? "";
            if (delta) {
                full += delta;
                onChunk?.(delta);
            }
        }
        return full;
    }

    return { name, provider, generate }
}