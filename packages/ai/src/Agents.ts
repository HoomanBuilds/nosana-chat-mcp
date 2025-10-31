import type { ChatMessage, SearchRequest } from "./types";
import z from "zod";
import { GeminiModel } from "./models/gemini";


export default class Agents {
  private model: ReturnType<typeof GeminiModel>;

  constructor({ apiKey }: { apiKey: string }) {
    this.model = GeminiModel('gemini-2.0-flash', apiKey);
  }
  getSearchQuery = async (history: ChatMessage[], query: string): Promise<SearchRequest> => {
    const messages = [
      ...history.slice(-2).map(m => ({ role: 'user' as const, content: m.content })),
      { role: 'user' as const, content: this.getSearchQueryPrompt(query) },
    ];

    try {
      const schema = z.object({
        query: z.string().describe("The search query string"),
        topic: z.enum(['general', 'news', 'finance']).default('general').describe("The type of content to search"),
        searchDepth: z.enum(['basic', 'advanced']).default('basic').describe("Depth of search"),
        maxResults: z.number().min(1).max(3).default(1).describe("Maximum number of results"),
        country: z.string().default('us').describe("Country for the search results"),
      });

      const parsed: SearchRequest = await this.model.generateObjectGemini(messages, schema);

      return {
        query: parsed.query || query,
        topic: parsed.topic || 'general',
        searchDepth: parsed.searchDepth || 'basic',
        maxResults: Math.min(Math.max(parsed.maxResults || 1, 1), 3),
        country: parsed.country || 'us',
      };
    } catch (e) {
      console.error('Failed to generate structured search query:', e);
      return {
        query,
        topic: 'general',
        searchDepth: 'basic',
        maxResults: 3,
        country: 'us',
      };
    }
  };

  private getSearchQueryPrompt = (query: string): string => `
  Generate a JSON object for a search request based on: "${query}".

  - Rewrite for clarity and accuracy.
  - Merge multiple aspects into one query.
  - If input is not directly searchable, reinterpret meaningfully (maxResults 1–2).
  - Explicitly request latest news if relevant.
  `;
}