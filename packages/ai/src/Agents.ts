import type { ChatMessage, SearchRequest } from "./types";
import OpenAI from "openai";

export default class Agents {
  private client: OpenAI;
  private modelName: string;

  constructor({
    apiKey,
    baseURL,
    model,
  }: {
    apiKey?: string;
    baseURL?: string;
    model?: string;
  }) {
    const resolvedApiKey = apiKey || process.env.INFERIA_LLM_API_KEY;
    const resolvedBaseURL = baseURL || process.env.INFERIA_LLM_URL;

    if (!resolvedApiKey) {
      throw new Error(
        "INFERIA_LLM_API_KEY is required. Provide it as an argument or set the environment variable.",
      );
    }
    if (!resolvedBaseURL) {
      throw new Error(
        "INFERIA_LLM_URL is required. Provide it as an argument or set the environment variable.",
      );
    }

    this.client = new OpenAI({
      apiKey: resolvedApiKey,
      baseURL: resolvedBaseURL,
    });
    this.modelName = model || "inferiallm";
  }

  getSearchQuery = async (
    history: ChatMessage[],
    query: string,
  ): Promise<SearchRequest> => {
    const messages = [
      ...history
        .slice(-2)
        .map((m) => ({ role: "user" as const, content: m.content })),
      { role: "user" as const, content: this.getSearchQueryPrompt(query) },
    ];

    try {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: messages.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        })),
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from AI");

      const parsed = JSON.parse(content);

      return {
        query: parsed.query || query,
        topic: parsed.topic || "general",
        searchDepth: parsed.searchDepth || "basic",
        maxResults: Math.min(Math.max(parsed.maxResults || 1, 1), 3),
        country: parsed.country || "us",
      };
    } catch (e) {
      // Return default search request on failure
      return {
        query,
        topic: "general",
        searchDepth: "basic",
        maxResults: 3,
        country: "us",
      };
    }
  };

  private getSearchQueryPrompt = (query: string): string => `
  Generate a JSON object for a search request based on: "${query}".

  Return a JSON object with the following structure:
  {
    "query": "string",
    "topic": "general" | "news" | "finance",
    "searchDepth": "basic" | "advanced",
    "maxResults": number (1-3),
    "country": "string" (e.g. "us")
  }

  - Rewrite for clarity and accuracy.
  - Merge multiple aspects into one query.
  - If input is not directly searchable, reinterpret meaningfully (maxResults 1–2).
  - Explicitly request latest news if relevant.
  `;
}
