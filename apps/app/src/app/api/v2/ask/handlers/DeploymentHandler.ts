import { google } from "@ai-sdk/google";
import {
  stepCountIs,
  streamText,
  ToolSet,
} from "ai";
import { Payload } from "@/lib/utils/validation";
import { getModels, createJob } from "@/lib/deployerTools/tool.createJob"

import { estimateJobCost, extendJobRuntime, getMarket, getJob, getWalletBalance, listGpuMarkets, getAllJobs, stopJob, suggest_model_market } from "@/lib/deployerTools/deployer.tools";
import { streamThrottle } from './utils';
import { openai } from "@ai-sdk/openai";
async function getTools(): Promise<ToolSet> {
  return { estimateJobCost, extendJobRuntime, getMarket, getJob, getWalletBalance, createJob, getModels, listGpuMarkets, getAllJobs, stopJob, suggest_model_market };
}

export const handleDeployment = async (
  payload: Payload,
  send: (event: string, data: string) => void
) => {
  const tools = await getTools();

  const normalizeChats = (chats: any[] = []): any[] =>
    chats
      .filter((m) => m && m.content)
      .map((m) => ({
        role:
          m.role === "model"
            ? "assistant"
            : ["user", "assistant", "system"].includes(m.role)
              ? m.role
              : "user",
        content: String(m.content),
      }));

  const userWallet = payload.walletPublicKey;

  const messages = [
    {
      role: "system",
      content: `
You are **NosanaDeploy**, a deployment agent for Nosana's decentralized GPU network.

${userWallet
          ? `**Wallet:** ${userWallet}\nUse this as userPublicKey in all Nosana ops.`
          : "**No wallet connected.** Require wallet for deploy ops."}

Core Ops:
- Tools: createJob, extendJobRuntime, stopJob, getWalletBalance, getJob, getAllJobs, validate_job_definition.
- Always include userPublicKey="${userWallet || 'WALLET_REQUIRED'}" where needed.

Handling User JSON:
1. If JSON has 'type', 'ops', 'meta' → first run createJob.
   - On pass + deploy request → createJob(directJobDef={...json...})
   - Never alter JSON unless asked.
2. If user says “deploy X” → createJob(model="X", requirements="deploy X with defaults").
3. For custom services (e.g., Jupyter) → createJob with detailed requirements.

Behavior:
- Be concise, technical, and adaptive.
- Auto-correct small input errors (case, missing params, etc.).
- Retry failed ops twice if fixable; show brief logs each retry.
- Never dump raw tool output — interpret and summarize.
- Ask only if necessary (e.g., missing runtime).
- Handle errors gracefully and self-heal when possible.
- Use past tool results as context for next action.
- Respond cleanly; no filler, no repetition.

If errors occur, try recovery twice before stopping. Always inform user of what’s done and what’s next.

-In in response from tool add your human tone rather then just pasting tool output as it is
${payload.customPrompt || ""}
`.trim()
    }
    ,
    ...normalizeChats(payload.chats?.slice(-10) || []),
    { role: "user", content: payload.query || "" },
  ];

  const llmStart = performance.now();

  let stream;
  try {
    stream = streamText({
      model: google("gemini-2.0-flash"),
      messages,
      tools,
      toolChoice: "auto",
      stopWhen: stepCountIs(6),
      abortSignal: payload.signal,
      temperature: 0.9,
      maxRetries: 0
    });
  } catch (error) {
    console.error("Failed to initialize LLM stream:", error);
    send("error", llmErr(error));
    send("finalResult", "Sorry, there was an error connecting to the AI service. Please try again later.");
    return;
  }

  console.log(`🚀 LLM stream initialized [${(performance.now() - llmStart).toFixed(1)}ms]`);

  let finalText = "";
  const usedTools = new Set<string>();
  let pendingTool: any = null;

  try {
    for await (const chunk of stream.fullStream) {
      if (chunk.type === "error") {
        send("error", llmErr((chunk as any).error || chunk));
        return;
      }

      switch (chunk.type) {
        case "text-delta":
          send("event", "streaming");
          await streamThrottle(chunk.text, send, payload.signal, {
            chunkSize: 20,
            minDelay: 2,
            maxDelay: 40,
          });
          finalText += chunk.text;
          break;

        case "tool-input-start":
          usedTools.add(chunk.toolName);
          send("event", `executing: ${chunk.toolName}`);
          console.log(`🧰 Tool started: ${chunk.toolName}`);
          break;

        case "tool-result":
          if (
            Boolean(chunk.output?.tool_execute) &&
            ["createJob", "extendJobRuntime", "stopJob"].includes(chunk.toolName)
          ) {
            pendingTool = {
              toolname: chunk.toolName,
              args: chunk.output.args,
              prompt: chunk.output.prompt || chunk.output.meta?.prompt,
            };
            console.log(`🚀 toolExecute event sent for ${chunk.toolName}`);
          }
          break;
      }
    }
  } catch (e) {
    send("error", llmErr(e));
    return;
  }

  send("toolsUsed", JSON.stringify([...usedTools]));
  send("finalResult", finalText.trim());

  if (pendingTool) {
    send("toolExecute", JSON.stringify(pendingTool));
    console.log(`🚀 toolExecute sent post-stream for ${pendingTool.toolname}`);
  }
};


function llmErr(e: unknown): string {
  const msg = (e as any)?.message || String(e);

  console.error("🔴 LLM error:", msg);

  if (/aborted|AbortError|SIGINT/i.test(msg))
    return "Request was cancelled before completion.";

  if (/deadline|timeout/i.test(msg))
    return "The AI request took too long and timed out. Please try again.";

  if (/unauthorized|permission|key|quota/i.test(msg))
    return "Server error: the AI service quota or key limit has been reached. Try again later.";

  if (/network|fetch|ECONN|ENOTFOUND|TLS/i.test(msg))
    return "Network issue: unable to reach the AI service. Check connection and retry.";

  return "Unexpected server error occurred while processing your request.";
}