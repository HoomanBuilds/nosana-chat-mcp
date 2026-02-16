/**
 * API Key mode tools for Nosana deployer.
 *
 * These tools operate entirely via the Nosana REST API using a Bearer API key.
 * They are registered INSTEAD of wallet-based tools when the user is in API key mode,
 * so the LLM never sees wallet-specific parameters.
 */

import { z } from "zod";
import { tool } from "ai";
import { MARKETS } from "./utils/supportingModel";
import { DEFAULT_MARKETS, GpuMarketSlug } from "./utils/types";
import { validateJobDefinition } from "@nosana/sdk";
import { ensureDeployer } from "./Deployer";
import { chatJSON } from "./utils/helpers";
import {
  getResolverPrompt,
  suggest_model_market_prompt,
} from "./prompt/deployer.prompt";
import { DecisionSchema, suggest_model_market_schema } from "./utils/schema";

const NOSANA_API_BASE = "https://dashboard.k8s.prd.nos.ci/api";

function fail(msg: string) {
  return { content: [{ type: "text", text: msg }] };
}

async function apiFetch(
  path: string,
  apiKey: string,
  options: RequestInit = {},
) {
  const res = await fetch(`${NOSANA_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res;
}

// ═══════════════════════════════════════════════════════════
// Credit Balance
// ═══════════════════════════════════════════════════════════

export const getCreditBalance = tool({
  description:
    "Fetches the Nosana credit balance for the connected account. Returns assigned, reserved, settled, and available credits.",
  inputSchema: z.object({}),
  execute: async (_, { toolCallId }: any) => {
    // apiKey is injected by DeploymentHandler via closure
    return fail(
      "getCreditBalance must be called via the API key tool factory.",
    );
  },
});

export function createGetCreditBalance(apiKey: string) {
  return tool({
    description:
      "Fetches the Nosana credit balance for the connected account. Shows assigned, reserved, settled, and available credits.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const res = await apiFetch("/credits/balance", apiKey);
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          return fail(
            `❌ Credit balance API error: ${res.status} ${res.statusText}${errText ? ` — ${errText}` : ""}`,
          );
        }

        const data = await res.json();
        const assigned = Number(data.assignedCredits ?? 0);
        const reserved = Number(data.reservedCredits ?? 0);
        const settled = Number(data.settledCredits ?? 0);
        const available = assigned - reserved - settled;

        return {
          content: [
            {
              type: "text",
              text: `
💳 **Nosana Credit Balance**
────────────────────────────
Assigned Credits : ${assigned.toFixed(2)}
Reserved Credits : ${reserved.toFixed(2)}
Settled Credits  : ${settled.toFixed(2)}
────────────────────────────
Available Credits: ${available.toFixed(2)}
────────────────────────────
${
  available <= 0
    ? "⚠️ Credits low or depleted. Visit https://deploy.nosana.com to top up."
    : "✅ Credits available. Ready to deploy."
}`,
            },
          ],
        };
      } catch (err: any) {
        console.error("getCreditBalance error:", err);
        return fail(`❌ Failed to fetch credit balance: ${err.message}`);
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════
// List Jobs
// ═══════════════════════════════════════════════════════════

export function createListJobs(apiKey: string) {
  return tool({
    description:
      "Lists all your Nosana jobs. Shows status, name, credits used, and creation time.",
    inputSchema: z.object({
      status: z
        .enum(["all", "running", "stopped", "queued", "completed"])
        .optional()
        .default("all")
        .describe("Filter by job status"),
    }),
    execute: async ({ status }) => {
      try {
        const url =
          status && status !== "all"
            ? `/jobs?state=${status.toUpperCase()}`
            : "/jobs";
        const res = await apiFetch(url, apiKey);

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          return fail(
            `❌ Jobs API error: ${res.status} ${res.statusText}${errText ? ` — ${errText}` : ""}`,
          );
        }

        const data = await res.json();
        const deployments = Array.isArray(data)
          ? data
          : data.jobs || data.data || [];

        if (!deployments.length)
          return fail("⚠️ No jobs found. Use createJob to start one.");

        const lines = deployments
          .map(
            (d: any) => `
──────────────────────────────
🧱 **ID:** ${d.address || d.id || d._id || "N/A"}
📊 **Status:** ${d.status || d.state || "Unknown"}
🏷️ **Name:** ${d.name || "Unnamed"}
💸 **Credits Used:** ${d.creditsUsed ?? d.credits_used ?? "N/A"}
🕒 **Created:** ${d.createdAt || d.created_at || "N/A"}
📡 **Job Address:** ${d.jobAddress || d.job_address || "N/A"}
──────────────────────────────`,
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `📊 **Your Jobs** (${deployments.length} found)
${lines}

💡 **Next steps:**
• getJob [id] → detailed info
• stopJob [id] → stop a running job
• createJob → start a new one
• getCreditBalance → check remaining credits`,
            },
          ],
        };
      } catch (err: any) {
        console.error("listJobs error:", err);
        return fail(`❌ Failed to list jobs: ${err.message}`);
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════
// Get Single Job
// ═══════════════════════════════════════════════════════════

export function createGetJob(apiKey: string) {
  return tool({
    description:
      "Fetches detailed information about a specific Nosana job by its ID.",
    inputSchema: z.object({
      deploymentId: z.string().describe("The job ID to look up"),
    }),
    execute: async ({ deploymentId }) => {
      try {
        const res = await apiFetch(`/jobs/${deploymentId}`, apiKey);

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          return fail(
            `❌ Job not found: ${res.status}${errText ? ` — ${errText}` : ""}`,
          );
        }

        const d = await res.json();

        return {
          content: [
            {
              type: "text",
              text: `
📄 **Job Details**
──────────────────────────────
ID         : ${d.id || d._id}
Name       : ${d.name || "Unnamed"}
Status     : ${d.status || d.state || "Unknown"}
Market     : ${d.market || "N/A"}
Credits    : ${d.creditsUsed ?? d.credits_used ?? "N/A"}
Created    : ${d.createdAt || d.created_at || "N/A"}
Job Address: ${d.jobAddress || d.job_address || "N/A"}
Service URL: ${d.serviceUrl || d.service_url || "N/A"}
──────────────────────────────
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("getJob error:", err);
        return fail(`❌ Failed to fetch job: ${err.message}`);
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════
// Stop Job
// ═══════════════════════════════════════════════════════════

export function createStopJob(apiKey: string) {
  return tool({
    description: "Stops a running Nosana job.",
    inputSchema: z.object({
      deploymentId: z.string().describe("The job ID to stop"),
    }),
    execute: async ({ deploymentId }) => {
      try {
        // Try standard stop (jobs endpoint)
        let res = await apiFetch("/jobs/stop", apiKey, {
          method: "POST",
          body: JSON.stringify({ address: deploymentId }),
        });

        if (!res.ok) {
          // Fallback: try stop-with-credits
          res = await apiFetch("/jobs/stop-with-credits", apiKey, {
            method: "POST",
            body: JSON.stringify({ jobAddress: deploymentId }),
          });
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          return fail(
            `❌ Failed to stop job: ${res.status}${errText ? ` — ${errText}` : ""}`,
          );
        }

        const data = await res.json().catch(() => ({}));

        return {
          // tool_execute: true,
          args: { deploymentId },
          content: [
            {
              type: "text",
              text: `🛑 **Job Stopped**
──────────────────────────────
Job ID: ${deploymentId}
Status: Stopped
${data.tx ? `Transaction: ${data.tx}` : ""}
──────────────────────────────
Would you like to check your remaining credits or list other jobs?`,
            },
          ],
        };
      } catch (err: any) {
        console.error("stopJob error:", err);
        return fail(`❌ Failed to stop job: ${err.message}`);
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════
// GPU Market tools (shared — no auth needed for these)
// ═══════════════════════════════════════════════════════════

export const apiListGpuMarkets = tool({
  description:
    "Lists all supported Nosana GPU markets with pricing, VRAM, and address info.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      if (!MARKETS || Object.keys(MARKETS).length === 0)
        return fail("No GPU markets found.");

      const lines = Object.entries(MARKETS).map(
        ([name, info]) =>
          `• **${name}**\n  Address: ${info.address}\n  VRAM: ${info.vram_gb}GB\n  Est. USD/hr: $${info.estimated_price_usd_per_hour}`,
      );

      return {
        content: [
          {
            type: "text",
            text: `📊 **Nosana GPU Markets**\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    } catch (err: any) {
      return fail(`❌ Failed to list GPU markets: ${err.message}`);
    }
  },
});

export const apiEstimateJobCost = tool({
  description: "Estimates the credit cost of a job on a given GPU market.",
  inputSchema: z.object({
    gpuMarket: z.enum(DEFAULT_MARKETS),
    durationSeconds: z.number(),
  }),
  execute: async ({ gpuMarket, durationSeconds }) => {
    try {
      const deployer = ensureDeployer();
      const gpuMarketPubKey = MARKETS[gpuMarket as GpuMarketSlug].address;
      const cost = await deployer.getExactValue(
        gpuMarketPubKey,
        durationSeconds,
      );

      return {
        content: [
          {
            type: "text",
            text: `
GPU Market : ${cost.market}
Duration   : ${cost.hours.toFixed(2)} hours (${durationSeconds}s)
Est. Cost  : ${cost.NOS} NOS (~$${cost.USD.toFixed(2)} USD)
`,
          },
        ],
      };
    } catch (err: any) {
      return fail(`❌ Failed to estimate cost: ${err.message}`);
    }
  },
});

export const apiSuggestModelMarket = tool({
  description:
    "Suggests the best GPU markets and models based on user requirements.",
  inputSchema: z.object({
    requirements: z.string().describe("User's requirements, separated by '|'"),
  }),
  execute: async ({ requirements }) => {
    try {
      const result = await chatJSON(
        suggest_model_market_prompt(requirements, MARKETS),
        suggest_model_market_schema,
      );

      const formattedMarkets = result.market
        .map(
          (m) =>
            `→ ${m.name} (${m.address}) — ${m.price}/hr\n   Reason: ${m.reason} Score: ${m.recommandation_score}`,
        )
        .join("\n");

      const formattedModels = result.model
        .map(
          (m) =>
            `→ ${m.name}\n   Reason: ${m.reason} Score: ${m.recommandation_score}`,
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `📊 Recommendations:\n\n# 🖥️ Markets / GPUs\n${formattedMarkets}\n\n# 🧠 Models\n${formattedModels}`,
          },
        ],
      };
    } catch (err: any) {
      return fail(`Failed to suggest model and market: ${err.message}`);
    }
  },
});

// ═══════════════════════════════════════════════════════════
// Factory: builds the full API key tool set
// ═══════════════════════════════════════════════════════════

export function buildApiKeyToolSet(apiKey: string) {
  return {
    getCreditBalance: createGetCreditBalance(apiKey),
    listJobs: createListJobs(apiKey),
    getJob: createGetJob(apiKey),
    stopJob: createStopJob(apiKey),
    listGpuMarkets: apiListGpuMarkets,
    estimateJobCost: apiEstimateJobCost,
    suggest_model_market: apiSuggestModelMarket,
  };
}
