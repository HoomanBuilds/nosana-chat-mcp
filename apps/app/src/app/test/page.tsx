"use client";
import { useState } from "react";
import DummyGpuFrontend from "./GPUpage";

const DEEPSEEK_API = "https://2w2cbpkkt6qcamfe16ujtnkkgchqqah53jhl8bwnamnd.node.k8s.prd.nos.ci/v1/chat/completions";

export default function NosanaDashboard() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(DEEPSEEK_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "DeepSeek-R1-Distill-Qwen-1.5B",
          messages: [...messages, userMsg],
          stream: false,
        }),
      });
      const data = await res.json();

      const reply =
        data?.choices?.[0]?.message?.content ||
        "[No response or invalid response from DeepSeek]";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `[Error fetching response: ${err}]` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col md:flex-row w-full h-screen bg-zinc-900 text-gray-200">
      <div className="flex flex-col w-2xl border-r border-zinc-700 h-full">
        <div className="p-4 border-b border-zinc-700 text-lg font-semibold">
          DeepSeek Chat (Nosana Node)
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-gray-500 text-center italic mt-10">
              No messages yet. Type below to start chatting.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-3 rounded-md max-w-[90%] ${
                msg.role === "user"
                  ? "bg-blue-600 text-white ml-auto"
                  : "bg-zinc-800 text-gray-100"
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-zinc-700 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-gray-200 focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className={`px-4 py-2 rounded-md font-semibold ${
              loading
                ? "bg-blue-800 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {loading ? "..." : "Send"}
          </button>
              </div>
              

              
      </div>

      <div className="w-full overflow-y-auto">
        <DummyGpuFrontend />
      </div>
    </div>
  );
}
