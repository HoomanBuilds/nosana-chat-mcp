export enum ChatMode {
  Deep = "deep",
  Pro = "pro-search",
  GEMINI_2_5_FLASH = "gemini-2.5-flash",
  GEMINI_2_5_PRO = "gemini-2.5-pro",
  GEMINI_2_FLASH = "gemini-2.0-flash",
  GEMINI_2_FLASH_LITE = "gemini-2.0-flash-lite",
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
  [ChatMode.GEMINI_2_FLASH]: {
    search: false,
    auth: false,
    thinking: true,
    retry: true,
  },
  [ChatMode.GEMINI_2_5_FLASH]: {
    search: false,
    thinking: true,
    auth: false,
    retry: true,
  },
  [ChatMode.GEMINI_2_5_PRO]: {
    search: false,
    thinking: false,
    auth: true,
    retry: true,
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
  [ChatMode.GEMINI_2_FLASH_LITE]: {
    search: false,
    auth: false,
    thinking: true,
    retry: true,
  }
};

export const CHAT_MODE_CREDIT_COSTS = {
  [ChatMode.Deep]: 15,
  [ChatMode.Pro]: 8,
  [ChatMode.GEMINI_2_5_PRO]: 4,
  [ChatMode.GEMINI_2_FLASH]: 1,
  [ChatMode.GEMINI_2_5_FLASH]: 2,
  [ChatMode.ZERO]: 1,
  [ChatMode.AUTO]: 1,
  [ChatMode.qwen3]: 0,
  [ChatMode.GEMINI_2_FLASH_LITE]: 1,
};
