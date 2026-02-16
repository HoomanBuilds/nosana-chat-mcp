import { ContextCutter } from "@/lib/utils/ContextCutter";
import { Payload } from "@/lib/utils/validation";
import OpenAI from "openai";
import { createStreamingParser, buildMessages } from "./handleSelfHostedMode";
import { getInstructions } from "@/lib/utils/keyword";
import { performSearch } from "@/lib/tools/webSearch";

function normalizeInferenceBaseURL(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;

  if (trimmed.endsWith("/v1/chat/completions")) {
    return trimmed.replace(/\/chat\/completions$/, "");
  }
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed.replace(/\/chat\/completions$/, "");
  }
  if (trimmed.endsWith("/v1")) {
    return trimmed;
  }
  return `${trimmed}/v1`;
}

function isServiceLoadingError(error: unknown): boolean {
  const err = error as {
    status?: number;
    headers?: { get?: (key: string) => string | null };
    message?: string;
  };

  if (err?.status !== 503) return false;

  const state = err.headers?.get?.("x-frp-service-state");
  if (state === "loading") return true;

  return /loading/i.test(err?.message || "");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const handleInferenceMode = async (
  payload: Payload,
  send: (event: string, data: string) => void,
) => {
  const modelName = payload.deployedModel?.model || payload.model;

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

  // Web Search logic
  let searchContext = "";
  if (payload.websearch) {
    try {
      send("event", "Searching the web...");
      const searchResult = await performSearch({
        query: payload.query,
        maxResults: 5,
        searchDepth: "advanced",
      });

      if (
        searchResult &&
        searchResult.results &&
        searchResult.results.length > 0
      ) {
        send(
          "searchResult",
          JSON.stringify(
            searchResult.results.map((r) => ({
              url: r.url,
              title: r.title,
              content: r.content,
            })),
          ),
        );

        searchContext = `
        <search_results>
        ${searchResult.results.map((r, i) => `[${i + 1}] ${r.title} (${r.url}): ${r.content}`).join("\n\n")}
        </search_results>
        
        Use the provided search results to enhance your answer. Cite your sources using [1], [2], etc.
        `;
      }
    } catch (err) {
      console.error("Search integration failed:", err);
    }
  }

  const systemInstructions = getInstructions(payload.query);
  let systemInstruction = `
        <user_metadata>
            Current Date := ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            Geo Location := ${payload?.geo?.country ?? "Unknown"} | ${payload?.geo?.region ?? "Unknown"}
            Model Being used := ${modelName}
        </user_metadata>

        You are an expert AI assistant. Use previous chat context and any search results provided to deliver clear, accurate answers.
        
        Instructions :
        ${systemInstructions ?? ""}
        - Keep answers concise and relevant.
        ${searchContext}
        `;

  if (payload?.customPrompt) {
    systemInstruction += `\n\n Consider the user's custom prompt: "${payload?.customPrompt}".`;
  }

  const messages = buildMessages(payload, systemInstruction, contextChat);

  const rawBaseUrl =
    payload.deployedModel?.baseURL || process.env.INFERIA_LLM_URL || "";
  const baseURL = normalizeInferenceBaseURL(rawBaseUrl);
  const apiKey =
    payload.deployedModel?.apiKey ||
    process.env.INFERIA_LLM_API_KEY ||
    "nosana-local";

  if (!baseURL) {
    throw new Error(
      "Missing INFERIA_LLM_URL or deployed/custom service baseURL",
    );
  }

  console.log(`🚀 [Inference] Calling ${baseURL} with model ${modelName}`);

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
    defaultHeaders: payload.ipAddress
      ? { "X-IP-Address": payload.ipAddress }
      : undefined,
  });

  const parser = createStreamingParser(send, {
    chunkSize: 12,
    minDelay: 1,
    maxDelay: 40,
  });
  const startTime = performance.now();
  let receivedTextChunk = false;
  let receivedReasoningChunk = false;
  const mappedMessages = messages.map(
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
  );
  const useNonStreamForCustomService = Boolean(payload.deployedModel?.baseURL);

  try {
    if (useNonStreamForCustomService) {
      let nonStream: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          nonStream = await client.chat.completions.create({
            model: modelName,
            stream: false,
            messages: mappedMessages,
            temperature: payload.customConfig?.temperature ?? 0.7,
            max_tokens: payload.customConfig?.max_tokens ?? 3000,
            top_p: payload.customConfig?.top_p ?? 1,
          });
          break;
        } catch (error) {
          if (isServiceLoadingError(error) && attempt < 3) {
            send(
              "event",
              `Service is starting up, retrying in ${attempt * 2}s...`,
            );
            await sleep(attempt * 2000);
            continue;
          }
          throw error;
        }
      }

      const answer = nonStream?.choices?.[0]?.message?.content ?? "";
      if (answer) {
        receivedTextChunk = true;
        await parser.parse(answer);
      }
    } else {
      let stream: any = null;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          stream = await client.chat.completions.create({
            model: modelName,
            stream: true,
            messages: mappedMessages,
            temperature: payload.customConfig?.temperature ?? 0.7,
            max_tokens: payload.customConfig?.max_tokens ?? 3000,
            top_p: payload.customConfig?.top_p ?? 1,
          });
          break;
        } catch (error) {
          lastError = error;
          if (isServiceLoadingError(error) && attempt < 3) {
            send(
              "event",
              `Service is starting up, retrying in ${attempt * 2}s...`,
            );
            await sleep(attempt * 2000);
            continue;
          }
          throw error;
        }
      }

      if (!stream) {
        throw lastError || new Error("Failed to initialize streaming response");
      }

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta as any;
        const content = delta?.content ?? "";
        const reasoning = delta?.reasoning ?? "";

        if (reasoning) {
          receivedReasoningChunk = true;
          parser.parse(`<think>${reasoning}</think>`);
        }
        if (content) {
          receivedTextChunk = true;
          parser.parse(content);
        }
      }

      // Some OpenAI-compatible gateways can return a successful stream with no deltas.
      // Fallback to a non-stream request so the user still gets a response.
      if (!receivedTextChunk && !receivedReasoningChunk) {
        send("event", "No streamed tokens received, retrying once...");
        const nonStream = await client.chat.completions.create({
          model: modelName,
          stream: false,
          messages: mappedMessages,
          temperature: payload.customConfig?.temperature ?? 0.7,
          max_tokens: payload.customConfig?.max_tokens ?? 3000,
          top_p: payload.customConfig?.top_p ?? 1,
        });

        const fallbackContent = nonStream.choices?.[0]?.message?.content ?? "";
        if (fallbackContent) {
          receivedTextChunk = true;
          await parser.parse(fallbackContent);
        }
      }
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      send("error", "Request aborted by user");
    } else if (isServiceLoadingError(error)) {
      send(
        "error",
        "The deployed service is still loading. Please retry in a few seconds.",
      );
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
