import { ChatMessage } from "../types";
import { estimateTokenCount } from "tokenx";

type ContextCutterOptions = {
  maxTokens?: number;
  absoluteMaxTokens?: number;
  minChats?: number;
  truncateFrom?: "start" | "end";
};

// Cache for token counts to avoid re-calculating
const tokenCache = new Map<string, number>();
const MAX_CACHE_SIZE = 1000;

function getCachedTokenCount(content: string | undefined): number {
  const str = content ?? "";
  if (str === "") return 0;

  // Use string hash as key for cache
  const key = str.length > 100 ? str.slice(0, 100) + str.length : str;
  if (tokenCache.has(key)) {
    return tokenCache.get(key)!;
  }

  const count = estimateTokenCount(str);

  // Simple LRU: clear cache if too large
  if (tokenCache.size >= MAX_CACHE_SIZE) {
    const firstKey = tokenCache.keys().next().value;
    if (firstKey) tokenCache.delete(firstKey);
  }

  tokenCache.set(key, count);
  return count;
}

export class ContextCutter {
  static getRecentConversations(
    chats: ChatMessage[],
    options: ContextCutterOptions = {},
  ): ChatMessage[] {
    const maxTokens = options.maxTokens ?? 500;
    const absoluteMaxTokens = options.absoluteMaxTokens ?? 2000;
    const minChats = options.minChats ?? 4;
    const truncateFrom = options.truncateFrom ?? "start";

    const countTokens = getCachedTokenCount;

    let selected: ChatMessage[] = [];
    let totalTokens = 0;

    for (let i = chats.length - 1; i >= 0; i--) {
      const chatTokens = countTokens(chats[i].content);
      if (totalTokens + chatTokens <= maxTokens || selected.length < minChats) {
        selected.unshift(chats[i]);
        totalTokens += chatTokens;
      } else {
        break;
      }
    }

    while (selected.length < minChats && selected.length < chats.length) {
      selected.unshift(chats[chats.length - selected.length - 1]);
    }

    totalTokens = selected.reduce((sum, c) => sum + countTokens(c.content), 0);
    if (totalTokens > absoluteMaxTokens) {
      const cropPerChat = Math.floor(absoluteMaxTokens / selected.length);
      selected = selected.map((chat) => {
        const tokens = countTokens(chat.content);
        if (tokens > cropPerChat) {
          const chars = cropPerChat * 4;
          if (truncateFrom === "end") {
            return {
              ...chat,
              content: chat.content.slice(0, chars) + " ...[truncated]",
            };
          } else {
            return {
              ...chat,
              content: "...[truncated] " + chat.content.slice(-chars),
            };
          }
        }
        return chat;
      });
    }

    return selected;
  }
}
