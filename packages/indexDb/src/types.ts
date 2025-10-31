export interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: number;
}

export interface Thread {
  thread_id: string;
  messages: Message[];
  title?: string;
  lastUpdated?: number;
  tool?: "deployer";
}

export interface ChatDBInterface {
  addChat(thread_id: string, message: Omit<Message, "timestamp" | "id"> & { id?: string }): Promise<void>;
  getThread(thread_id: string): Promise<Message[]>;
  getHistory(): Promise<{ thread_id: string; count: number; lastUpdated?: number; tool?: "deployer" }[]>;
  deleteThread(thread_id: string): Promise<void>;
  clearAll(): Promise<void>;
  updateThread(thread_id: string, title: string): Promise<void>;
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