import { create } from "zustand";
import { ChatDB } from "@nosana-chat/indexdb";

let chatDB: ChatDB | null = null;
const getChatDB = () => {
  if (!chatDB) chatDB = ChatDB.getInstance();
  return chatDB;
};

export interface PermissionRequest {
  toolName: string;
  args: Record<string, any>;
  onAllow: () => void;
  onDeny: () => void;
}
export interface Conversation {
  role: "user" | "model";
  query?: string;
  content: string;
  reasoning?: string;
  search?: { url: string; title: string; content?: string }[];
  id?: string;
  timestamp?: number;
  model?: string;
  collapsed?: boolean;
  responseTime?: number;
  followUps?: { question: string }[];
  type?: "message" | "error" | "aborted";
}

export interface ChatHistory {
  thread_id: string;
  count: number;
  lastUpdated?: number;
  thread_title?: string;
  pinned?: boolean;
  tool?: "deployer";
}

export interface PermissionItem {
  id: string;
  toolName: string;
  args: Record<string, any>;
  status: "pending" | "allowed" | "denied";
}

interface PendingTool {
  funcName: string;
  prompt: any;
  heading: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface IChatStore {
  search: boolean;
  setSearch: (val: boolean) => void;

  _mcp: boolean;
  _setMcp: (val: boolean) => void;

  tool: "deployer" | undefined;
  setTool: (val: "deployer" | undefined) => void;

  thinking: boolean;
  setThinking: (val: boolean) => void;

  searchResult: { url: string; title: string; content?: string }[];
  setSearchResult: (result: {
    url: string;
    title: string;
    content?: string;
  }) => void;

  selectedModel: string | undefined;
  setSelectedModel: (model: string | undefined) => void;

  selectedChatId: string | null;
  setSelectedChatId: (id: string | null) => void;

  currentChat: Conversation[];
  setCurrentChat: (chat: Conversation[]) => void;
  addMessage: (message: Conversation) => Promise<void>;
  addMessages: (messages: Conversation[]) => Promise<void>;

  chatHistory: ChatHistory[];
  setChatHistory: (history: ChatHistory[]) => void;
  loadChatHistory: () => Promise<void>;
  loadCurrentChat: (thread_id: string) => Promise<void>;

  deletethread: (thread_id: string) => Promise<void>;
  updateThreadTitle: (thread_id: string, title: string) => Promise<void>;
  updateThreadTool: (thread_id: string, tool: "deployer" | undefined) => Promise<void>;

  deleteChat: (thread_id: string, chatid: string) => Promise<void>;
  deleteSingleChat: (thread_id: string, chatid: string) => Promise<void>;

  exportThread: (thread_id: string) => Promise<void>;
  exportAllThreads: () => Promise<void>;
  importThreads: (blob: Blob) => Promise<void>;

  downloadMessage: (
    message_id: string,
    type: "single" | "duo"
  ) => Promise<void>;
  clearAll: () => Promise<void>;

  followUp: { question: string }[];
  setFollowUp: (followUp: { question: string }[]) => void;

  pendingPermission: PermissionRequest | null;
  setPendingPermission: (perm: PermissionRequest | null) => void;
  clearPendingPermission: () => void;

  pendingTool: PendingTool | null;
  setPendingTool: (tool: PendingTool | null) => void;

  pendingQuery: string | null;
  setPendingQuery: (query: string | null) => void;
  clearPendingQuery: () => void;
}

export const useChatStore = create<IChatStore>((set, get) => ({
  search: false,
  setSearch: (val) => set({ search: val }),

  thinking: false,
  setThinking: (val) => set({ thinking: val }),

  _mcp: false,
  _setMcp: (val) => set({ _mcp: val }),

  tool: undefined,
  setTool: (val) => set({ tool: val }),

  selectedChatId: null,
  setSelectedChatId: (id) => {
    set({ selectedChatId: id });
    if (id) get().loadCurrentChat(id);
  },

  selectedModel: undefined,
  setSelectedModel: (model) => set({ selectedModel: model }),

  searchResult: [],
  setSearchResult: (result) =>
    set({ searchResult: [...get().searchResult, result] }),

  currentChat: [],
  setCurrentChat: (chat) => set({ currentChat: chat }),

  addMessage: async (message) => {
    const threadId = get().selectedChatId;
    if (!threadId) return;
    set({ currentChat: [...get().currentChat, message] });
    await getChatDB().addChat(threadId, message);
  },

  addMessages: async (messages: Conversation[]) => {
    const threadId = get().selectedChatId;
    if (!threadId) return;
    set({ currentChat: [...get().currentChat, ...messages] });
    await Promise.all(
      messages.map((msg) => getChatDB().addChat(threadId, msg))
    );
  },

  chatHistory: [],
  setChatHistory: (history) => set({ chatHistory: history }),

  loadChatHistory: async () => {
    const history = await getChatDB().getHistory();
    set({ chatHistory: history });
  },

  loadCurrentChat: async (thread_id: string) => {
    const messages = await getChatDB().getThread(thread_id);
    set({ currentChat: messages });
  },

  deletethread: async (thread_id: string) => {
    await getChatDB().deleteThread(thread_id);
    await get().loadChatHistory();
  },

  updateThreadTitle: async (thread_id: string, title: string) => {
    await getChatDB().updateThread(thread_id, title);
    await get().loadChatHistory();
  },

  updateThreadTool: async (thread_id: string, tool: "deployer" | undefined) => {
    await getChatDB().updateThreadTool(thread_id, tool);
    await get().loadChatHistory();
  },

  deleteChat: async (thread_id: string, chatid: string) => {
    await getChatDB().deleteChatDuo(thread_id, chatid);
    await get().loadCurrentChat(thread_id);
  },

  deleteSingleChat: async (thread_id: string, chatid: string) => {
    await getChatDB().deleteChat(thread_id, chatid);
    await get().loadCurrentChat(thread_id);
  },

  exportThread: async (thread_id: string) => {
    const blob = await getChatDB().exportThread(thread_id);
    ChatDB.downloadBlob(blob, `thread.${thread_id}.json`);
  },

  exportAllThreads: async () => {
    const blob = await getChatDB().exportAllThreads();
    ChatDB.downloadBlob(blob, "all_threads.json");
  },

  importThreads: async (blob: Blob) => {
    await getChatDB().importThreadsNonReplace(blob);
    await get().loadChatHistory();
  },

  downloadMessage: async (message_id: string, type: "single" | "duo") => {
    if (!get().selectedChatId) return;
    const threadId = get().selectedChatId as string;
    const blob = await getChatDB().downloadMessage(threadId, message_id, type);
    ChatDB.downloadBlob(blob, `message_${message_id.substring(0, 6)}.json`);
  },

  clearAll: async () => {
    await getChatDB().clearAllThreads();
    await get().loadChatHistory();
  },

  followUp: [],
  setFollowUp: (followUp) => set({ followUp: followUp }),

  pendingPermission: null,
  setPendingPermission: (perm) => set({ pendingPermission: perm }),
  clearPendingPermission: () => set({ pendingPermission: null }),

  pendingTool: null,
  setPendingTool: (tool) => set({ pendingTool: tool }),

  pendingQuery: null,
  setPendingQuery: (query) => set({ pendingQuery: query }),
  clearPendingQuery: () => set({ pendingQuery: null }),
}));
