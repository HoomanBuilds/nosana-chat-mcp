import { twMerge } from "tailwind-merge";
import OpenAI from "openai";

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
    switch (provider) {
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
        const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
        await openai.chat.completions.create({
          model: modelName,
          messages: [{ role: "user", content: "Ping" }],
          max_tokens: 5,
        });
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}
