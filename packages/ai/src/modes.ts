export enum ChatMode {
  Deep = "deep",
  Pro = "pro-search",
  ZERO = "zero",
  AUTO = "auto",
  qwen3 = "qwen3:0.6b",
}

export const ChatModeConfig: Record<
  ChatMode,
  {
    search: boolean;
    retry: boolean;
    isNew?: boolean;
    auth?: boolean;
    thinking?: boolean;
  }
> = {
  [ChatMode.Deep]: {
    search: false,
    retry: false,
    auth: true,
    thinking: false,
  },
  [ChatMode.Pro]: {
    search: false,
    retry: false,
    thinking: false,
    auth: true,
  },
  [ChatMode.ZERO]: {
    search: false,
    thinking: false,
    auth: false,
    retry: true,
  },
  [ChatMode.AUTO]: {
    thinking: true,
    search: false,
    auth: false,
    retry: true,
  },
  [ChatMode.qwen3]: {
    thinking: false,
    search: false,
    auth: false,
    retry: true,
  },
};

export const CHAT_MODE_CREDIT_COSTS = {
  [ChatMode.Deep]: 15,
  [ChatMode.Pro]: 8,
  [ChatMode.ZERO]: 1,
  [ChatMode.AUTO]: 1,
  [ChatMode.qwen3]: 0,
};
