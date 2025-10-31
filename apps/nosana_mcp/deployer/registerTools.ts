import { z } from "zod";
import deployerInstance from "./NosanaDeployer.js";
import { MARKETS } from "./utils/supportingModel.js";
import { DEFAULT_MARKETS, GpuMarketSlug, SELF_MODEL_AVAILABLE } from "./utils/types.js";
import { Job, validateJobDefinition } from "@nosana/sdk";
import {
    buildJobDefinition,
    checkCreateJob,
    fail,
} from "./utils/helpers.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ensureDeployer = () => {
    if (!deployerInstance) throw new Error("NosanaDeployer not initialized.");
    return deployerInstance;
};

export function registerTools(server: McpServer) {
    server.tool(
        "create_job_defination",
        "create Job defination which can be used in nosana dashboard to deploy job/decentralized gpu's",
        {
            params: z.object({
                modelName: z.enum(SELF_MODEL_AVAILABLE),
                gpuMarket: z.enum(DEFAULT_MARKETS),
                timeoutSeconds: z.number().max(86400 * 7).min(600),
                cmd: z.string().optional(),
                env: z.record(z.string(), z.string()).default({}),
                exposePort: z.number().default(8080),
                userPublicKey: z.string().optional().nullable(),
            }),
        },
        async ({ params }, ctx) => {
            try {
                const market_public_key = MARKETS[params.gpuMarket].address;
                const userPubKey = params.userPublicKey || ctx.authInfo?.clientId || ctx.authInfo?.token as string
                if (!userPubKey) return fail("Missing or invalid user public key.");

                const validator = await checkCreateJob(params);
                if (validator?.content[0].type === "text") {
                    return fail(`❌ Failed to create job: ${validator.content[0].text}`);
                };

                const jobDef = buildJobDefinition({
                    model: params.modelName,
                    market: params.gpuMarket,
                    exposePort: params.exposePort,
                    env: params.env,
                    cmd: params.cmd,
                    requiredVramGB: 8,
                });
                validateJobDefinition(jobDef);

                return {
                    tool_execute: true,
                    args: { ...params, marketPubKey: market_public_key },
                    prompt: jobDef,
                    content: [
                        {
                            type: "text",
                            text: `
SHOW These JSON and table to user and tell him to use that defination to host the our model on nosana decentralized network
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
| Wallet | ${ctx.authInfo?.clientId ?? params.userPublicKey} |
| Estimated price | ${validator?.content[0].text} |
| balance price | ${validator?.content[1].text} |
| USD price | ${validator?.content[2].text} |
| cmd | ${params.cmd ?? "Unset"} |
| time | ${params.timeoutSeconds} seconds|
| Action | Create Job (Model Deployment) |

Note: one-time 0.00429 SOL per GPU session (fraction refunded if closed early).

tell user to use that job defination in nosana dashboard to publish job
`,
                        },
                    ],
                };
            } catch (err: any) {
                console.error("create_job error:", err);
                return fail(`❌ Failed to create job: ${err.message}`);
            }
        }
    );

    // ────────────────────────────────
    // get_job
    // ────────────────────────────────
    server.tool(
        "get_job",
        "Fetches details about a Nosana job",
        {
            params: z.object({ jobId: z.string() }),
        },
        async ({ params: { jobId } }, ctx) => {
            try {
                const deployer = ensureDeployer();
                const job: Job | null = await deployer.getJob(jobId);
                if (!job) return fail(`⚠️ Job ${jobId} not found.`);

                const marketEntry = Object.entries(MARKETS).find(
                    ([_, m]) => m.address === job.market.toString()
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
        }
    );

    // ────────────────────────────────
    // get_all_jobs
    // ────────────────────────────────
    server.tool(
        "get_all_jobs",
        "Lists all Nosana jobs created by a user",
        {
            params: z.object({
                userPubKey: z.string().optional().nullable().describe("if user provide then take it otherwise keep it null"),
                limit: z.number().default(10),
                offset: z.number().default(0),
                state: z
                    .enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED"])
                    .optional(),
                market: z.string().optional(),
            }),
        },
        async ({ params: { userPubKey } }, ctx) => {
            try {
                let userPubliKey = userPubKey || ctx.authInfo?.clientId || ctx.authInfo?.token as string
                const deployer = ensureDeployer();
                const jobs = await deployer.getAllJobs(userPubliKey);
                if (!jobs.length) return fail(`⚠️ No jobs found for ${userPubliKey}`);

                const rows = jobs
                    .map(
                        (j) =>
                            `| ${j.address ?? j.jobId ?? "unknown"} | ${j.jobDefinition?.ops?.[0]?.id ?? "N/A"} | ${j.state ?? "unknown"} | ${j.market ?? "N/A"} |`
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
        }
    );

    // ────────────────────────────────
    // get_wallet_balance
    // ────────────────────────────────
    server.tool(
        "get_wallet_balance",
        "Fetches Solana + NOS token balances",
        {
            params: z.object({ userPubKey: z.string().optional().nullable() }),
        },
        async ({ params: { userPubKey } }, ctx) => {
            let userPublicKey = userPubKey || ctx.authInfo?.clientId || ctx.authInfo?.token as string

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
        }
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
        }
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
                const market = await deployer.get_market(gpuMarket_slug as GpuMarketSlug);
                const formatted = Object.entries(market)
                    .filter(([k]) => k !== "queue")
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("\n");
                return {
                    content: [
                        { type: "text", text: `📈 GPU Market Details (${gpuMarket_slug})\n${formatted}` },
                    ],
                };
            } catch (err: any) {
                console.error("get_market error:", err);
                return fail(`❌ Failed to fetch market: ${err.message}`);
            }
        }
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
                        `• ${name}\n  Address: ${info.address}\n  VRAM: ${info.vram_gb}GB\n  Memory: ${info.memory_gb}GB\n  Est. USD/hr: ${info.estimated_price_usd_per_hour}`
                );

                return {
                    content: [{ type: "text", text: `📊 Nosana GPU Markets\n${lines.join("\n\n")}` }],
                };
            } catch (err: any) {
                console.error("list_gpu_markets error:", err);
                return fail(`❌ Failed to list GPU markets: ${err.message}`);
            }
        }
    );


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
        }
    );

}
