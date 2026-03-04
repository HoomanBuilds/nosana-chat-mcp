import { createOpenAI } from "@ai-sdk/openai";
import { stepCountIs, streamText, ToolSet } from "ai";
import { Payload } from "@/lib/utils/validation";
import { getModels, createJob } from "@/lib/deployerTools/tool.createJob";

import {
  estimateJobCost,
  extendJobRuntime,
  getMarket,
  getJob,
  getWalletBalance,
  listGpuMarkets,
  getAllJobs,
  stopJob,
  suggest_model_market,
} from "@/lib/deployerTools/deployer.tools";
import { buildApiKeyToolSet } from "@/lib/deployerTools/apikey.tools";
import { streamThrottle } from "./utils";
import { runWithPlannerModel } from "@/lib/deployerTools/utils/plannerContext";
import { normalizeInferenceBaseURL, COMMON_HEADERS } from "@/lib/utils/llm";

const openai = createOpenAI({
  apiKey: process.env.INFERIA_LLM_API_KEY || "nosana-local",
  baseURL: normalizeInferenceBaseURL(
    process.env.NEXT_PUBLIC_INFERIA_LLM_URL || "",
  ),
  headers: {
    ...COMMON_HEADERS,
  },
});

/** Wallet mode tools — on-chain via SDK */
function getWalletTools(): ToolSet {
  return {
    estimateJobCost,
    extendJobRuntime,
    getMarket,
    getJob,
    getWalletBalance,
    createJob,
    getModels,
    listGpuMarkets,
    getAllJobs,
    stopJob,
    suggest_model_market,
  };
}

/** API key mode tools — REST API via bearer token, no wallet params exposed */
function getApiKeyTools(apiKey: string): ToolSet {
  const apiTools = buildApiKeyToolSet(apiKey);
  return {
    ...apiTools,
    // Shared tools that work in both modes
    createJob,
    getModels,
    getMarket,
    getJob,
  };
}

function resolveToolName(
  rawName: unknown,
  knownTools: Set<string>,
): { valid: boolean; name: string; raw: string; sanitized: boolean } {
  if (typeof rawName !== "string") {
    return { valid: false, name: "", raw: "", sanitized: false };
  }

  const raw = rawName.trim();
  if (!raw) {
    return { valid: false, name: "", raw: "", sanitized: false };
  }

  if (knownTools.has(raw)) {
    return { valid: true, name: raw, raw, sanitized: false };
  }

  const strippedChannelToken = raw.replace(/<\|[^|>]+?\|>.*$/g, "").trim();
  if (knownTools.has(strippedChannelToken)) {
    return {
      valid: true,
      name: strippedChannelToken,
      raw,
      sanitized: strippedChannelToken !== raw,
    };
  }

  const beforeAngle = strippedChannelToken.split("<")[0]?.trim() || "";
  if (knownTools.has(beforeAngle)) {
    return {
      valid: true,
      name: beforeAngle,
      raw,
      sanitized: beforeAngle !== raw,
    };
  }

  return { valid: false, name: "", raw, sanitized: false };
}

export const handleDeployment = async (
  payload: Payload,
  send: (event: string, data: string) => void,
) => {
  const plannerModel = payload.model?.trim();
  if (!plannerModel) {
    send(
      "error",
      "No model selected. Please choose a model from the model selector and retry.",
    );
    return;
  }

  return runWithPlannerModel(plannerModel, async () => {
    const userWallet = payload.walletPublicKey;
    const isApiKeyMode = userWallet?.startsWith("nos_");

    // ── Pick the right tool set based on auth mode ──
    const tools = isApiKeyMode ? getApiKeyTools(userWallet!) : getWalletTools();

    const knownToolNames = new Set(Object.keys(tools));
    const actionableToolNames = new Set([
      "createJob",
      "extendJobRuntime",
      "stopJob",
    ]);
    const seenSanitizedToolStarts = new Set<string>();

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

    // ── System prompt — clean, mode-specific ──
    const authPrompt = isApiKeyMode
      ? `**Auth Mode:** API Key (Credits-based). The user is connected via their Nosana API key.
You do NOT have access to any wallet. Do not ask for a wallet address.

**Available Tools:**
- getCreditBalance → check credit balance
- listJobs → list all jobs
- getJob → get details of a specific job
- stopJob → stop a running job
- createJob → create a new job
- getModels → search for models
- getMarket → get GPU market info
- getJob → get job info by ID
- listGpuMarkets → list all GPU markets
- estimateJobCost → estimate job cost
- suggest_model_market → get recommendations

All tools are pre-authenticated. Just call them directly — no credentials needed in parameters.`
      : userWallet
        ? `**Auth Mode:** Wallet (On-chain)
**Wallet:** ${userWallet}
Use this as userPublicKey / UsersPublicKey / job_owners_pubKey / userPubKey in all tool calls.

**Available Tools:**
- createJob → create a new job (userPublicKey="${userWallet}")
- getWalletBalance → check SOL + NOS balances (UsersPublicKey="${userWallet}")
- getAllJobs → list all jobs (userPubKey="${userWallet}")
- getJob → get job details by ID
- stopJob → stop a running job (job_owners_pubKey="${userWallet}")
- extendJobRuntime → extend a running job (job_owners_pubKey="${userWallet}")
- getMarket → get GPU market info
- listGpuMarkets → list all GPU markets
- estimateJobCost → estimate job cost
- suggest_model_market → get recommendations
- getModels → search for models`
        : "**No wallet connected.** Ask the user to connect their wallet or provide a Nosana API key first.";

    const messages = [
      {
        role: "system",
        content: `
You are **NosanaDeploy**, a deployment agent for Nosana's decentralized GPU network.

${authPrompt}

Handling User JSON:
1. If JSON has 'type', 'ops', 'meta' → first run createJob.
   - On pass + deploy request → createJob(directJobDef={...json...})
   - Never alter JSON unless asked.
2. If user says "deploy X" → createJob(model="X", requirements="deploy X with defaults").
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

If errors occur, try recovery twice before stopping. Always inform user of what's done and what's next.

-In in response from tool add your human tone rather then just pasting tool output as it is
${payload.customPrompt || ""}
`.trim(),
      },
      ...normalizeChats(payload.chats?.slice(-10) || []),
      { role: "user", content: payload.query || "" },
    ];

    const llmStart = performance.now();

    let stream;
    try {
      stream = streamText({
        model: openai.chat(plannerModel),
        messages,
        tools,
        toolChoice: "auto",
        parallelToolCalls: false,
        stopWhen: stepCountIs(6),
        abortSignal: payload.signal,
        maxRetries: 1,
      });
    } catch (error) {
      console.error("Failed to initialize LLM stream:", error);
      send("error", llmErr(error));
      send(
        "finalResult",
        "Sorry, there was an error connecting to the AI service. Please try again later.",
      );
      return;
    }

    console.log(
      `🚀 LLM stream initialized [${(performance.now() - llmStart).toFixed(1)}ms]`,
    );

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
            {
              const tool = resolveToolName(chunk.toolName, knownToolNames);
              if (!tool.valid) {
                console.warn(
                  "⚠️ Ignoring unknown tool name from model:",
                  chunk.toolName,
                );
                break;
              }

              if (tool.sanitized && seenSanitizedToolStarts.has(tool.name)) {
                console.warn(
                  `⚠️ Skipping duplicate sanitized tool start: ${tool.raw} -> ${tool.name}`,
                );
                break;
              }
              if (tool.sanitized) {
                seenSanitizedToolStarts.add(tool.name);
                console.warn(
                  `⚠️ Sanitized malformed tool name: ${tool.raw} -> ${tool.name}`,
                );
              }

              usedTools.add(tool.name);
              send("event", `executing: ${tool.name}`);
              console.log(`🧰 Tool started: ${tool.name}`);
            }
            break;

          case "tool-result":
            {
              const tool = resolveToolName(chunk.toolName, knownToolNames);
              if (!tool.valid) {
                console.warn(
                  "⚠️ Ignoring tool-result with unknown tool name:",
                  chunk.toolName,
                );
                break;
              }

              if (
                Boolean(chunk.output?.tool_execute) &&
                actionableToolNames.has(tool.name)
              ) {
                pendingTool = {
                  toolname: tool.name,
                  args: chunk.output.args,
                  prompt: chunk.output.prompt || chunk.output.meta?.prompt,
                };
                console.log(`🚀 toolExecute event sent for ${tool.name}`);
              }
            }
            break;
        }
      }
    } catch (e) {
      send("error", llmErr(e));
      return;
    }

    if (!finalText.trim() && pendingTool) {
      const fallbackText = `Prepared ${pendingTool.toolname} request. Review the generated configuration and approve to continue.`;
      send("llmResult", fallbackText);
      finalText = fallbackText;
    }

    send("toolsUsed", JSON.stringify([...usedTools]));
    send("finalResult", finalText.trim());

    if (pendingTool) {
      send("toolExecute", JSON.stringify(pendingTool));
      console.log(
        `🚀 toolExecute sent post-stream for ${pendingTool.toolname}`,
      );
    }
  });
};

function llmErr(e: unknown): string {
  const msg = (e as any)?.message || String(e);
  const url = (e as any)?.url || "";
  const statusCode = (e as any)?.statusCode;
  const responseBody = (e as any)?.responseBody || "";

  console.error("🔴 LLM error:", msg);

  if (
    msg.includes("Upstream Error: 400") ||
    /invalid_type.*choices.*undefined/i.test(msg + " " + responseBody)
  ) {
    return "tool calling is not supported for this model use another model like openai/gpt-oss-20b instead";
  }

  if (
    statusCode === 404 &&
    typeof url === "string" &&
    url.includes("/responses")
  ) {
    return "Model endpoint does not support /v1/responses. Configure deployer planner to use /v1/chat/completions-compatible backend.";
  }

  if (
    /tool_use_failed|Failed to parse tool call arguments as JSON/i.test(
      msg + " " + responseBody,
    )
  ) {
    return "Selected model generated invalid tool-call JSON. Choose a tool-calling capable model in the selector and retry.";
  }

  if (
    statusCode === 500 &&
    /Prompt processing failed/i.test(responseBody || msg)
  ) {
    return "Selected model backend failed while processing the prompt. Retry once; if persistent, choose a different model in the selector.";
  }

  if (/aborted|AbortError|SIGINT/i.test(msg))
    return "Request was cancelled before completion.";

  if (/deadline|timeout/i.test(msg))
    return "The AI request took too long and timed out. Please try again.";

  if (/unauthorized|permission|key|quota/i.test(msg))
    return responseBody
      ? `Authorization failed for deployer model call. Details: ${responseBody}`
      : "Server error: the AI service quota or key limit has been reached. Try again later.";

  if (/network|fetch|ECONN|ENOTFOUND|TLS/i.test(msg))
    return "Network issue: unable to reach the AI service. Check connection and retry.";

  return "Unexpected server error occurred while processing your request.";
}
