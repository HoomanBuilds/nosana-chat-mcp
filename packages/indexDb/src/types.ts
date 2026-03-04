export interface Message {
  id: string;
  thread_id?: string;
  role: "user" | "model";
  content: string;
  timestamp: number;
  reasoning?: string;
  search?: { url: string; title: string; content?: string }[];
  model?: string;
  collapsed?: boolean;
  responseTime?: number;
  followUps?: { question: string }[];
  type?: "message" | "error" | "aborted";
  query?: string;
}

export interface Thread {
  thread_id: string;
  title?: string;
  lastUpdated?: number;
  tool?: "deployer";
  count?: number;
}

export interface ChatDBInterface {
  addChat(thread_id: string, message: Partial<Message>): Promise<void>;
  getThread(thread_id: string): Promise<Message[]>;
  getHistory(): Promise<ThreadSummary[]>;
  deleteThread(thread_id: string): Promise<void>;
  clearAll(): Promise<void>;
  updateThread(thread_id: string, title: string): Promise<void>;
  updateThreadTool(thread_id: string, tool: "deployer" | undefined): Promise<void>;
  deleteChatDuo(thread_id: string, chat_id: string): Promise<void>;
  deleteChat(thread_id: string, chat_id: string): Promise<void>;
  exportThread(thread_id: string): Promise<Blob>;
  exportAllThreads(): Promise<Blob>;
  downloadMessage(thread_id: string, message_id: string, type: "single" | "duo"): Promise<Blob>;
}

export interface ThreadSummary {
  thread_id: string;
  count: number;
  lastUpdated?: number;
  thread_title?: string;
  tool?: "deployer";
}