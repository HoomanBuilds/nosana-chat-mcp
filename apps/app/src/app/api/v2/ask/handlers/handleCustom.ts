import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { createPrompt, parseStream, streamThrottle } from './utils';
import { Payload } from '@/lib/utils/validation';

export const handleAutoMode = async (
  payload: Payload & { signal?: AbortSignal },
  send: (event: string, data: string) => void
) => {
  try {
    const google = createGoogleGenerativeAI({
      apiKey: payload.apiKeys?.['gemini'] || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    })

    const model = google('gemini-2.0-flash');
    const { userPrompt, systemPrompt } = createPrompt(payload, "auto");

    const start = performance.now();
    const { textStream } = streamText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      abortSignal: payload.signal
    });

    await parseStream(textStream, send);

    const end = performance.now();
    send("Duration", String(end - start));
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.log("Streaming aborted by signal");
      return;
    }
    send("error", JSON.stringify({ message: (err as Error).message }));
  }
};


export const handleZeroMode = async (
  payload: Payload & { signal?: AbortSignal },
  send: (event: string, data: string) => void
) => {
  try {
    const google = createGoogleGenerativeAI({
      apiKey: payload.apiKeys?.['gemini'] || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    })
    const model = google('gemini-2.5-flash-lite');
    const { userPrompt, systemPrompt } = createPrompt(payload, "zero");

    const start = performance.now();
    const { textStream } = streamText({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 0,
            includeThoughts: false,
          },
        },
      },
      abortSignal: payload.signal
    });

    for await (const chunk of textStream) {
      await streamThrottle(chunk, send, payload.signal, {
        chunkSize: 20,
        minDelay: 2,
        maxDelay: 40,
      });
    }

    const end = performance.now();
    send("Duration", String(end - start));
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      console.log("Streaming aborted by signal");
      return;
    }
    send("error", JSON.stringify({ message: (error as Error).message }));
  }
};

export const handleReasoning = async (payload: Payload, send: (event: string, data: string) => void) => {
  const modelName = payload.model.split('/')[1];

  const google = createGoogleGenerativeAI({
    apiKey: payload.apiKeys?.['gemini'] || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  })

  const { text, reasoning } = await generateText({
    model: google(modelName || 'gemini-2.0-flash'),
    messages: buildMessages("you are a helpful assistant answer the users query you can take the reference of past conversation as well", payload.chats || [], payload.query),
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 8192,
          includeThoughts: true,
        },
      },
    },
  });

  send('llmResult', text);
  if (reasoning[0].type == "reasoning") {
    send('thinking', reasoning[0].text);
  }
}

const mapRole = (role: "user" | "model"): "user" | "assistant" => {
  return role === "user" ? "user" : "assistant";
};

export const buildMessages = (systemPrompt: string, chats: { role: string; content: string }[], payloadQuery: string) => {
  const recentChats = chats.slice(-3);
  const mappedMessages = recentChats.map(msg => ({
    role: mapRole(msg.role as "user" | "model") as "user" | "assistant",
    content: msg.content
  }));

  return [
    { role: "system" as const, content: systemPrompt },
    ...mappedMessages,
    { role: "user" as const, content: payloadQuery }
  ];
};