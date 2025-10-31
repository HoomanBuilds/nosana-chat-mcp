
export interface AIContext {
    absoluteMaxTokens?: number;
    maxContextTokens?: number;
    prevChatLimit?: number;
    truncateFrom?: "start" | "end";
}

export interface AIConfig {
    temperature: number;
    max_tokens: number;
    top_p: number;
    presence_penalty: number;
    frequency_penalty: number;
    stop: string[];
    context: AIContext;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
    temperature: 0.7,
    max_tokens: 1000,
    top_p: 1,
    presence_penalty: 0,
    frequency_penalty: 0,
    stop: [],
    context: {
        absoluteMaxTokens: 6000,
        maxContextTokens: 3000,
        prevChatLimit: 6,
        truncateFrom: "end",
    },
};


export const DEFAULT_LOCAL_SETTINGS = {
  show_error_messages: false,
  appearance: "dark" as "dark" | "light",
  follow_up: true,
}


export const DEFAULT = {
    MODEL : "self/qwen3:0.6b"
}

export const DEFAULT_DEPLOYER = {
    VALUES: {
        NOS_USD: 0.48,
        SOL_USD: 191,
    }
}