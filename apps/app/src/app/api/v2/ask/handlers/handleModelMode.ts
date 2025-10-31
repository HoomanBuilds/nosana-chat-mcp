import { getModelInstance } from "@nosana-chat/ai";
import { performSearch } from "@/lib/tools/webSearch";
import { ChatMessage } from "@/lib/types";
import { Model, Types } from "@nosana-chat/ai";
import { ContextCutter } from "@/lib/utils/ContextCutter";
import { Payload } from "@/lib/utils/validation";
import Agents from "@nosana-chat/ai";
import { getInstructions } from "@/lib/utils/keyword";

export const handleModelMode = async (payload: Payload, send: (event: string, data: string | any) => void) => {
    const [provider, modelName] = payload.model.split("/") as [Types.PROVIDER_AVAILABLE, Types.MODEL_AVAILABLE];

    if (!provider || !modelName) {
        throw new Error("Invalid model format");
    }

    const modelInstance = getModelInstance(provider, modelName, payload?.apiKeys);
    const config = Model.ModelConfigs[modelName as Types.MODEL_AVAILABLE];
    const context = new Map<string, any>();
    
    const start = performance.now();

    if (payload.websearch) {
        try {
            send("event", "Performing search...");
            
            const agent = new Agents({ apiKey: payload.apiKeys?.["gemini"] || process.env.GOOGLE_GENERATIVE_AI_API_KEY! });
            const searchQuery = await agent.getSearchQuery(payload.chats.slice(-5), payload.query);
            
            const searchResults = await performSearch(searchQuery);
            context.set("webSearch", searchResults);
            const formateSearch = searchResults.results.map((r: any) => ({
                title: r.title,
                url: r.url,
                content: r.content
            }))
            send("searchResult", JSON.stringify(formateSearch));
        } catch (error) {
            send("warning", { message: "Search failed, continuing without search results", error });
        }
    }

    await runFinal(modelInstance, context, send, payload, { thinking: payload.thinking ?? false , supportThinking: config.thinking });
    const end = performance.now();
    const timeTaken = (end - start).toFixed(2);
    send("Duration", timeTaken);
};

export const runFinal = async (
    modelInstance: any,
    context: Map<string, unknown>,
    send: (event: string, data: string) => void,
    payload : Payload,
    config?: { thinking?: boolean, supportThinking?: boolean }
): Promise<string> => {
    try {
        const toolContext = context.size
            ? `Tool outputs:\n${JSON.stringify(
                Object.fromEntries(
                    Object.entries(Object.fromEntries(context)).map(([k, v]) => {
                        if (k === "webSearch" && v && typeof v === 'object' && 'answer' in v && 'results' in v) {
                            const webSearch = v as { answer: string, results: any[] };
                            return [
                                k,
                                {
                                    answer: webSearch.answer,
                                    results: (webSearch.results || []).map((r: any) => ({
                                        title: r.title,
                                        url: r.url,
                                        content: r.content,
                                        score: r.score,
                                        publishedDate: r.publishedDate,
                                    })),
                                },
                            ];
                        }
                        return [k, v];
                    })
                )
            )}`
            : "";

        const systemInstructions = getInstructions(payload.query); 

        let systemInstruction = `
        <user_metadata>
            Current Date := ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            Geo Location := ${payload?.geo?.country ?? "Unknown"} | ${payload?.geo?.region ?? "Unknown"} | ${payload?.geo?.city ?? "Unknown"}
            Model Being used := Provider: ${payload?.model?.split("/")[0] ?? "N/A"} \t Model: ${payload?.model?.split("/")[1] ?? "N/A"}
        </user_metadata>

        You are an expert AI assistant. Use previous chat context and any tool results to provide clear, accurate answers. Include optional practical steps or recommendations. 
        
        Instructions :
        ${systemInstructions ?? ""}
        - Keep answers concise and relevant; expand only if the query is complex.
        - never use tool_code or any kind of tools'
        - be more of human tone then robotic , point out user intent and ask for clarifications if needed
        `;


        if (payload?.customPrompt) {
            systemInstruction += `\n\n Consider the user's custom prompt: "${payload?.customPrompt}".`;
        }

        if (config?.thinking && config?.supportThinking) {
            systemInstruction = `
            Begin output with "<think>" as the very first character (no BOM, no whitespace, no newlines).
            Emit exactly one top-level <think>...</think> block containing ONLY your step-by-step reasoning process.
            After </think>, produce your final answer in plain text without any formatting tags.
            Do NOT include additional <think> blocks, code fences, or markdown anywhere.

            In the thinking section:
            - Break down the problem methodically
            - Analyze relevant context and tool outputs
            - Consider implications and alternatives
            - Develop your reasoning to an appropriate depth based on query complexity
        
            Important
            - must start from <think>
            - must close the think tag after done thinking </think>
            - there is just one <think></think> after that there is just plain response after that , these think tag never comes again

            ${systemInstruction}
            `.trim();
        }


        const finalMessages = buildMessages(payload, toolContext , systemInstruction);


        send("llmPrompt", JSON.stringify(finalMessages));
        let fullOutput = "";
        const parser = createStreamingParser(send);
        await modelInstance.generate(finalMessages, payload, (chunk: string) => {
            fullOutput += chunk;
            parser.parse(chunk);
        });

        parser.flush();

        return fullOutput;
    } catch (error) {
        console.error("Error in runFinal:", error);
        send("error", "LLM process failed");
        return "";
    }
};

function createStreamingParser(send: (event: "thinking" | "llmResult" | "event" | "error", data: string) => void) {
    let state: 'INITIAL' | 'THINKING' | 'STREAMING' = 'INITIAL';
    let buffer = "";
    const START_TAG = "<think>";
    const END_TAG = "</think>";
    const MAX_THINK_BUFFER = 2000;

    const parse = (chunk: string) => {
        buffer += chunk;

        let continueProcessing = true;
        while (continueProcessing) {
            continueProcessing = false;

            switch (state) {
                case 'INITIAL': {
                    const startIndex = buffer.indexOf(START_TAG);
                    if (startIndex !== -1) {
                        buffer = buffer.substring(startIndex + START_TAG.length);
                        state = 'THINKING';
                        send("event", "thinking");
                        continueProcessing = true;
                    } else if (buffer.length > START_TAG.length) {
                        state = 'STREAMING';
                        send("event", "streaming");
                        continueProcessing = true;
                    }
                    break;
                }

                case 'THINKING': {
                    const endIndex = buffer.indexOf(END_TAG);
                    if (endIndex !== -1) {
                        const thinkingContent = buffer.substring(0, endIndex);
                        if (thinkingContent) send("thinking", thinkingContent);
                        buffer = buffer.substring(endIndex + END_TAG.length);
                        state = 'STREAMING';
                        send("event", "streaming");
                        continueProcessing = true;
                    } else if (buffer.length > MAX_THINK_BUFFER) {
                        send("thinking", buffer);
                        buffer = "";
                        state = 'STREAMING';
                        send("event", "streaming");
                        continueProcessing = true;
                    } else {
                        const potentialTagStart = Math.max(0, buffer.length - (END_TAG.length - 1));
                        const contentToSend = buffer.substring(0, potentialTagStart);
                        if (contentToSend) send("thinking", contentToSend);
                        buffer = buffer.substring(potentialTagStart);
                    }
                    break;
                }

                case 'STREAMING': {
                    if (buffer.length > 0) {
                        send("llmResult", buffer);
                        buffer = "";
                    }
                    break;
                }
            }
        }
    };

    const flush = () => {
        if (state === 'THINKING') {
            if (buffer.length > 0) send("thinking", buffer);
            state = 'STREAMING';
        }
        if (buffer.length > 0) send("llmResult", buffer);
        buffer = "";
    };

    return { parse, flush };
}

export const buildMessages = (
    payload: Payload,
    toolContext: string,
    systemContent: string,
): ChatMessage[] => {

    const trimmedHistory = ContextCutter.getRecentConversations( payload.chats , {
        minChats: payload.customConfig?.context?.prevChatLimit || 8,
        maxTokens: payload.customConfig?.context?.maxContextTokens || 3000,
        truncateFrom: payload.customConfig?.context?.truncateFrom || "end",
        absoluteMaxTokens: payload.customConfig?.context?.absoluteMaxTokens || 5000,
    });

   const messages: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...trimmedHistory.map(({ role: r, content: c }) => ({
        role: r === "user" ? "user" as const : "model" as const,
        content: `${c}
    `,
    })),
    ];

    if (toolContext) {
        messages.push({ role: "user", content: `Context you can use for response generation : ${toolContext}` });
    }

    messages.push({ role: "user", content: `userQuery: ${payload.query}` });

    return messages;
};