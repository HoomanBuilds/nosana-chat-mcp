import { ChatMessage } from "../types";

type ContextCutterOptions = {
    maxTokens?: number;
    absoluteMaxTokens?: number;
    minChats?: number;
    truncateFrom?: "start" | "end";
};

export class ContextCutter {
    static getRecentConversations(chats: ChatMessage[], options: ContextCutterOptions = {}): ChatMessage[] {
        const maxTokens = options.maxTokens ?? 500;
        const absoluteMaxTokens = options.absoluteMaxTokens ?? 2000;
        const minChats = options.minChats ?? 4;
        const truncateFrom = options.truncateFrom ?? "start";

        const countTokens = (str: string) => Math.ceil(str.length / 4);

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
            selected = selected.map(chat => {
                const tokens = countTokens(chat.content);
                if (tokens > cropPerChat) {
                    const chars = cropPerChat * 4;
                    if (truncateFrom === "end") {
                        return { 
                            ...chat, 
                            content: chat.content.slice(0, chars) + " ...[truncated]" 
                        };
                    } else {
                        return { 
                            ...chat, 
                            content: "...[truncated] " + chat.content.slice(-chars) 
                        };
                    }
                }
                return chat;
            });
        }

        return selected;
    }
}
