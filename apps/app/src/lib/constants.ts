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
};

export const DEFAULT = {
  MODEL: "self/inferiallm",
};

export const DEFAULT_DEPLOYER = {
  VALUES: {
    NOS_USD: 0.48,
    SOL_USD: 191,
  },
};

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export const CONFIG = {
  NOSANA_API_BASE: "https://dashboard.k8s.prd.nos.ci/api",
  INFERIA_LLM_URL: getEnvVar(
    "NEXT_PUBLIC_INFERIA_LLM_URL",
    "https://api.inferia.ai/v1",
  ),
  EXPLORER_URL: "https://dashboard.nosana.com",
  NODE_DOMAIN: {
    mainnet: "node.k8s.prd.nos.ci",
    devnet: "node.k8s.dev.nos.ci",
  },
  NETWORKS: {
    MAINNET: "mainnet",
    DEVNET: "devnet",
  },
} as const;
