'use client'
import { useState } from 'react';

export default function ChatApp() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState('');

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input) return;
    setMessages(prev => [...prev, input]);
    setInput('');
  };

  return (
    <div>
      <div className="h-64 overflow-y-auto p-2 border rounded mb-2">
        {messages.map((msg, idx) => (
          <div key={idx} className="p-1 my-1 bg-gray-100 rounded">{msg}</div>
        ))}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 border rounded p-2"
          placeholder="Type your message..."
        />
        <button type="submit" className="p-2 bg-black text-white rounded">Send</button>
      </form>
    </div>
  );
}
