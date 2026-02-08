import { ContextCutter } from "@/lib/utils/ContextCutter";
import { Payload } from "@/lib/utils/validation";
import OpenAI from "openai";
import { createStreamingParser, buildMessages } from "./handleSelfHostedMode";
import { getInstructions } from "@/lib/utils/keyword";

export const handleInferenceMode = async (
  payload: Payload,
  send: (event: string, data: string) => void,
) => {
  const modelName = payload.model;

  let contextChat;
  if (payload.chats) {
    contextChat = ContextCutter.getRecentConversations(payload.chats, {
      minChats: payload.customConfig?.context?.prevChatLimit || 8,
      maxTokens: payload.customConfig?.context?.maxContextTokens || 3000,
      truncateFrom: payload.customConfig?.context?.truncateFrom || "end",
      absoluteMaxTokens:
        payload.customConfig?.context?.absoluteMaxTokens || 5000,
    });
  }

  const systemInstructions = getInstructions(payload.query);
  let systemInstruction = `
        <user_metadata>
            Current Date := ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            Geo Location := ${payload?.geo?.country ?? "Unknown"} | ${payload?.geo?.region ?? "Unknown"}
            Model Being used := ${modelName}
        </user_metadata>

        You are an expert AI assistant. Use previous chat context to provide clear, accurate answers.
        
        Instructions :
        ${systemInstructions ?? ""}
        - Keep answers concise and relevant.
        `;

  if (payload?.customPrompt) {
    systemInstruction += `\n\n Consider the user's custom prompt: "${payload?.customPrompt}".`;
  }

  const messages = buildMessages(payload, systemInstruction, contextChat);

  if (!process.env.INFERIA_LLM_URL || !process.env.INFERIA_LLM_API_KEY) {
    throw new Error(
      "Missing INFERIA_LLM_URL or INFERIA_LLM_API_KEY environment variables",
    );
  }

  const baseURL = process.env.INFERIA_LLM_URL;
  const apiKey = process.env.INFERIA_LLM_API_KEY;

  console.log(`🚀 [Inference] Calling ${baseURL} with model ${modelName}`);

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const parser = createStreamingParser(send, {
    chunkSize: 12,
    minDelay: 1,
    maxDelay: 40,
  });
  const startTime = performance.now();

  try {
    const stream = await client.chat.completions.create({
      model: modelName,
      stream: true,
      messages: messages.map(
        (m) =>
          ({
            role:
              m.role === "assistant"
                ? "assistant"
                : m.role === "system"
                  ? "system"
                  : "user",
            content: m.content,
          }) as any,
      ),
      temperature: payload.customConfig?.temperature ?? 0.7,
      max_tokens: payload.customConfig?.max_tokens ?? 3000,
      top_p: payload.customConfig?.top_p ?? 1,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as any;
      const content = delta?.content ?? "";
      const reasoning = delta?.reasoning ?? "";

      if (reasoning) {
        parser.parse(`<think>${reasoning}</think>`);
      }
      if (content) {
        parser.parse(content);
      }
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      send("error", "Request aborted by user");
    } else {
      send("error", (error as Error).message);
    }
    console.error("Inference error:", error);
  } finally {
    await parser.flush();
  }

  const endTime = performance.now();
  send("Duration", String(endTime - startTime));
};
