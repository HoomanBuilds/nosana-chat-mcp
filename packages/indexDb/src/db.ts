import { ChatDBInterface, Message, ThreadSummary } from "./types.js";

export class ChatDB implements ChatDBInterface {
  private static instance: ChatDB;
  private dbPromise: Promise<IDBDatabase>;

  private constructor() {
    this.dbPromise = this.openDB();
  }

  static getInstance(): ChatDB {
    if (!ChatDB.instance) {
      ChatDB.instance = new ChatDB();
    }
    return ChatDB.instance;
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("ChatAppDB", 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("threads")) {
          db.createObjectStore("threads", { keyPath: "thread_id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addChat(
    thread_id: string,
    message: {
      role: "user" | "model";
      content: string;
      id?: string;
      collapsed?: boolean;
      timestamp?: number;
      reasoning?: string;
      search?: { url: string; title: string }[];
      model?: string;
      responseTime?: number;
      followUps?: { question: string }[];
      type?: "message" | "error" | "aborted";
      query?: string
    }
  ) {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("threads", "readwrite");
      const store = tx.objectStore("threads");

      const getReq = store.get(thread_id);
      getReq.onsuccess = () => {
        const thread = getReq.result || { thread_id, messages: [] };
        thread.messages.push({
          id: message?.id || crypto.randomUUID(),
          role: message?.role,
          content: message?.content,
          reasoning: message?.reasoning || undefined,
          search: message?.search || undefined,
          timestamp: Date.now(),
          collapsed: message?.collapsed || undefined,
          model: message?.model || undefined,
          followUps: message?.followUps || undefined,
          responseTime: message?.responseTime || undefined,
          type: message?.type ?? "message",
          query: message?.query ?? undefined
        });
        store.put(thread);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getThread(thread_id: string): Promise<Message[]> {
    const db = await this.dbPromise;
    return new Promise<Message[]>((resolve, reject) => {
      const tx = db.transaction("threads", "readonly");
      const store = tx.objectStore("threads");
      const req = store.get(thread_id);

      req.onsuccess = () => resolve(req.result?.messages || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getHistory(): Promise<ThreadSummary[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("threads", "readonly");
      const store = tx.objectStore("threads");
      const req = store.getAll();

      req.onsuccess = () => {
        const threads = req.result || [];
        resolve(
          threads.map((t: any) => ({
            thread_id: t.thread_id,
            count: t.messages.length,
            thread_title: t?.title || t?.messages[0]?.content,
            lastUpdated:
              t.messages.length > 0
                ? t.messages[t.messages.length - 1].timestamp
                : undefined,
            tool: t?.tool || undefined,
          }))
        );
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteThread(thread_id: string) {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("threads", "readwrite");
      tx.objectStore("threads").delete(thread_id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAll() {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("threads", "readwrite");
      tx.objectStore("threads").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateThread(thread_id: string, title: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("threads", "readwrite");
      const store = tx.objectStore("threads");
      const req = store.get(thread_id);

      req.onsuccess = () => {
        const thread = req.result;
        if (thread) {
          thread.title = title;
          const updateReq = store.put(thread);
          updateReq.onerror = () => reject(updateReq.error);
        }
      };

      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateThreadTool(thread_id: string, tool: "deployer" | undefined): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("threads", "readwrite");
      const store = tx.objectStore("threads");
      const req = store.get(thread_id);

      req.onsuccess = () => {
        const thread = req.result;
        if (thread) {
          thread.tool = tool;
          const updateReq = store.put(thread);
          updateReq.onerror = () => reject(updateReq.error);
        } else {
          // Create new thread with tool
          const newThread = {
            thread_id,
            messages: [],
            tool,
          };
          const createReq = store.put(newThread);
          createReq.onerror = () => reject(createReq.error);
        }
      };

      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteChatDuo(thread_id: string, chat_id: string) {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("threads", "readwrite");
      const store = tx.objectStore("threads");

      const req = store.get(thread_id);
      req.onsuccess = () => {
        const thread = req.result;
        if (!thread) return resolve();

        const idx = thread.messages.findIndex(
          (msg: Message) => msg.id === chat_id
        );
        if (idx === -1) return resolve();

        const start =
          idx > 0 && thread.messages[idx - 1].role === "user" ? idx - 1 : idx;
        thread.messages.splice(start, idx - start + 1);

        store.put(thread);
      };

      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteChat(thread_id: string, chat_id: string) {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("threads", "readwrite");
      const store = tx.objectStore("threads");

      const req = store.get(thread_id);
      req.onsuccess = () => {
        const thread = req.result;
        if (!thread) return resolve();

        thread.messages = thread.messages.filter(
          (msg: Message) => msg.id !== chat_id
        );
        store.put(thread);
      };

      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async exportThread(thread_id: string): Promise<Blob> {
    const messages = await this.getThread(thread_id);

    const history = await this.getHistory();
    const threadSummary = history.find(t => t.thread_id === thread_id);
    const thread_title = threadSummary?.thread_title ?? "Chat";

    const threadData = [{ thread_id, thread_title, messages }];
    return new Blob([JSON.stringify(threadData, null, 2)], { type: "application/json" });
  }

  async exportAllThreads(): Promise<Blob> {
    const db = await this.dbPromise;
    const tx = db.transaction("threads", "readonly");
    const store = tx.objectStore("threads");

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const allData = req.result || [];
        resolve(new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" }));
      };
      req.onerror = () => reject(req.error);
    });
  }

  static downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async downloadMessage(thread_id: string, message_id: string, type: "single" | "duo") {
    const db = await this.dbPromise;
    const tx = db.transaction("threads", "readonly");
    const store = tx.objectStore("threads");

    const thread: any = await new Promise((resolve, reject) => {
      const req = store.get(thread_id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (!thread) throw new Error("Thread not found");

    let messagesToExport: Message[] = [];

    if (type === "single") {
      const msg = thread.messages.find((m: Message) => m.id === message_id);
      if (!msg) throw new Error("Message not found");
      messagesToExport.push(msg);
    } else if (type === "duo") {
      const idx = thread.messages.findIndex((m: Message) => m.id === message_id);
      if (idx === -1) throw new Error("Message not found");
      const startIdx = idx > 0 && thread.messages[idx - 1].role === "user" ? idx - 1 : idx;
      messagesToExport = thread.messages.slice(startIdx, idx + 1);
    } else {
      throw new Error("Invalid type");
    }

    return new Blob([JSON.stringify([{ thread_id, thread_title: thread.thread_title, messages: messagesToExport }], null, 2)], { type: "application/json" });
  }

  async importThreads(blob: Blob) {
    const text = await blob.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error("Invalid JSON file");
    }

    if (!Array.isArray(data)) {
      data = [data];
    }

    const db = await this.dbPromise;
    const tx = db.transaction("threads", "readwrite");
    const store = tx.objectStore("threads");

    for (const thread of data) {
      if (!thread.thread_id || !thread.messages) continue;

      const existingReq = store.get(thread.thread_id);
      existingReq.onsuccess = () => {
        const existing = existingReq.result;
        if (existing) {
          // Merge messages (avoid duplicates by id)
          const existingIds = new Set(existing.messages.map((m: any) => m.id));
          const mergedMessages = [
            ...existing.messages,
            ...thread.messages.filter((m: any) => !existingIds.has(m.id)),
          ];
          store.put({ ...thread, messages: mergedMessages });
        } else {
          store.put(thread);
        }
      };
    }

    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }


  async importThreadsNonReplace(blob: Blob) {
    const text = await blob.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON file");
    }

    if (!Array.isArray(data)) {
      data = [data];
    }

    const db = await this.dbPromise;
    const tx = db.transaction("threads", "readwrite");
    const store = tx.objectStore("threads");

    for (const thread of data) {
      if (!thread.thread_id || !thread.messages) continue;

      const normalized = {
        ...thread,
        title: thread.title ?? thread.thread_title ?? "",
      };

      const existingReq = store.get(thread.thread_id);
      existingReq.onsuccess = () => {
        const existing = existingReq.result;

        if (existing) {
          const existingIds = new Set(existing.messages.map((m: any) => m.id));
          const newMessages = normalized.messages.filter(
            (m: any) => !existingIds.has(m.id)
          );
          const mergedMessages = [...existing.messages, ...newMessages];

          store.put({
            ...existing,
            ...normalized,
            messages: mergedMessages,
          });
        } else {
          store.put(normalized);
        }
      };
    }

    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }


  async clearAllThreads() {
    const db = await this.dbPromise;
    const tx = db.transaction("threads", "readwrite");
    const store = tx.objectStore("threads");

    store.clear();

    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
