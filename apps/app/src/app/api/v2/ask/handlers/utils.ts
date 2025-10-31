import { ChatMessage } from "@/lib/types";
import { ContextCutter } from "@/lib/utils/ContextCutter";
import { Gemini } from "@nosana-chat/ai";
import { StreamThrottleConfig, type PromptMode } from "./types";
import { Payload } from "@/lib/utils/validation";

export const trimMessage = (content: string, maxTokens = 1000) => {
  const words = content.split(/\s+/);
  if (words.length <= maxTokens) return content;
  return words.slice(0, maxTokens).join(' ');
};

export function getRecentHistory(
  messages: ChatMessage[],
  tokenLimit: number = 2000
): ChatMessage[] {
  const MIN_BOTTOM_TOKENS = 1000;
  let totalTokens = 0;
  const result: ChatMessage[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = messages[i].content.split(/\s+/).length;
    if (totalTokens + msgTokens > tokenLimit) break;

    totalTokens += msgTokens;
    result.unshift(messages[i]);
  }

  let bottomTokens = 0;
  for (let i = 0; i < messages.length; i++) {
    const msgTokens = messages[i].content.split(/\s+/).length;
    bottomTokens += msgTokens;
    if (!result.includes(messages[i])) result.unshift(messages[i]);
    if (bottomTokens >= MIN_BOTTOM_TOKENS) break;
  }

  return result;
}


export async function getThreadTitle(query: string , apiKey : string) {
  try {
    const res = await Gemini.GeminiModel("gemini-2.0-flash-lite" , apiKey).generate([
      {
        role: "user",
        content: `You are an AI model. Based on this query: "${query}", generate a short, clear, and descriptive thread title suitable to show the user. 
        Respond ONLY with the title as a string.`
      },
    ]);
    const title = res.toString()
      .trim()
      .replace(/^["“”‘']+/, '')
      .replace(/["“”‘']+$/, '');
    return title;
  } catch(err) {
    console.log("error generating thread title");
    return query.substring(0, 30);
  }
}


export async function parseStream(
  textStream: AsyncIterable<string>,
  send: (event: string, data: string) => void
) {
  let buffer = '';
  let isTool = false;
  let insideResult = false;
  let toolBuffer = '';

  const resultStartRegex = /<RESULT\b[^>]*>/i;
  const resultEndRegex = /<\/RESULT\s*>/i;
  const toolStartRegex = /<(TOOL|TOOL_CODE)\b[^>]*>/i;
  const toolEndRegex = /<\/(TOOL|TOOL_CODE)\s*>/i;


  const FULL_TAG_PREFIXES = ['<RESULT', '</RESULT', '<TOOL', '</TOOL'];

  const isPotentialTagPrefix = (s: string) => {
    const norm = s.toUpperCase().replace(/\s+/g, '');
    return FULL_TAG_PREFIXES.some(ft => ft.startsWith(norm));
  };

  for await (const chunk of textStream) {
    buffer += chunk;

    parseLoop: while (buffer.length > 0) {
      if (!insideResult && !isTool) {
        const resultMatch = buffer.match(resultStartRegex);
        const toolMatch = buffer.match(toolStartRegex);

        if (resultMatch && (!toolMatch || resultMatch.index! < toolMatch.index!)) {
          insideResult = true;
          buffer = buffer.slice(resultMatch.index! + resultMatch[0].length);
          continue parseLoop;
        } else if (toolMatch) {
          isTool = true;
          toolBuffer = '';
          buffer = buffer.slice(toolMatch.index! + toolMatch[0].length);
          continue parseLoop;
        } else {
          const lt = buffer.indexOf('<');
          if (lt === -1) {
            if (buffer) { send('llmResult', buffer); buffer = ''; }
            break parseLoop;
          }

          const suffix = buffer.slice(lt);
          if (isPotentialTagPrefix(suffix)) {
            if (lt > 0) send('llmResult', buffer.slice(0, lt));
            buffer = buffer.slice(lt);
            break parseLoop; // wait for more chunks to resolve tag
          } else {
            send('llmResult', buffer.slice(0, lt + 1));
            buffer = buffer.slice(lt + 1);
            continue parseLoop;
          }
        }
      }

      if (insideResult) {
        const endMatch = buffer.match(resultEndRegex);
        if (endMatch) {
          const endIndex = endMatch.index!;
          const resultPart = buffer.slice(0, endIndex);
          if (resultPart) send('llmResult', resultPart);
          buffer = buffer.slice(endIndex + endMatch[0].length);
          insideResult = false;
          continue parseLoop;
        } else {
          const lastLT = buffer.lastIndexOf('<');
          if (lastLT === -1) {
            if (buffer) { send('llmResult', buffer); buffer = ''; }
            break parseLoop;
          } else {
            const tail = buffer.slice(lastLT);
            if (isPotentialTagPrefix(tail)) {
              if (lastLT > 0) send('llmResult', buffer.slice(0, lastLT));
              buffer = buffer.slice(lastLT);
              break parseLoop;
            } else {
              if (buffer) { send('llmResult', buffer); buffer = ''; }
              break parseLoop;
            }
          }
        }
      }

      if (isTool) {
        const endMatch = buffer.match(toolEndRegex);
        if (endMatch) {
          toolBuffer += buffer.slice(0, endMatch.index!);
          buffer = buffer.slice(endMatch.index! + endMatch[0].length);

          const payload = toolBuffer.trim();
          try {
            const parsed = JSON.stringify(JSON.parse(payload), null, 2);
            send('llmResult', `\`\`\`json\n${parsed}\n\`\`\``);
          } catch {
            send('llmResult', `\`\`\`text\n${payload}\n\`\`\``);
          }

          toolBuffer = '';
          isTool = false;
          continue parseLoop;
        } else {
          toolBuffer += buffer;
          buffer = '';
          break parseLoop;
        }
      }
    }
  }

  if (insideResult) {
    send('error', 'Unclosed <RESULT> at stream end. Content may be incomplete.');
    if (buffer) send('llmResult', buffer);
  } else if (isTool) {
    send('error', 'Unclosed <TOOL> at stream end. TOOL content may be incomplete.');
    if (toolBuffer) send('llmResult', `\`\`\`text\n${toolBuffer}\n\`\`\``);
  } else if (buffer) {
    send('llmResult', buffer);
  }
}

const PROMPT_TEMPLATES: Record<PromptMode, { system: string | (() => string); user: string | (() => string) }> = {
  zero: {
    system: () => `
You are a detailed AI assistant. Follow instructions precisely. Answer clearly and concisely.
Always provide context if relevant. Be professional.
`,
    user: () => `
--- RECENT CONVERSATION CONTEXT ---
{recentText}

--- CURRENT QUERY ---
{query}

--- USER CUSTOM INSTRUCTIONS ---
{customPrompt}
`,
  },
  auto: {
    system: () => `
You are a highly capable AI assistant. Follow these rules strictly:
Strictly follow the <RESULT> and <TOOL> rules. Breaking format will break the system.

--- RESPONSE PROTOCOL ---
Formatting rules:
- The opening tag (<RESULT> or <TOOL>) must be followed by a newline, then the content.
- The closing tag (</RESULT> or </TOOL>) must be on its own line, directly after the content.

Valid:
<RESULT>
answer...
</RESULT>

Invalid:
<RESULT> answer...
</RESULT>

2. <TOOL> rules:
   - Use <TOOL> ONLY when the question requires truly unknown, real-time, or dynamic information.
   - Must contain only a valid JSON array.
   - Each element: { "name": string, "input": string }.
   - JSON must be strictly valid (no comments, no trailing commas, no extra text).

3. <RESULT> rules:
   - Use <RESULT> whenever the answer can be provided from general knowledge.
   - Contains only the final direct answer as plain text.
   - Keep concise, detailed, and relevant.

4. Decision rule:
   - Default to <RESULT>.
   - Only call <TOOL> for time-sensitive or external data.
   - Never output both. Never output raw JSON outside <TOOL>.

5. Consistency:
   - Format must be identical every time.

--- AVAILABLE TOOLS --- Use only when the answer is unknown, dynamic, or time-sensitive. Use minimally and only when strictly necessary, or when the user explicitly requests it.
  - search: { "query": string } , enchance search query for better search result by search providers , try to provide your own context as well as possible
  - get_relevant_conversation: { "topic": array of words/tags(only common not like all randomly they should matter) } => example : { "topic": ["Kafka", "PubSub" , "redis"] }
  - get_long_past_conversation: { "topic": "long" | "verylong" }

--- DON'TS ---
1. Never output only an opening or only a closing tag.
2. Never output both <RESULT> and <TOOL> together.
3. Never include raw JSON outside <TOOL>.
4. Never apologize, repeat, or add extra explanations.
5. Tags must be exactly as specified, each on its own line.

--- EXAMPLES ---
Q: What is the capital of India?
A:
<RESULT>
New Delhi
</RESULT>

Q: Latest news in Nepal
A:
<TOOL>
[{"name":"search","input":"latest news Nepal"}]
</TOOL>

Q: Who wrote "Pride and Prejudice"?
A:
<RESULT>
Jane Austen
</RESULT>

`,
    user: () => `
--- RECENT CONVERSATION CONTEXT ---
{recentText}

--- CURRENT QUERY ---
{query}

--- USER CUSTOM INSTRUCTIONS ---
{customPrompt || "None"}
`,
  },
};

export const createPrompt = (payload: Payload , customMode: PromptMode) => {
  const recentChats = ContextCutter.getRecentConversations(payload.chats ?? [], {
    truncateFrom: payload.customConfig?.context?.truncateFrom,
    minChats: customMode === "auto" ? payload.customConfig?.context?.prevChatLimit : 5,
    maxTokens: customMode === "auto" ? payload.customConfig?.context?.maxContextTokens : 1500,
    absoluteMaxTokens: customMode === "auto" ? payload.customConfig?.context?.absoluteMaxTokens : 3000,
  });

  const recentText = (() => {
    const text = recentChats
      .map(c => `${c.role}: ${trimMessage(c.content)}`)
      .join("\n") || "No recent conversation available.";

    if (recentChats.length === payload.chats?.length) {
      return "…no history above\n" + text;
    }
    return text;
  })();

  const template = PROMPT_TEMPLATES[customMode];

  const systemPrompt = typeof template.system === "function" ? template.system() : template.system;
  const userPrompt = (typeof template.user === "function" ? template.user() : template.user)
    .replace("{recentText}", recentText)
    .replace("{query}", trimMessage(payload.query))
    .replace("{customPrompt}", payload.customPrompt || "None");

  return { systemPrompt, userPrompt };
};


export async function streamThrottleOld(
  text: string,
  send: (event: string, data: string) => void,
  signal?: AbortSignal,
  config: StreamThrottleConfig = {}
) {
  const { chunkSize = 10, minDelay = 1, maxDelay = 50 } = config;

  const parts: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    parts.push(text.slice(i, i + chunkSize));
  }

  const total = parts.length;
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) return;
    send("llmResult", parts[i]);

    const t = i / total;
    const delay = minDelay + (1 - Math.cos(Math.PI * t)) / 2 * (maxDelay - minDelay);
    await new Promise(r => setTimeout(r, delay));
  }
}

export async function streamThrottle(
  text: string,
  send: (event: string, data: string) => void,
  signal?: AbortSignal,
  config: StreamThrottleConfig = {}
) {
  const parser = createStreamingParser(send);

  const { chunkSize = 10, minDelay = 1, maxDelay = 50 } = config;

  const parts: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    parts.push(text.slice(i, i + chunkSize));
  }

  const total = parts.length;
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) return;

    parser.parse(parts[i]);

    const t = i / total;
    const delay = minDelay + (1 - Math.cos(Math.PI * t)) / 2 * (maxDelay - minDelay);
    await new Promise(r => setTimeout(r, delay));
  }
}

export function createStreamingParser(send: (event: 'llmResult' | 'toolResult' | 'thinking' | 'event' | 'error', data: string) => void) {
  let state = 'llm';

  let buffer = '';

  const startTag = '<think>';
  const endTag = '</think>';

  function parse(chunk: string) {
    buffer += chunk;

    while (true) {
      if (state === 'llm') {
        const startIndex = buffer.indexOf(startTag);

        if (startIndex === -1) {
          const potentialTagStart = buffer.lastIndexOf('<');
          const sendable = potentialTagStart > -1 ? buffer.substring(0, potentialTagStart) : buffer;

          if (sendable) {
            send('llmResult', sendable);
            buffer = potentialTagStart > -1 ? buffer.substring(potentialTagStart) : '';
          }
          break;
        }

        const llmPart = buffer.substring(0, startIndex);
        if (llmPart) {
          send('llmResult', llmPart);
        }

        state = 'thinking';
        buffer = buffer.substring(startIndex + startTag.length);

      } else if (state === 'thinking') {
        const endIndex = buffer.indexOf(endTag);

        if (endIndex === -1) {
          const potentialTagStart = buffer.lastIndexOf('<');
          const sendable = potentialTagStart > -1 ? buffer.substring(0, potentialTagStart) : buffer;

          if (sendable) {
            send('thinking', sendable);
            buffer = potentialTagStart > -1 ? buffer.substring(potentialTagStart) : '';
          }
          break;
        }

        const thinkingPart = buffer.substring(0, endIndex);
        if (thinkingPart) {
          send('thinking', thinkingPart);
        }

        state = 'llm';
        buffer = buffer.substring(endIndex + endTag.length);
      }
    }
  }

  return { parse };
}


export function registerApiKeys(payload: Payload, headers: Headers) {
  const keyMap: Record<string, string> = {
    "x-gemini-key": "gemini",
    "x-tavily-key" : "tavily"
  };

  const apiKeys: Record<string, string> = {};

  for (const [headerName, keyName] of Object.entries(keyMap)) {
    const value = headers.get(headerName);
    if (value && value.trim() !== "") {
      apiKeys[keyName] = value;
    }
  }

  payload.apiKeys = apiKeys;
  return payload
}