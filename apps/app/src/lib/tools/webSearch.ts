import { tavily, TavilySearchResponse } from "@tavily/core";
  
async function performSearch(searchRequest: any) : Promise<TavilySearchResponse> {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("Tavily feature disabled: API key not set");
  }

  const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

  try {
    const res = await tvly.search(searchRequest.query, {
      topic: searchRequest.topic,
      searchDepth: searchRequest.searchDepth,
      maxResults: searchRequest.maxResults,
      autoParameters: true,
      includeAnswer: true,
      includeRawContent: "text",
      chunksPerSource: 1,
      country: searchRequest.country ? searchRequest.country.toLowerCase() : undefined,
      maxTokens: searchRequest.maxTokens || 1000,
    });

    return res || [];
  } catch (error) {
    console.error("Search failed:", error);
    return {} as TavilySearchResponse;
  }
}

export { performSearch };
