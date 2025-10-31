import { ContextCutter } from "@/lib/utils/ContextCutter";
// import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ChatMessage } from "@/lib/types";
import { getModelInstance } from "@nosana-chat/ai";
import { Types } from "@nosana-chat/ai";
import { Payload } from "@/lib/utils/validation";
import { getInstructions } from "@/lib/utils/keyword";

export const handleSelfHostedMode = async (
  payload: Payload,
  send: (event: string, data: string) => void
) => {

  const [provider, modelName] = payload.model.split("/") as [Types.PROVIDER_AVAILABLE, Types.MODEL_AVAILABLE];

  let contextChat;
  if (payload.chats) {
    contextChat = ContextCutter.getRecentConversations(payload.chats, {
      minChats: payload.customConfig?.context?.prevChatLimit || 8,
      maxTokens: payload.customConfig?.context?.maxContextTokens || 3000,
      truncateFrom: payload.customConfig?.context?.truncateFrom || "end",
      absoluteMaxTokens: payload.customConfig?.context?.absoluteMaxTokens || 5000,
    });
  }

  const systemInstructions = getInstructions(payload.query);
  let systemInstruction = `
        <user_metadata>
            Current Date := ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            Geo Location := ${payload?.geo?.country ?? "Unknown"} | ${payload?.geo?.region ?? "Unknown"}
            Model Being used := Provider: ${payload?.model?.split("/")[0] ?? "N/A"} \t Model: ${payload?.model?.split("/")[1] ?? "N/A"}
        </user_metadata>

        You are an expert AI assistant. Use previous chat context and any tool results to provide clear, accurate answers. Include optional practical steps or recommendations. 

        Instructions :
        ${systemInstructions ?? ""}
        - Keep answers concise and relevant; expand only if the query is complex.
        `;


  if (payload?.customPrompt) {
    systemInstruction += `\n\n Consider the user's custom prompt: "${payload?.customPrompt}".`;
  }

  const messages = buildMessages(payload, systemInstruction, contextChat);
  const modelInstance = getModelInstance(provider, modelName);

  send("llmPrompt", JSON.stringify(messages))

  const parser = createStreamingParser(send, { chunkSize: 12, minDelay: 1, maxDelay: 40 });
  const startTime = performance.now();
  try {

    await modelInstance.generate(messages, payload, (chunk: string) => {
      parser.parse(chunk);
    });

  } catch (error) {
    if ((error as Error).name === "AbortError") {
      send("error", "Request aborted by user"); //by that the controller might be closed down
    } else {
      send("error", (error as Error).message);
    }
    console.error("Generation error:", error);
  } finally {
    await parser.flush();
  }
  const endTime = performance.now();
  send("Duration", String(endTime - startTime));
};

interface ThrottleConfig {
  chunkSize?: number;
  minDelay?: number;
  maxDelay?: number;
}

export function createStreamingParser(
  send: (event: string, data: string) => void,
  config: ThrottleConfig = {}
) {
  const { chunkSize = 12, minDelay = 1, maxDelay = 50 } = config;

  let buffer = '';
  let isThinking = false;
  const startTag = '<think>';
  const endTag = '</think>';

  let queue = Promise.resolve();

  async function sendThrottled(eventName: string, text: string) {
    if (!text) return;
    for (let i = 0; i < text.length; i += chunkSize) {
      send(eventName, text.slice(i, i + chunkSize));
      const t = i / (text.length - 1 || 1);
      const delay = minDelay + (1 - Math.cos(Math.PI * t)) * (maxDelay - minDelay);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  async function process() {
    while (true) {
      if (!isThinking) {
        const startIndex = buffer.indexOf(startTag);
        if (startIndex !== -1) {
          const content = buffer.slice(0, startIndex);
          await sendThrottled('llmResult', content);
          buffer = buffer.slice(startIndex + startTag.length);
          isThinking = true;
          continue;
        } else {
          const lastSpace = buffer.lastIndexOf(' ');
          if (lastSpace > 0) {
            const content = buffer.slice(0, lastSpace + 1);
            await sendThrottled('llmResult', content);
            buffer = buffer.slice(lastSpace + 1);
          }
          break;
        }
      } else {
        const endIndex = buffer.indexOf(endTag);
        if (endIndex !== -1) {
          const content = buffer.slice(0, endIndex);
          await sendThrottled('thinking', content);
          buffer = buffer.slice(endIndex + endTag.length);
          isThinking = false;
          continue;
        } else {
          break;
        }
      }
    }
  }

  return {
    async parse(chunk: string) {
      queue = queue.then(async () => {
        buffer += chunk;
        await process();
      });
      return queue;
    },

    async flush() {
      queue = queue.then(async () => {
        if (buffer.length > 0) {
          const eventName = isThinking ? 'thinking' : 'llmResult';
          await sendThrottled(eventName, buffer);
          buffer = '';
        }
      });
      return queue;
    },
  };
}

export function buildMessages(
  payload: Payload,
  systemInstruction: string,
  contextChat?: ChatMessage[]
) {
  const messages = [];

  messages.push({
    role: "system",
    content: systemInstruction
  });

  if (contextChat) {
    for (const c of contextChat) {
      messages.push({
        role: c.role === "model" ? "assistant" : "user",
        content: c.content,
      });
    }
  }

  messages.push({ role: "user", content: payload.query });
  return messages;
}

  