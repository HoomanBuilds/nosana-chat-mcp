import { z } from "zod";
import deployerInstance from "./NosanaDeployer.js";
import { MARKETS } from "./utils/supportingModel.js";
import {
  DEFAULT_MARKETS,
  GpuMarketSlug,
  SELF_MODEL_AVAILABLE,
  AuthContext,
  detectAuthMode,
} from "./utils/types.js";
import { Job, validateJobDefinition } from "@nosana/sdk";
import { buildJobDefinition, checkCreateJob, fail } from "./utils/helpers.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ensureDeployer = () => {
  if (!deployerInstance) throw new Error("NosanaDeployer not initialized.");
  return deployerInstance;
};

/** Extract auth context from MCP ctx */
function getAuthContext(ctx: any, explicitKey?: string | null): AuthContext {
  const credential =
    explicitKey ||
    ctx.authInfo?.extra?.publicKey ||
    ctx.authInfo?.clientId ||
    (ctx.authInfo?.token as string);

  if (!credential) {
    return { mode: "wallet", credential: "" };
  }

  return {
    mode: detectAuthMode(credential),
    credential,
  };
}

export function registerTools(server: McpServer) {
  // ────────────────────────────────
  // create_job_definition
  // ────────────────────────────────
  server.tool(
    "create_job_definition",
    "create Job definition which can be used in nosana dashboard to deploy job/decentralized gpu's. Works with both wallet and API key authentication.",
    {
      params: z.object({
        modelName: z.enum(SELF_MODEL_AVAILABLE),
        gpuMarket: z.enum(DEFAULT_MARKETS),
        timeoutSeconds: z
          .number()
          .max(86400 * 7)
          .min(600),
        cmd: z.string().optional(),
        env: z.record(z.string(), z.string()).default({}),
        exposePort: z.number().default(8080),
        userPublicKey: z.string().optional().nullable(),
        nosanaApiKey: z
          .string()
          .optional()
          .nullable()
          .describe(
            "Nosana API key (nos_xxx_...) for API key mode. If provided, uses credits-based API instead of wallet.",
          ),
      }),
    },
    async ({ params }, ctx) => {
      try {
        const auth = getAuthContext(ctx, params.nosanaApiKey);
        const market_public_key = MARKETS[params.gpuMarket].address;
        const userPubKey =
          params.userPublicKey ||
          ctx.authInfo?.clientId ||
          (ctx.authInfo?.token as string);

        if (auth.mode === "wallet" && !userPubKey) {
          return fail(
            "Missing or invalid user public key. Connect a wallet or provide a Nosana API key.",
          );
        }

        const jobDef = buildJobDefinition({
          model: params.modelName,
          market: params.gpuMarket,
          exposePort: params.exposePort,
          env: params.env,
          cmd: params.cmd,
          requiredVramGB: 8,
        });
        validateJobDefinition(jobDef);

        // For API key mode, show credits info; for wallet mode, show wallet balance
        let costInfo = "";
        if (auth.mode === "api_key") {
          try {
            const deployer = ensureDeployer();
            const credits = await deployer.getCreditBalance(auth);
            const available =
              credits.assignedCredits -
              credits.reservedCredits -
              credits.settledCredits;
            costInfo = `
| Auth Mode | API Key (Credits) |
| Available Credits | ${available.toFixed(2)} |
| Assigned Credits | ${credits.assignedCredits.toFixed(2)} |
| Reserved Credits | ${credits.reservedCredits.toFixed(2)} |
| Settled Credits | ${credits.settledCredits.toFixed(2)} |`;
          } catch {
            costInfo =
              "| Auth Mode | API Key (Credits) |\n| Credits | Could not fetch |";
          }
        } else {
          const validator = await checkCreateJob({
            ...params,
            userPublicKey: userPubKey,
          });
          if (validator?.content[0].type === "text") {
            return fail(
              `❌ Failed to create job: ${validator.content[0].text}`,
            );
          }
          costInfo = `
| Auth Mode | Wallet (On-chain) |
| Estimated price | ${validator?.content[0].text} |
| Balance | ${validator?.content[1].text} |
| USD price | ${validator?.content[2].text} |`;
        }

        return {
          tool_execute: true,
          args: { ...params, marketPubKey: market_public_key },
          prompt: jobDef,
          content: [
            {
              type: "text",
              text: `
SHOW These JSON and table to user and tell him to use that definition to host the our model on nosana decentralized network
https://dashboard.nosana.com/deploy

also ask user if he need any kind of update
.

JSON DEFINATION
${JSON.stringify(jobDef, null, 2)}

TABLE
| Field | Value |
|--------|--------|
| Model | ${params.modelName} |
| GPU Market | ${params.gpuMarket} |
| Port | ${params.exposePort ?? "8080"} |
| Environment | ${JSON.stringify(params.env) ?? "Unset"} |
| Wallet/Key | ${auth.mode === "api_key" ? "API Key (nos_...)" : (ctx.authInfo?.clientId ?? params.userPublicKey)} |
${costInfo}
| cmd | ${params.cmd ?? "Unset"} |
| time | ${params.timeoutSeconds} seconds|
| Action | Create Job (Model Deployment) |

Note: ${
                auth.mode === "api_key"
                  ? "Using credits-based deployment. Credits will be deducted from your Nosana account."
                  : "One-time 0.00429 SOL per GPU session (fraction refunded if closed early)."
              }

tell user to use that job definition in nosana dashboard to publish job
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("create_job error:", err);
        return fail(`❌ Failed to create job: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // create_job_api (API key mode)
  // ────────────────────────────────
  server.tool(
    "create_job_api",
    "Create and start a job on Nosana using the Jobs API. Requires a Nosana API key (nos_xxx_...). This uses credits instead of on-chain wallet transactions.",
    {
      params: z.object({
        modelName: z.enum(SELF_MODEL_AVAILABLE),
        gpuMarket: z.enum(DEFAULT_MARKETS),
        nosanaApiKey: z.string().describe("Your Nosana API key (nos_xxx_...)"),
        timeout: z.number().default(60).describe("Timeout in minutes"),
        replicas: z.number().default(1).describe("Number of replicas"),
        cmd: z.string().optional(),
        env: z.record(z.string(), z.string()).default({}),
        exposePort: z.number().default(8080),
      }),
    },
    async ({ params }) => {
      try {
        const deployer = ensureDeployer();
        const auth: AuthContext = {
          mode: "api_key",
          credential: params.nosanaApiKey,
        };

        const jobDef = buildJobDefinition({
          model: params.modelName,
          market: params.gpuMarket,
          exposePort: params.exposePort,
          env: params.env,
          cmd: params.cmd,
          requiredVramGB: 8,
        });

        const result = await deployer.createJob(
          {
            modelName: params.modelName,
            gpuMarket: params.gpuMarket,
            cmd: params.cmd,
            exposePort: params.exposePort,
            env: params.env,
            timeoutSeconds: params.timeout * 60,
          },
          auth,
        );

        return {
          content: [
            {
              type: "text",
              text: `
✅ **Job Created Successfully (API Key Mode)**

| Field | Value |
|--------|--------|
| Job ID | ${result.jobId} |
| Model | ${params.modelName} |
| GPU Market | ${params.gpuMarket} |
| Market Address | ${result.market} |
| Timeout | ${params.timeout} min |
| Replicas | ${params.replicas} |
| Port | ${params.exposePort} |
| IPFS/Ref | ${result.ipfsHash} |
| Dashboard | https://dashboard.nosana.com/jobs/${result.jobId} |

The job has been created and started using your Nosana credits.
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("create_job_api error:", err);
        return fail(`❌ Failed to create job: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // list_jobs (API key mode)
  // ────────────────────────────────
  server.tool(
    "list_jobs",
    "List all jobs for the authenticated Nosana account. Requires a Nosana API key.",
    {
      params: z.object({
        nosanaApiKey: z.string().describe("Your Nosana API key (nos_xxx_...)"),
      }),
    },
    async ({ params }) => {
      try {
        const deployer = ensureDeployer();
        const auth: AuthContext = {
          mode: "api_key",
          credential: params.nosanaApiKey,
        };

        const deployments = await deployer.listJobs(auth);

        if (!deployments.length) {
          return {
            content: [
              {
                type: "text",
                text: "📭 No jobs found for this account.",
              },
            ],
          };
        }

        const rows = deployments
          .map(
            (d: any) =>
              `| ${d.id ?? "N/A"} | ${d.name ?? "N/A"} | ${d.status ?? "unknown"} | ${d.market ?? "N/A"} | ${d.replicas ?? 0} |`,
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `
📊 **Your Jobs**

| ID | Name | Status | Market | Replicas |
|-----|------|--------|--------|----------|
${rows}
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("list_jobs error:", err);
        return fail(`❌ Failed to list jobs: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // get_job_api (API key mode)
  // ────────────────────────────────
  server.tool(
    "get_job_api",
    "Get details of a specific job. Requires a Nosana API key.",
    {
      params: z.object({
        deploymentId: z.string().describe("The job ID"),
        nosanaApiKey: z.string().describe("Your Nosana API key (nos_xxx_...)"),
      }),
    },
    async ({ params }) => {
      try {
        const deployer = ensureDeployer();
        const auth: AuthContext = {
          mode: "api_key",
          credential: params.nosanaApiKey,
        };

        const deployment = await deployer.getJob_api(params.deploymentId, auth);

        const formatted = Object.entries(deployment)
          .filter(([k]) => !["job_definition", "revisions"].includes(k))
          .map(
            ([k, v]) =>
              `| ${k} | ${typeof v === "object" ? JSON.stringify(v) : v} |`,
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `
📄 **Job Details**

| Field | Value |
|--------|--------|
${formatted}

Dashboard: https://dashboard.nosana.com/jobs/${params.deploymentId}
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("get_job_api error:", err);
        return fail(`❌ Failed to get job: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // stop_job_api (API key mode)
  // ────────────────────────────────
  server.tool(
    "stop_job_api",
    "Stop a running job. Requires a Nosana API key.",
    {
      params: z.object({
        deploymentId: z.string().describe("The job ID to stop"),
        nosanaApiKey: z.string().describe("Your Nosana API key (nos_xxx_...)"),
      }),
    },
    async ({ params }) => {
      try {
        const deployer = ensureDeployer();
        const auth: AuthContext = {
          mode: "api_key",
          credential: params.nosanaApiKey,
        };

        const result = await deployer.stopJob_api(params.deploymentId, auth);

        return {
          content: [
            {
              type: "text",
              text: `✅ ${result.note}\n\nJob ID: ${params.deploymentId}`,
            },
          ],
        };
      } catch (err: any) {
        console.error("stop_job_api error:", err);
        return fail(`❌ Failed to stop job: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // get_job (dual mode)
  // ────────────────────────────────
  server.tool(
    "get_job",
    "Fetches details about a Nosana job. Works with both wallet (on-chain) and API key.",
    {
      params: z.object({
        jobId: z.string(),
        nosanaApiKey: z
          .string()
          .optional()
          .nullable()
          .describe("Optional Nosana API key for API key mode"),
      }),
    },
    async ({ params: { jobId, nosanaApiKey } }, ctx) => {
      try {
        const deployer = ensureDeployer();
        const auth = getAuthContext(ctx, nosanaApiKey);
        const job = await deployer.getJob(jobId, auth);
        if (!job) return fail(`⚠️ Job ${jobId} not found.`);

        // Format depends on whether it's an on-chain Job or API response
        if (auth.mode === "api_key") {
          const formatted = Object.entries(job)
            .filter(([k]) => !["job_definition", "ops"].includes(k))
            .map(
              ([k, v]) =>
                `| ${k} | ${typeof v === "object" ? JSON.stringify(v) : v} |`,
            )
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `
📄 **Job Info (API Mode)**

| Field | Value |
|--------|--------|
${formatted}
`,
              },
            ],
          };
        }

        // Wallet mode format
        const marketEntry = Object.entries(MARKETS).find(
          ([_, m]) => m.address === job.market.toString(),
        );
        const marketName = marketEntry ? marketEntry[0] : "unknown";

        return {
          content: [
            {
              type: "text",
              text: `
📄 **Job Info**

| Field | Value |
|--------|--------|
| Job ID | ${jobId} |
| Market | ${marketName} |
| GPU Addr | ${job.market} |
| Price (NOS) | ${job.price} |
| State | ${job.state} |
| Timeout | ${job.timeout}s |
| Node | ${job.node} |
| Payer | ${job.payer} |
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("get_job error:", err);
        return fail(`❌ Failed to fetch job: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // get_all_jobs
  // ────────────────────────────────
  server.tool(
    "get_all_jobs",
    "Lists all Nosana jobs created by a user",
    {
      params: z.object({
        userPubKey: z
          .string()
          .optional()
          .nullable()
          .describe("if user provide then take it otherwise keep it null"),
        limit: z.number().default(10),
        offset: z.number().default(0),
        state: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED"]).optional(),
        market: z.string().optional(),
      }),
    },
    async ({ params: { userPubKey } }, ctx) => {
      try {
        let userPubliKey =
          userPubKey ||
          ctx.authInfo?.clientId ||
          (ctx.authInfo?.token as string);
        const deployer = ensureDeployer();
        const jobs = await deployer.getAllJobs(userPubliKey);
        if (!jobs.length) return fail(`⚠️ No jobs found for ${userPubliKey}`);

        const rows = jobs
          .map(
            (j) =>
              `| ${j.address ?? j.jobId ?? "unknown"} | ${j.jobDefinition?.ops?.[0]?.id ?? "N/A"} | ${j.state ?? "unknown"} | ${j.market ?? "N/A"} |`,
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `
📊 **Jobs for ${userPubKey}**
| Job ID | Model | State | GPU Market |
|--------|--------|--------|-------------|
${rows}
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("get_all_jobs error:", err);
        return fail(`❌ Failed to list jobs: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // get_wallet_balance
  // ────────────────────────────────
  server.tool(
    "get_wallet_balance",
    "Fetches Solana + NOS token balances (wallet mode only)",
    {
      params: z.object({ userPubKey: z.string().optional().nullable() }),
    },
    async ({ params: { userPubKey } }, ctx) => {
      let userPublicKey =
        userPubKey || ctx.authInfo?.clientId || (ctx.authInfo?.token as string);

      try {
        const deployer = ensureDeployer();
        const balance = await deployer.getWalletBalance(userPublicKey);
        return {
          content: [
            {
              type: "text",
              text: `
💰 **Wallet Balances**
| Token | Balance |
|--------|----------|
| SOL | ${balance.sol} |
| NOS | ${balance.nos} |
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("get_wallet_balance error:", err);
        return fail(`❌ Failed to fetch wallet: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // get_credit_balance (dual mode)
  // ────────────────────────────────
  server.tool(
    "get_credit_balance",
    "Get credit balance on the Nosana platform. Works with both wallet and API key authentication.",
    {
      params: z.object({
        nosanaApiKey: z
          .string()
          .optional()
          .nullable()
          .describe(
            "Nosana API key (nos_xxx_...) for API mode. If not provided, uses server-side API key.",
          ),
      }),
    },
    async ({ params }, ctx) => {
      try {
        const deployer = ensureDeployer();
        const auth = getAuthContext(ctx, params.nosanaApiKey);
        const credits = await deployer.getCreditBalance(auth);
        const available =
          credits.assignedCredits -
          credits.reservedCredits -
          credits.settledCredits;

        return {
          content: [
            {
              type: "text",
              text: `
| Nosana Credit Balance |

| Field | Value |
|--------|--------|
| Auth Mode | ${auth.mode === "api_key" ? "API Key" : "Wallet"} |
| Assigned Credits | ${credits.assignedCredits.toFixed(2)} |
| Reserved Credits | ${credits.reservedCredits.toFixed(2)} |
| Settled Credits | ${credits.settledCredits.toFixed(2)} |
| **Available Credits** | **${available.toFixed(2)}** |

${available <= 0 ? "⚠️ You have no available credits. Top up at https://deploy.nosana.com" : ""}
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("get_credit_balance error:", err);
        return fail(`❌ Failed to fetch credit balance: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // estimate_job_cost
  // ────────────────────────────────
  server.tool(
    "estimate_job_cost",
    "Estimates credit cost of a job",
    {
      params: z.object({
        gpuMarket: z.enum(DEFAULT_MARKETS),
        durationSeconds: z.number(),
      }),
    },
    async ({ params: { gpuMarket, durationSeconds } }) => {
      try {
        const deployer = ensureDeployer();
        const cost = await deployer.estimateJobCost(gpuMarket, durationSeconds);
        return {
          content: [
            {
              type: "text",
              text: `
💸 Estimated Job Cost
Market: ${gpuMarket}
Price/s: ${cost.pricePerSecond}
Total (${durationSeconds}s): ${cost.estimatedCost}
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("estimate_job_cost error:", err);
        return fail(`❌ Failed to estimate cost: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // get_market
  // ────────────────────────────────
  server.tool(
    "get_market",
    "Return latest details of a Nosana GPU market",
    {
      params: z.object({
        gpuMarket_slug: z.enum(DEFAULT_MARKETS),
      }),
    },
    async ({ params: { gpuMarket_slug } }) => {
      try {
        const deployer = ensureDeployer();
        const market = await deployer.get_market(
          gpuMarket_slug as GpuMarketSlug,
        );
        const formatted = Object.entries(market)
          .filter(([k]) => k !== "queue")
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
        return {
          content: [
            {
              type: "text",
              text: `📈 GPU Market Details (${gpuMarket_slug})\n${formatted}`,
            },
          ],
        };
      } catch (err: any) {
        console.error("get_market error:", err);
        return fail(`❌ Failed to fetch market: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // list_gpu_markets
  // ────────────────────────────────
  server.tool(
    "list_gpu_markets",
    "Lists all supported Nosana GPU markets",
    {
      params: z.object({}),
    },
    async () => {
      try {
        if (!MARKETS || Object.keys(MARKETS).length === 0)
          return { content: [{ type: "text", text: "No GPU markets found." }] };

        const lines = Object.entries(MARKETS).map(
          ([name, info]) =>
            `• ${name}\n  Address: ${info.address}\n  VRAM: ${info.vram_gb}GB\n  Memory: ${info.memory_gb}GB\n  Est. USD/hr: ${info.estimated_price_usd_per_hour}`,
        );

        return {
          content: [
            {
              type: "text",
              text: `📊 Nosana GPU Markets\n${lines.join("\n\n")}`,
            },
          ],
        };
      } catch (err: any) {
        console.error("list_gpu_markets error:", err);
        return fail(`❌ Failed to list GPU markets: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // get_exact_value
  // ────────────────────────────────
  server.tool(
    "get_exact_value",
    "Calculates the exact value of a Nosana GPU job — returning SOL, NOS, and USD estimates for a given duration.",
    {
      params: z.object({
        gpuMarket: z.enum(DEFAULT_MARKETS),
        seconds: z.number().min(1).describe("Job duration in seconds"),
      }),
    },
    async ({ params: { gpuMarket, seconds } }) => {
      try {
        const deployer = ensureDeployer();
        const marketPubKey = MARKETS[gpuMarket].address;

        const result = await deployer.getExactValue(marketPubKey, seconds);

        return {
          tool_execute: true,
          args: { gpuMarket, seconds },
          content: [
            {
              type: "text",
              text: `
💰 **Exact GPU Job Value**

| Field | Value |
|--------|--------|
| GPU Market | ${result.market} |
| Duration | ${result.seconds}s (${result.hours.toFixed(2)}h) |
| USD Equivalent | $${result.USD.toFixed(3)} |
| NOS Required | ${result.NOS} NOS |
| NOS/USD Rate | $${result.NOS_USD} |
| Fixed GPU Fee | ${result.SOL} SOL |
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("get_exact_value error:", err);
        return fail(`❌ Failed to calculate exact value: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // stop_job
  // ────────────────────────────────
  server.tool(
    "stop_job",
    "Stop a running Nosana job. Works with both wallet (on-chain) and API key mode.",
    {
      params: z.object({
        jobId: z.string().describe("The job ID or address to stop"),
        nosanaApiKey: z
          .string()
          .optional()
          .nullable()
          .describe("Optional Nosana API key for API key mode"),
      }),
    },
    async ({ params }, ctx) => {
      try {
        const deployer = ensureDeployer();
        const auth = getAuthContext(ctx, params.nosanaApiKey);

        const result = await deployer.stopJob(params.jobId, auth);

        return {
          content: [
            {
              type: "text",
              text: `
${result.ok ? "✅" : "❌"} **Stop Job Result**

| Field | Value |
|--------|--------|
| Job ID | ${params.jobId} |
| Status | ${result.ok ? "Stopped" : "Failed"} |
| Mode | ${auth.mode === "api_key" ? "API Key" : "Wallet"} |
${result.tx ? `| Transaction | ${result.tx} |` : ""}
${result.note ? `| Note | ${result.note} |` : ""}
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("stop_job error:", err);
        return fail(`❌ Failed to stop job: ${err.message}`);
      }
    },
  );

  // ────────────────────────────────
  // extend_job_runtime (dual mode)
  // ────────────────────────────────
  server.tool(
    "extend_job_runtime",
    "Extend a running job's runtime. Works with both wallet (on-chain) and API key mode.",
    {
      params: z.object({
        jobId: z.string().describe("The job ID or address"),
        extensionSeconds: z
          .number()
          .min(60)
          .max(86400)
          .describe("Extension time in seconds"),
        nosanaApiKey: z
          .string()
          .optional()
          .nullable()
          .describe("Optional Nosana API key for API key mode"),
      }),
    },
    async ({ params }, ctx) => {
      try {
        const deployer = ensureDeployer();
        const auth = getAuthContext(ctx, params.nosanaApiKey);

        const result = await deployer.extendJobRuntime(
          params.jobId,
          params.extensionSeconds,
          auth,
        );

        return {
          content: [
            {
              type: "text",
              text: `
${result.ok ? "✅" : "❌"} **Extend Job Runtime Result**

| Field | Value |
|--------|--------|
| Job ID | ${params.jobId} |
| Extension | ${params.extensionSeconds}s (${(params.extensionSeconds / 60).toFixed(1)} min) |
| Status | ${result.ok ? "Extended" : "Failed"} |
| Mode | ${auth.mode === "api_key" ? "API Key" : "Wallet"} |
${result.txId ? `| Transaction | ${result.txId} |` : ""}
| Note | ${result.note} |
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("extend_job_runtime error:", err);
        return fail(`❌ Failed to extend job: ${err.message}`);
      }
    },
  );
}
