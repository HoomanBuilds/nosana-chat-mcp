import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { twMerge } from "tailwind-merge";

export function cn(...classes: (string | undefined | false)[]) {
  return twMerge(...classes.filter(Boolean));
}


interface PingOptions {
  provider: string;
  apiKey: string;
  modelName: string;
}

export async function ping({ provider, apiKey, modelName }: PingOptions) {
  try {
    let model: any;
    switch (provider) {
      case "Gemini":
        const google = createGoogleGenerativeAI({ apiKey });
        model = google(modelName);
        break;
      case "Tavily":
        try {
          await fetch(
            'https://api.tavily.com/search',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                query: 'test',
                auto_parameters: true,
                topic: 'general',
                search_depth: 'basic',
                max_results: 1,
                chunks_per_source: 1
              })
            }
          );
          return true;
        } catch {
          return false;
        }
      case "openai":
        const openai = createOpenAI({ apiKey });
        model = openai(modelName);
        break;
      default:
        throw new Error("Unsupported AI provider");
    }
    const { text } = await generateText({
      model,
      prompt: "Ping",
      maxOutputTokens: 10,
    });
    console.log("ping test response :- ", text);
    return true;
  } catch {
    return false;
  }
}
