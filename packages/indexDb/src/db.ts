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
      const request = indexedDB.open("ChatAppDB", 2);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const transaction = request.transaction;

        if (!db.objectStoreNames.contains("threads")) {
          db.createObjectStore("threads", { keyPath: "thread_id" });
        }

        if (!db.objectStoreNames.contains("messages")) {
          const messageStore = db.createObjectStore("messages", { keyPath: "id" });
          messageStore.createIndex("thread_id", "thread_id", { unique: false });
        }

        if (event.oldVersion === 1) {
          // Migrate v1 nested arrays into the new independent relation map
          if (transaction) {
            const threadStore = transaction.objectStore("threads");
            const messageStore = transaction.objectStore("messages");

            threadStore.openCursor().onsuccess = (e) => {
              const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
              if (cursor) {
                const thread = cursor.value;
                const msgs = thread.messages || [];

                for (const msg of msgs) {
                  msg.thread_id = thread.thread_id;
                  if (!msg.id) msg.id = crypto.randomUUID();
                  messageStore.put(msg);
                }
                delete thread.messages;
                thread.count = msgs.length;
                cursor.update(thread);
                cursor.continue();
              }
            };
          }
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addChat(
    thread_id: string,
    message: Partial<Message>
  ) {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["threads", "messages"], "readwrite");
      const threadStore = tx.objectStore("threads");
      const messageStore = tx.objectStore("messages");

      const msgObj = {
        ...message,
        id: message.id || crypto.randomUUID(),
        role: message.role || "user",
        content: message.content || "",
        thread_id,
        timestamp: message.timestamp || Date.now(),
        type: message.type || "message",
      };

      messageStore.put(msgObj);

      const getReq = threadStore.get(thread_id);
      getReq.onsuccess = () => {
        const thread = getReq.result || { thread_id, count: 0, lastUpdated: Date.now() };
        thread.lastUpdated = msgObj.timestamp;
        thread.count = (thread.count || 0) + 1;

        if (!thread.title && msgObj.role === "user") {
          thread.title = msgObj.content.substring(0, 30);
        }

        threadStore.put(thread);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getThread(thread_id: string): Promise<Message[]> {
    const db = await this.dbPromise;
    return new Promise<Message[]>((resolve, reject) => {
      const tx = db.transaction("messages", "readonly");
      const index = tx.objectStore("messages").index("thread_id");
      const req = index.getAll(thread_id);

      req.onsuccess = () => {
        const msgs = req.result || [];
        msgs.sort((a, b) => a.timestamp - b.timestamp);
        resolve(msgs as Message[]);
      };
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
        const mapped = threads.map((t: any) => ({
          thread_id: t.thread_id,
          count: t.count || 0,
          thread_title: t.title,
          lastUpdated: t.lastUpdated,
          tool: t.tool || undefined,
        }));

        mapped.sort((a: any, b: any) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
        resolve(mapped);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteThread(thread_id: string) {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["threads", "messages"], "readwrite");
      tx.objectStore("threads").delete(thread_id);

      const index = tx.objectStore("messages").index("thread_id");
      const range = IDBKeyRange.only(thread_id);
      index.openKeyCursor(range).onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursor>).result;
        if (cursor) {
          tx.objectStore("messages").delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAll() {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["threads", "messages"], "readwrite");
      tx.objectStore("threads").clear();
      tx.objectStore("messages").clear();
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
          store.put(thread);
        }
      };

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
          store.put(thread);
        } else {
          store.put({ thread_id, tool, count: 0, lastUpdated: Date.now() });
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteChatDuo(thread_id: string, chat_id: string) {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["threads", "messages"], "readwrite");
      const messageStore = tx.objectStore("messages");
      const threadStore = tx.objectStore("threads");

      const index = messageStore.index("thread_id");
      const req = index.getAll(thread_id);

      req.onsuccess = () => {
        const msgs = req.result || [];
        msgs.sort((a: any, b: any) => a.timestamp - b.timestamp);

        const idx = msgs.findIndex((m: any) => m.id === chat_id);
        if (idx === -1) return;

        const start = idx > 0 && msgs[idx - 1].role === "user" ? idx - 1 : idx;
        const idsToDelete = msgs.slice(start, idx + 1).map((m: any) => m.id);

        for (const id of idsToDelete) {
          messageStore.delete(id);
        }

        const threadReq = threadStore.get(thread_id);
        threadReq.onsuccess = () => {
          const thread = threadReq.result;
          if (thread) {
            thread.count = Math.max(0, (thread.count || 0) - idsToDelete.length);
            threadStore.put(thread);
          }
        };
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteChat(thread_id: string, chat_id: string) {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["threads", "messages"], "readwrite");
      const messageStore = tx.objectStore("messages");
      const threadStore = tx.objectStore("threads");

      messageStore.delete(chat_id);

      const req = threadStore.get(thread_id);
      req.onsuccess = () => {
        const thread = req.result;
        if (thread) {
          thread.count = Math.max(0, (thread.count || 1) - 1);
          threadStore.put(thread);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async exportThread(thread_id: string): Promise<Blob> {
    const messages = await this.getThread(thread_id);
    const history = await this.getHistory();
    const threadSummary = history.find(t => t.thread_id === thread_id);
    const thread_title = threadSummary?.thread_title ?? "Chat";

    const threadData = [{ thread_id, thread_title, title: thread_title, tool: threadSummary?.tool, messages }];
    return new Blob([JSON.stringify(threadData, null, 2)], { type: "application/json" });
  }

  async exportAllThreads(): Promise<Blob> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["threads", "messages"], "readonly");
      const threadStore = tx.objectStore("threads");
      const messageStore = tx.objectStore("messages");
      const index = messageStore.index("thread_id");

      const allData: any[] = [];
      const threadReq = threadStore.getAll();

      threadReq.onsuccess = () => {
        const threads = threadReq.result || [];
        let pending = threads.length;

        if (pending === 0) {
          return resolve(new Blob([JSON.stringify([], null, 2)], { type: "application/json" }));
        }

        threads.forEach((t: any) => {
          const msgReq = index.getAll(t.thread_id);
          msgReq.onsuccess = () => {
            const msgs = msgReq.result || [];
            msgs.sort((a: any, b: any) => a.timestamp - b.timestamp);
            allData.push({
              thread_id: t.thread_id,
              thread_title: t.title,
              title: t.title,
              tool: t.tool,
              messages: msgs
            });
            pending--;
            if (pending === 0) {
              resolve(new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" }));
            }
          };
          msgReq.onerror = () => {
            pending--;
            if (pending === 0) resolve(new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" }));
          };
        });
      };
      threadReq.onerror = () => reject(threadReq.error);
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
    const messages = await this.getThread(thread_id);
    if (!messages.length) throw new Error("Thread not found");

    let messagesToExport: Message[] = [];
    if (type === "single") {
      const msg = messages.find((m: Message) => m.id === message_id);
      if (!msg) throw new Error("Message not found");
      messagesToExport.push(msg);
    } else if (type === "duo") {
      const idx = messages.findIndex((m: Message) => m.id === message_id);
      if (idx === -1) throw new Error("Message not found");
      const startIdx = idx > 0 && messages[idx - 1]!.role === "user" ? idx - 1 : idx;
      messagesToExport = messages.slice(startIdx, idx + 1);
    } else {
      throw new Error("Invalid type");
    }

    const history = await this.getHistory();
    const threadSummary = history.find(t => t.thread_id === thread_id);

    return new Blob([JSON.stringify([{ thread_id, thread_title: threadSummary?.thread_title || "Chat", messages: messagesToExport }], null, 2)], { type: "application/json" });
  }

  async importThreads(blob: Blob) {
    const text = await blob.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error("Invalid JSON file");
    }

    if (!Array.isArray(data)) data = [data];

    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["threads", "messages"], "readwrite");
      const threadStore = tx.objectStore("threads");
      const messageStore = tx.objectStore("messages");

      for (const thread of data) {
        if (!thread.thread_id || !thread.messages) continue;

        threadStore.put({
          thread_id: thread.thread_id,
          title: thread.title ?? thread.thread_title ?? "",
          count: thread.messages.length,
          lastUpdated: Date.now(),
          tool: thread.tool
        });

        for (const msg of thread.messages) {
          msg.thread_id = thread.thread_id;
          if (!msg.id) msg.id = crypto.randomUUID();
          messageStore.put(msg);
        }
      }

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

    if (!Array.isArray(data)) data = [data];

    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["threads", "messages"], "readwrite");
      const threadStore = tx.objectStore("threads");
      const messageStore = tx.objectStore("messages");

      for (const thread of data) {
        if (!thread.thread_id || !thread.messages) continue;

        const req = threadStore.get(thread.thread_id);
        req.onsuccess = () => {
          const existing = req.result;
          threadStore.put({
            thread_id: thread.thread_id,
            title: thread.title ?? thread.thread_title ?? (existing?.title || ""),
            count: Math.max(existing?.count || 0, thread.messages.length),
            lastUpdated: Date.now(),
            tool: thread.tool || existing?.tool
          });

          for (const msg of thread.messages) {
            msg.thread_id = thread.thread_id;
            messageStore.put(msg);
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAllThreads() {
    return this.clearAll();
  }
}
