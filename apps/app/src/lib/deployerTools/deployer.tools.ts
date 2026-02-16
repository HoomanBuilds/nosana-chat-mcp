import { z } from "zod";
import { tool } from "ai";
import { MARKETS } from "./utils/supportingModel";
import { DEFAULT_MARKETS, GpuMarketSlug } from "./utils/types";
import { validateJobDefinition } from "@nosana/sdk";
import {
  chatJSON,
  checkHuggingFaceModel,
  checkJobExtendable,
  checkJobStop,
  createJobDefination,
  fail,
} from "./utils/helpers";
import {
  getResolverPrompt,
  suggest_model_market_prompt,
} from "./prompt/deployer.prompt";
import {
  DecisionSchema,
  TResult,
  suggest_model_market_schema,
} from "./utils/schema";
import { ensureDeployer } from "./Deployer";

export const createJob = tool({
  description: `
    - call everytime user want to create jobDefination | update jobDefination | modify jobDefination | provide their own jobDefination 
    Create or update a job on the Nosana decentralized network.
    - always on update createJob(with requirements) don't edit yourself
    Behavior rules:
    - **CRITICAL: Use 'directJobDef' ONLY when user provides a COMPLETE Nosana job definition JSON with ALL required fields: 'type', 'ops', and 'meta'.** 
    - If user provides partial JSON (e.g., just id/type/source or missing ops/meta), extract the model name and details, then use 'model' + 'requirements' parameters instead.
    - Ask ONLY: model | GPU market | runtime.(if user just tell model then find market yourself and run on default 1 hours dont ask much of questions
     or if user wants you to suggest some then use suggestModelMarket tool
    )
    - on every change use this tool dont show update json schema and later run this tool like confirmation
    - If user mentions changes (e.g. "add API key", "update port", "change env var" or any otherkind of changes),
      summarize those in 'requirements' and re-run the tool automatically. - provide the full definition with requirement both as requirement
    - Downstream logic will extract everything from 'requirements'.
    - **CRITICAL VERBOSITY (for Updates):** Upon any change or update request, the 'requirements' field **must** be a highly verbose, **destructured natural language summary** of the complete job state. The summary must include the model name, category, GPU, runtime, and explicitly list every configuration detail (env vars, ports, etc.) except type = container , so that the downstream logic has the complete context and does not discard previous settings. **Avoid submitting the full JSON definition directly into 'requirements' on modification requests.** also add provider == huggingface (in detail) if its hugging face inference container image.
  `,
  inputSchema: z.object({
    model: z
      .string()
      .optional()
      .describe(
        "Detect automatically (e.g. meta-llama/Llama-3.1-8B-Instruct, Qwen/Qwen2.5-7B-Instruct, deepseek-ai/DeepSeek-R1). Use FULL Hugging Face model ID format (org/model-name). Extract from partial JSON if provided. NOT NEEDED if directJobDef is provided.",
      ),
    market: z
      .enum(DEFAULT_MARKETS)
      .optional()
      .describe(
        "find compatible market for model, market should be capable enough to run this model, you can use related tool first to get suggestions and based on them run tool",
      ),
    requirements: z
      .string()
      .optional()
      .describe(
        "all user requirement with related past context goes here , this will be passed to another ai to create jobDefination, should be highly verbose, All user requirement will be passed here with all details. If user provides partial JSON (e.g., {id, type, source}), extract the relevant info and describe it here in natural language. NOT NEEDED if directJobDef is provided.",
      ),
    timeoutSeconds: z
      .number()
      .min(600)
      .max(86400 * 7)
      .default(3600)
      .describe(
        "Default is 1 hour if the user does not provide many details. Just start the tool with timing and other details.",
      ),
    userPublicKey: z.string(),
    directJobDef: z
      .record(z.string(), z.any())
      .optional()
      .describe(
        "ONLY use this for COMPLETE Nosana job definitions that include ALL of: 'type', 'ops' array, and 'meta' object. Do NOT use for partial JSONs like {id, type, source} - instead extract info to 'model' and 'requirements'.",
      ),
  }),
  execute: async (params) => {
    const deployer = ensureDeployer();
    let market_public_key, Model_vram, Job_cost;

    // CASE 1: User provided complete job definition - just validate it
    if (params.directJobDef) {
      try {
        const validation = validateJobDefinition(params.directJobDef);

        if (!validation.success) {
          const errors =
            validation.errors
              ?.map((e: any) => `  • ${e.path.join(".")}: ${e.message}`)
              .join("\n") || "Unknown validation errors";
          return fail(
            `Job definition validation failed:\n${errors}\n\nPlease fix these issues and try again.`,
          );
        }

        // Extract market from job def or use provided market
        const jobImage = params.directJobDef.ops?.[0]?.args?.image || "";
        const isHF =
          params.directJobDef.meta?.provider === "huggingface" ||
          /^ghcr\.io\/huggingface\/text-generation-inference/.test(jobImage) ||
          /^huggingface\/text-generation-inference/.test(jobImage);
        const vram =
          params.directJobDef.ops?.[0]?.args?.required_vram ||
          params.directJobDef.meta?.system_requirements?.required_vram ||
          8;

        // Try to find appropriate market
        if (!params.market) {
          const compatibleMarket = Object.entries(MARKETS).find(
            ([, m]) => m.vram_gb >= vram,
          );
          if (compatibleMarket) {
            params.market = compatibleMarket[0] as any;
            market_public_key = compatibleMarket[1].address;
          }
        } else {
          market_public_key = MARKETS[params.market].address;
        }

        if (!market_public_key) {
          const maxVram = Math.max(
            ...Object.values(MARKETS).map((m) => m.vram_gb),
          );
          const topGpus = Object.entries(MARKETS)
            .sort((a, b) => b[1].vram_gb - a[1].vram_gb)
            .slice(0, 3)
            .map(([name, info]) => `  • ${name}: ${info.vram_gb}GB`)
            .join("\n");

          return fail(`❌ No compatible market found for VRAM requirement: ${vram}GB.

**Maximum available VRAM:** ${maxVram}GB

**Top GPUs Available:**
${topGpus}

**Solutions:**
1. Reduce VRAM requirement in your job definition
2. Manually specify a market with: market parameter
3. Use quantization to reduce model size
4. Consider a smaller model or external API

Please adjust your configuration or specify a compatible market manually.`);
        }

        Model_vram = MARKETS[params.market!].vram_gb;

        try {
          Job_cost = await deployer.getExactValue(
            market_public_key,
            params.timeoutSeconds,
          );
        } catch (err) {
          console.warn(
            `⚠️ Could not fetch Job cost for market: ${market_public_key}, timeoutSeconds: ${params.timeoutSeconds}`,
            err,
          );
        }

        return {
          tool_execute: true,
          args: {
            ...params,
            marketPubKey: market_public_key,
            provider: isHF ? "huggingface" : "container",
          },
          prompt: params.directJobDef,
          content: [
            {
              type: "text",
              text: `
📦 **User-Provided Job Definition (Validated)**

| Field | Value |
|--------|--------|
| Type | ${params.directJobDef.type} |
| Image | ${jobImage} |
| GPU Market | ${params.market?.toUpperCase() || "Auto-detected"} |
| VRAM Required | ${vram} GB |
| Exposed Port | ${params.directJobDef.ops?.[0]?.args?.expose || "None"} |
| Timeout | ${(params.timeoutSeconds / 3600).toFixed(2)} hours |

💰 **Cost:**
${!Job_cost
                  ? "Failed to get cost, check it from wallet interface"
                  : `
GPU COST : ${Job_cost?.NOS} NOS ($${Job_cost?.NOS_USD}) 
SOL GAS FEE : ${Job_cost?.SOL} SOL($${Job_cost?.SOL_USD})
NETWORK FEE : ${Job_cost?.NETWORK} SOL ($${Job_cost?.NETWORK_USD})
---
TOTAL : ${Job_cost?.TOTAL_USD}
`
                }

**Your Job Definition:**
\`\`\`json
${JSON.stringify(params.directJobDef, null, 2)}
\`\`\`

──────────────────────────────
✅ Validation passed! This job is ready to deploy.
Awaiting user confirmation before deployment.
──────────────────────────────
`,
            },
          ],
        };
      } catch (err: any) {
        console.error("Direct job def error:", err);
        return fail(`Failed to process job definition: ${err.message}`);
      }
    }

    // CASE 2: AI-generated job definition (original flow)
    if (!params.model || !params.requirements) {
      return fail(
        "Either provide 'directJobDef' (complete JSON) OR 'model' + 'requirements' for AI generation.",
      );
    }
    let result: TResult | null = null;
    try {
      console.log(params.requirements);
      result = (await chatJSON(
        getResolverPrompt(params.requirements, {
          modelName: params.model,
          marketDetails: params.market ? MARKETS[params.market] : undefined,
        }),
        DecisionSchema,
      )) as TResult;
      console.log("✅ Resolver:", result);
    } catch (err) {
      console.error("❌ chatJSON failed:", err);
      if ((err as Error).message.includes("overloaded"))
        return fail(
          "❌ chatJSON failed: Ai model Overloaded. take a break before request get refresh",
        );
      return fail(
        `❌ chatJSON failed: ${(err as Error).message}. Try calling createJob again or notify the user.`,
      );
    }

    if (!result)
      return fail(
        "❌ No resolver result found. Ask user to retry job creation.",
      );

    function getGpuMarket(requireVram: number) {
      const match = Object.values(MARKETS).find(
        (m) => m.vram_gb >= requireVram,
      );
      if (!match) return null;
      return { slug: match.slug, address: match.address };
    }

    if (!params.market) {
      const gpuMatch = getGpuMarket(result.vRAM_required);

      if (!gpuMatch) {
        const maxVram = Math.max(
          ...Object.values(MARKETS).map((m) => m.vram_gb),
        );
        const topGpus = Object.entries(MARKETS)
          .sort((a, b) => b[1].vram_gb - a[1].vram_gb)
          .slice(0, 5)
          .map(
            ([name, info]) =>
              `  • ${name}: ${info.vram_gb}GB VRAM ($${info.estimated_price_usd_per_hour}/hr)`,
          )
          .join("\n");

        // Calculate quantization options
        const quantOptions = [
          { name: "INT4", factor: 0.25, desc: "~75% VRAM reduction" },
          { name: "INT8", factor: 0.5, desc: "~50% VRAM reduction" },
          { name: "FP8", factor: 0.6, desc: "~40% VRAM reduction" },
        ]
          .map((q) => ({
            ...q,
            vram: Math.ceil(result.vRAM_required * q.factor),
          }))
          .filter((q) => q.vram <= maxVram);

        return fail(`❌ Model requires ${result.vRAM_required}GB VRAM but maximum available GPU has ${maxVram}GB.

**Model:** ${params.model}
**Required VRAM:** ${result.vRAM_required}GB
**Available Maximum:** ${maxVram}GB (nvidia-h100, nvidia-a100-80gb)

**💡 Suggested Solutions:**

1. **Use Quantization** (reduces VRAM requirements):
${quantOptions.length > 0
            ? quantOptions
              .map((q) => `   • ${q.name}: ~${q.vram}GB VRAM (${q.desc}) Fits!`)
              .join("\n")
            : "   • Even with INT4 quantization, model is too large for available GPUs"
          }

2. **Use Smaller Model Variant:**
   • Try a smaller version (e.g., if using 70B → try 7B/13B)
   • Run getModels_from_tags or suggest_model_market to find alternatives

3. **External API Services:**
   • Consider using hosted APIs (OpenAI, Anthropic, etc.) for very large models
   • These handle scaling and infrastructure automatically

4. **Multi-GPU Setup** (not currently supported in Nosana):
   • Model needs ${Math.ceil(result.vRAM_required / maxVram)} GPUs with tensor parallelism
   • This feature is not yet available on Nosana platform

**Top Available GPUs:**
${topGpus}

Try one of these approaches:
- "Deploy ${params.model} with INT4 quantization"
- "Suggest alternative models similar to ${params.model}"
- "Find a smaller variant of ${params.model}"
        `);
      }

      params.market = gpuMatch.slug;
      market_public_key = gpuMatch.address;
      Model_vram = result.vRAM_required;
    }

    if (params.market) {
      market_public_key = MARKETS[params.market].address;
      Model_vram = MARKETS[params.market].vram_gb;
      try {
        Job_cost = await deployer.getExactValue(
          market_public_key,
          params.timeoutSeconds,
        );
      } catch (err) {
        console.warn("⚠️ Could not fetch Job cost:", err);
      }
    }

    if (Model_vram == null)
      return fail(
        `market selection issue : Model_vram undefined , select a existing market , run get market , and choose the market satify the VRAM ${result.vRAM_required} GB requirement and try creating Job againd`,
      );
    if (Model_vram < result.vRAM_required)
      return fail(`❌ Model ${params.model} requires more vram than provided by market ${params.market}
      - ${params.model} requires ${result.vRAM_required} gb vram
      - ${params.market} provides ${Model_vram} gb vram
      . suggest somme compatible market to user
      . or if you chose the market and not user told you to, then run get market tool and choose the market satify the VRAM ${result.vRAM_required} GB requirement and try creating Job again
      `);

    let jobDef: any = null;

    if (result.providerName === "huggingface") {
      const modelInfo = await checkHuggingFaceModel(result.modelName);

      if (modelInfo.status !== 200)
        return fail(
          `Model not reachable (does not exist) (${modelInfo.status}) . try some other similar model you have in your mind or run getModels_from_tags tool to get some models`,
        );
      if (modelInfo.private)
        return fail(
          `⚠️ ${result.modelName} is private on Hugging Face. try some other similar model you have in your mind or run suggest_model_market tool to get some models`,
        );
      if (modelInfo.gated)
        return fail(
          `🔒 ${result.modelName} is gated on Hugging Face. try some other similar model you have in your mind or run suggest_model_market tool to get some models`,
        );

      jobDef = createJobDefination(result, {
        userPubKey: params.userPublicKey,
        market: `${params.market} (${market_public_key})`,
        timeoutSeconds: params.timeoutSeconds,
      });

      let validation: any;
      try {
        validation = validateJobDefinition(jobDef);
      } catch (err) {
        console.error("❌ validateJobDefinition() threw:", err);
        return fail(
          `Job definition validation crashed:\n${(err as Error).message}`,
        );
      }

      if (!validation?.success) {
        console.error(
          "❌ Validation failed:",
          JSON.stringify(validation.errors),
        );
        return fail(
          `Job definition validation failed. Fix inputs and rerun createJob.\n${JSON.stringify(validation.errors)}`,
        );
      }
    } else if (result.providerName == "container") {
      jobDef = createJobDefination(result, {
        userPubKey: params.userPublicKey,
        market: `${params.market} (${market_public_key})`,
        timeoutSeconds: params.timeoutSeconds,
      });

      let validation: any;
      try {
        validation = validateJobDefinition(jobDef);
      } catch (err) {
        console.error("❌ validateJobDefinition() threw:", err);
        return fail(
          `Job definition validation crashed internally:\n${(err as Error).message}`,
        );
      }

      if (!validation?.success) {
        console.error(
          "❌ Validation failed:",
          JSON.stringify(validation.errors),
        );
        return fail(
          `Job definition validation failed. Fix inputs and rerun createJob.\n${JSON.stringify(validation.errors)}`,
        );
      }

      let finalCheck;
      try {
        finalCheck = validateJobDefinition(jobDef);
        if (!finalCheck.success) {
          console.error(
            "❌ Final validation before return failed:",
            JSON.stringify(finalCheck.errors),
          );
          return fail(
            `Job definition invalid before return.\n${JSON.stringify(finalCheck.errors)}`,
          );
        }
      } catch (err) {
        console.error("❌ Final validateJobDefinition threw:", err);
        return fail(
          `Job definition validation crashed before return: ${(err as Error).message}, try resolving again`,
        );
      }
    } else {
      return fail(
        `⚠️ Unsupported provider: ${result.providerName}, createJob again with better details dont end stream, only container | huggingface supported`,
      );
    }

    if (!jobDef)
      return fail("❌ Job definition missing after resolution. Abort.");

    try {
      return {
        tool_execute: true,
        args: {
          ...params,
          marketPubKey: market_public_key,
          provider: result.providerName,
          testGeneration: result.category === "text-generation",
        },
        prompt: jobDef,
        content: [
          {
            type: "text",
            text: `
📦 **Job details**

| Field | Value |
|--------|--------|
| Model | ${result.modelName} |
| GPU Market | ${params.market.toUpperCase()} |
| Timeout | ${(params.timeoutSeconds / 3600).toFixed(2)} hours |

💰 **Cost:**
${!Job_cost && "Failed to get cost, check it from wallet interface"}
GPU COST : ${Job_cost?.NOS} NOS ($${Job_cost?.NOS_USD}) 
SOL GAS FEE : ${Job_cost?.SOL} SOL(${Job_cost?.SOL_USD})
NETWORK FEE : ${Job_cost?.NETWORK} SOL (${Job_cost?.NETWORK_USD})
---
TOTAL : ${Job_cost?.TOTAL_USD}

make sure you will show that to user in json block
This job uses the provided definition. Review this JSON and show to user in json code block:
\`\`\`json
${JSON.stringify(jobDef, null, 2)}
\`\`\`

──────────────────────────────
This job is not published yet.
Awaiting user confirmation before deployment.
──────────────────────────────
`,
          },
        ],
      };
    } catch (err: any) {
      console.error("createJob error:", err);
      return fail(`❌ Failed to create job: ${err.message}`);
    }
  },
});

export const stopJob = tool({
  description: "Stops a running Nosana job.",
  inputSchema: z.object({ jobId: z.string(), job_owners_pubKey: z.string() }),
  execute: async ({ jobId, job_owners_pubKey }) => {
    const deployer = ensureDeployer();
    const jobResult = await deployer.getJob(jobId);

    if (!jobResult)
      return fail(
        `❌ Job ${jobId} not found. JOB SHOULD BE EXISTING TO BE STOPPED`,
      );
    const { job } = jobResult;

    console.log(job);
    if (!job)
      return fail(
        `❌ Job ${jobId} not found. JOB SHOULD BE EXISTING TO BE STOPPED`,
      );

    const validation = checkJobStop(job, job_owners_pubKey.toString());
    if (validation) return validation;

    const gpuMarket = Object.keys(MARKETS).find(
      (key) => MARKETS[key as GpuMarketSlug].address === job.market.toString(),
    );

    try {
      return {
        args: { jobId },
        prompt: {
          Action: "stop_Job",
          args: {
            JobId: jobId,
            market: job.market.toString(),
            node: job.node.toString(),
            payer: `${job.payer} (you)`,
          },
        },
        // tool_execute: true,
        content: [
          {
            type: "text",
            text: `
🛑 **Job Stop Trigger Sent**

Tell the user:
- The stop request was sent successfully.
- The job will be stopped on when user request it to.

**Display Format:**
| Field | Value |
|-------|--------|
| Job ID | ${jobId} |
| Payer | ${job.payer} |
| market_Address | ${job.market} |
| market_Name | ${gpuMarket} |
| price | ${job.price} |
| state | ${job.state} |
| timeout | ${job.timeout} |
| node | ${job.node} |
| Status | Waiting for user Confirmation to Stop |
| Tool | StopJon |
            `,
          },
        ],
      };
    } catch (err: any) {
      console.error("stopJob error:", err);
      return fail(`❌ Failed to stop job: ${err.message}`);
    }
  },
});

export const extendJobRuntime = tool({
  description: "Extends the runtime of an existing Nosana job.",
  inputSchema: z.object({
    jobId: z.string(),
    extensionSeconds: z
      .number()
      .max(86400)
      .min(60)
      .describe("Maximum extension time is 24 hours."),
    job_owners_pubKey: z.string(),
  }),
  execute: async ({ jobId, extensionSeconds, job_owners_pubKey }) => {
    const deployer = ensureDeployer();
    const jobResult = await deployer.getJob(jobId);

    if (!jobResult) return fail(`⚠️ Job ${jobId} not found.`);
    const { job } = jobResult;

    if (!job) {
      return fail(`⚠️ Job ${jobId} not found.`);
    }

    const validation = checkJobExtendable(
      job,
      job_owners_pubKey,
      extensionSeconds,
    );
    if (validation) return validation;

    try {
      return {
        tool_execute: true,
        args: { jobId, extensionSeconds, job_owners_pubKey },
        prompt: {
          Action: "Extend_Job_Runtime",
          args: {
            JobId: jobId,
            market: job.market.toString(),
            node: job.node.toString(),
            seconds: `${extensionSeconds} sec`,
            hours: `${extensionSeconds / 3600} hr`,
            minutes: `${extensionSeconds / 60} min`,
          },
        },

        content: [
          {
            type: "text",
            text: `
⏱️ Job runtime extension prepared.

Job ID: ${jobId}
Extension (seconds): ${extensionSeconds}
State: pending user approval.
            `,
          },
        ],
      };
    } catch (err: any) {
      console.error("extendJobRuntime error:", err);
      return {
        args: { jobId, extensionSeconds },
        content: [
          {
            type: "text",
            text: `❌ Failed to extend job: ${err.message}`,
          },
        ],
      };
    }
  },
});

export const getJob = tool({
  description: "Fetches details about a Nosana job, using its id",
  inputSchema: z.object({ jobId: z.string() }),
  execute: async ({ jobId }) => {
    try {
      const deployer = ensureDeployer();
      if (!deployer) throw new Error("Deployer not initialized");

      const jobResult = await deployer.getJob(jobId);

      if (!jobResult || !jobResult.job) {
        return fail(`⚠️ Job ${jobId} not found.`);
      }

      const { job, NOS_USD } = jobResult;
      console.log("Job details:", job);

      const marketEntry = Object.entries(MARKETS).find(
        ([, m]) => m.address === job.market.toString(),
      );
      const marketName = marketEntry ? marketEntry[0] : "unknown";

      const timeoutSec = job.timeout;
      const timeoutMin = (timeoutSec / 60).toFixed(2);
      const timeoutHrs = (timeoutSec / 3600).toFixed(2);

      const bn = job.price ? Number(job.price.toString()) : 0;
      const usd = (bn / 100) * (NOS_USD || 0);

      return {
        content: [
          {
            type: "text",
            text: `
📄 **Job Information**
for job id ${jobId}
jobId - ${jobId}
market - ${marketName.toUpperCase()}
gpu address - ${job.market.toString()}
payer - ${job.payer.toString()}
state - ${job.state}
price - ${usd}
timeout - ${timeoutSec}s (${timeoutMin} min / ${timeoutHrs} hr)
project - ${job.project.toString()}
node - ${job.node}
ipfsJob - ${job.ipfsJob}
ipfsResult - ${job.ipfsResult}
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

export const getAllJobs = tool({
  description: "Lists all Nosana jobs created by a given user public key.",
  inputSchema: z.object({
    userPubKey: z.string().describe("User's Solana wallet address"),
    state: z
      .enum(["QUEUED", "RUNNING", "COMPLETED", "STOPPED", "ALL"])
      .optional()
      .default("ALL")
      .describe(
        "don't ask user until user from his side dont mention keep all as default",
      ),
  }),

  execute: async ({ userPubKey, state }) => {
    try {
      const deployer = ensureDeployer();
      const jobs = await deployer.getAllJobs(userPubKey, {
        limit: 50,
        state: state ?? "ALL",
      });

      if (!jobs.jobs.length) return fail(`⚠️ No jobs found for ${userPubKey}`);

      const fmt = (t?: number | null) => {
        if (!t || t <= 0) return "";
        const date = new Date(t * 1000);
        return date.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
      };

      const jobLines = jobs.jobs
        .map((j) => {
          const marketName =
            Object.keys(MARKETS).find(
              (m) => MARKETS[m as GpuMarketSlug].address === j.market,
            ) || "Unknown";

          return `
          ──────────────────────────────
          🧱 **Job ID:** ${j.address}
          🏷️ **Market:** ${marketName} | ${j.market}
          📊 **Status:** ${j.jobStatus}
          💸 **Price:** ${j.price} tokens
          ⌛ **Timeout:** ${j.timeout} sec
          🕒 **Start:** ${fmt(j.timeStart)}
          ⏰ **End:** ${fmt(j.timeEnd)}
          📦 **Payer:** ${j.payer}
          📡 **Address:** ${j.address}
          ──────────────────────────────
          `;
        })
        .join("");

      return {
        content: [
          {
            type: "text",
            text: `📊 Jobs for ${userPubKey}
              ──────────────────────────────
              ${jobLines.trim()}
              💡 Commands you can use next:
              • getJob [jobId] → get detailed info
              • extendJob [jobId] → increase runtime
              • stopJob [jobId] → cancel job early
              • createJob → start a new one`,
          },
        ],
      };
    } catch (err: any) {
      console.error("getAllJobs error:", err);
      return fail(`❌ Failed to list jobs: ${err.message}`);
    }
  },
});

export const getWalletBalance = tool({
  description:
    "Fetches Solana + NOS token balances for the connected Nosana account. additinally give you : current solana and nosana usd price",
  inputSchema: z.object({ UsersPublicKey: z.string() }),
  execute: async ({ UsersPublicKey }) => {
    try {
      const deployer = ensureDeployer();

      // Fetch all data in parallel for better performance
      const [balance, solUsd, nosUsd] = await Promise.all([
        deployer.getWalletBalance(UsersPublicKey),
        deployer.get_sol_Usd(),
        deployer.get_nos_Usd(),
      ]);

      const solValue = balance.sol * solUsd;
      const nosValue = balance.nos * nosUsd;
      const totalValue = solValue + nosValue;

      return {
        content: [
          {
            type: "text",
            text: `
            💰 User Wallet Balances
            ────────────────────────────
            SOLANA : ${balance.sol.toFixed(8)} SOL | $${solValue.toFixed(2)}

            NOSANA : ${balance.nos.toFixed(6)} NOS | $${nosValue.toFixed(2)}
            ────────────────────────────
            Total Value (USD): $${totalValue.toFixed(2)}
            ────────────────────────────
            Would you like to check your jobs or create a new one?
                `,
          },
        ],
      };
    } catch (err: any) {
      console.error("getWalletBalance error:", err);
      return fail(`❌ Failed to fetch wallet: ${err.message}`);
    }
  },
});

export const estimateJobCost = tool({
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

      function formatCost(cost: any, mode = "unique") {
        const { market, hours, NOS, USD, NOS_USD, SOL, NETWORK } = cost;

        switch (mode) {
          case "custom":
            return `Running a job on **${market}** for ${hours.toFixed(2)} hours will cost around **${NOS} NOS** (~$${USD.toFixed(
              2,
            )} USD at ${NOS_USD.toFixed(3)} USD/NOS).`;

          case "system":
            return JSON.stringify(cost, null, 2);

          case "unique":
            return `
            GPU Market : ${market}
            Duration   : ${hours.toFixed(2)} hours (${durationSeconds} seconds)
            Est. Cost  : ${NOS} NOS  (~$${USD.toFixed(2)} USD)
            Gas fee    : ${SOL} (gas fee)
            network fee: ${NETWORK} (network fee)`;

          default:
            return `${market}: ${NOS} NOS (~$${USD.toFixed(2)})`;
        }
      }
      return {
        content: [
          {
            type: "text",
            text: formatCost(cost, "unique"),
          },
        ],
      };
    } catch (err: any) {
      console.error("estimateJobCost error:", err);
      return fail(`❌ Failed to estimate cost: ${err.message}`);
    }
  },
});

export const getMarket = tool({
  description: "Return the latest details of a market/GPU on Nosana.",
  inputSchema: z.object({
    gpuMarket_slug: z
      .enum(DEFAULT_MARKETS)
      .optional()
      .describe("either slug or address one is must both are not optional"),
    gpuMarket_address: z
      .string()
      .optional()
      .describe("either address or slug one is must both are not optional"),
  }),
  execute: async ({ gpuMarket_slug, gpuMarket_address }) => {
    try {
      const deployer = ensureDeployer();
      const { market, nos, gpu_usd, marketName } = await deployer.get_market(
        gpuMarket_slug as GpuMarketSlug,
        gpuMarket_address as string,
      );
      const formatted = Object.entries(market)
        .filter(
          ([k]) =>
            ![
              "jobType",
              "vaultBump",
              "nodeAccessKey",
              "nodeXnosMinimum",
              "queueType",
              "queue",
            ].includes(k),
        )
        .map(([k, v]) => `${k}: ${v}`);

      const nos_per_hour = gpu_usd / nos;
      formatted.push(`usd/hr: ${gpu_usd}`);
      formatted.push(`nos/hr: ${nos_per_hour.toFixed(5)}`);

      return {
        content: [
          {
            type: "text",
            text: `📈 GPU Market Details (${gpuMarket_slug ?? marketName})\n${formatted}

            you decide what to show to user, what might be important to him , 
            you decide how should be format from prompt , like how user want 
            be minimal in prompt response
            - must show addresss , marketName , jobprice other are upto you what to show (unless user dont say)
            - ask follow up tool to user , like if user want to calculate cost to run it for hours ? or something like that
            `,
          },
        ],
      };
    } catch (err: any) {
      console.error("getMarket error:", err);
      return fail(`❌ Failed to fetch market: ${err.message}`);
    }
  },
});

export const listGpuMarkets = tool({
  description:
    "Lists all supported Nosana GPU markets and their metadata. give price | vram | slug | address",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      if (!MARKETS || Object.keys(MARKETS).length === 0)
        return { content: [{ type: "text", text: "No GPU markets found." }] };

      const lines = Object.entries(MARKETS).map(
        ([name, info]) =>
          `• ${name}\n  Address: ${info.address}\n  VRAM: ${info.vram_gb}GB \n  Est. USD/hr: ${info.estimated_price_usd_per_hour}
        
        if you find it too much to show to user then choose the best on from variety | show all if user says to say all markets
        if user ask addional query then use your knowledge you had for these gpu's and add along with?
        how these data to show to user you decide , plain | bullet | table or anything its all upto you
        `,
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
      console.error("listGpuMarkets error:", err);
      return fail(`❌ Failed to list GPU markets: ${err.message}`);
    }
  },
});

export const suggest_model_market = tool({
  description:
    "Suggests the best GPU markets and models based on user requirements.",
  inputSchema: z.object({
    requirements: z.string().describe("user's requirements, separated by '|'"),
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
            `→ ${m.name} (${m.address}) — ${m.price}/hr\n   Reason: ${m.reason} Score : ${m.recommandation_score}`,
        )
        .join("\n");

      const formattedModels = result.model
        .map(
          (m) =>
            `→ ${m.name}\n   Reason: ${m.reason} Score : ${m.recommandation_score}`,
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `📊 Based on your requirements, here are the optimal model and market options:

# 🖥️ Markets / GPUs
${formattedMarkets}

# 🧠 Models
${formattedModels}`,
          },
        ],
      };
    } catch (err: any) {
      return fail(`Failed to suggest model and market: ${err.message}`);
    }
  },
});

export const getModels_from_tags = tool({
  description:
    "give hugging face model list from tags, you just use it for for him, used when same name models are giving error",
  inputSchema: z.object({
    modelProvider: z
      .string()
      .describe(
        "organization name ex deepseek-ai , mistralai , qwen , qwen2 , qwen1.5 , google etc.",
      ),
    tags: z.array(z.string()).describe(`
    Examples:
      • prompt : deepseek coder model with 7B parameters, instruct tuned
        tags   : ['deepseek', 'coder', '7B', 'instruct']

      • prompt : qwen model with 20B+ parameters
        tags   : ['qwen','32B', '72B']

      • prompt : mistral large instruct model
        tags   : ['mistral', '24B', '123B', 'instruct']

      • prompt : llama 3 instruct model
        tags   : ['llama', '8B', 'instruct']
    `),
    pipeline: z
      .enum(["image-text-to-text", "text-generation"])
      .describe("the pipeline name"),
  }),
  execute: async ({ tags, modelProvider, pipeline }) => {
    const deployer = ensureDeployer();
    const models = await deployer.getModels({
      pipeline: pipeline,
      keywords: tags,
      organization: modelProvider,
    });

    const prompt = models.map((m) => `- ${m.id}`).join("\n");
    try {
      return {
        content: [
          {
            type: "text",
            text: `
            ${prompt}
            `,
          },
        ],
      };
    } catch (err: any) {
      return fail(`Failed to get models: ${err.message}`);
    }
  },
});

export const validate_job_definition = tool({
  description:
    "Validates and debugs a Nosana job definition JSON. Use this when user provides a complete JSON config or wants to check their config for errors. Does NOT execute the job, only validates syntax and structure.",
  inputSchema: z.object({
    jobDefinition: z
      .record(z.string(), z.any())
      .describe("The complete job definition JSON object to validate"),
    strict: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "If true, performs strict validation. If false, only checks critical fields.",
      ),
  }),
  execute: async ({ jobDefinition }) => {
    try {
      // Validate using Nosana SDK
      const validation = validateJobDefinition(jobDefinition);

      if (!validation.success) {
        const errors =
          validation.errors
            ?.map((e: any) => `  • ${e.path.join(".")}: ${e.message}`)
            .join("\n") || "Unknown validation errors";

        return {
          content: [
            {
              type: "text",
              text: `
❌ **Job Definition Validation Failed**

**Errors Found:**
${errors}

**Provided JSON:**
\`\`\`json
${JSON.stringify(jobDefinition, null, 2)}
\`\`\`

**Suggestions:**
- Check that all required fields are present: type, version, ops, meta
- Ensure 'ops' is an array with at least one operation
- Verify 'image' field contains a valid container image
- Check that 'env' is an object with string key-value pairs
- Ensure 'expose' is a valid port number (1-65535)

Would you like me to help fix these issues?
`,
            },
          ],
        };
      }

      // Additional checks
      const issues: string[] = [];
      const warnings: string[] = [];

      // Check for common issues
      if (jobDefinition.ops?.[0]?.args?.image) {
        const image = jobDefinition.ops[0].args.image;
        if (!image.includes("/") && !image.includes(":")) {
          warnings.push(
            "Image name might be incomplete. Expected format: org/repo:tag or registry/org/repo:tag",
          );
        }
      }

      if (jobDefinition.ops?.[0]?.args?.env) {
        const env = jobDefinition.ops[0].args.env;
        const requiredEnvForTextGen = ["MODEL_ID", "MAX_MODEL_LEN"];
        const hasTextGenKeys = requiredEnvForTextGen.some((key) => key in env);

        if (
          jobDefinition.ops[0].args.image?.includes(
            "text-generation-inference",
          ) &&
          !hasTextGenKeys
        ) {
          warnings.push(
            "Text generation image detected but missing common env vars like MODEL_ID or MAX_MODEL_LEN",
          );
        }
      }

      const vram =
        jobDefinition.ops?.[0]?.args?.required_vram ||
        jobDefinition.meta?.system_requirements?.required_vram;
      if (!vram) {
        warnings.push(
          "No VRAM requirement specified. Consider adding required_vram field.",
        );
      }

      if (!jobDefinition.ops?.[0]?.args?.expose) {
        warnings.push(
          "No port exposed. Service might not be accessible externally.",
        );
      }

      // Check for HF token in gated models
      if (jobDefinition.ops?.[0]?.args?.env?.MODEL_ID) {
        const modelId = jobDefinition.ops[0].args.env.MODEL_ID;
        if (
          !jobDefinition.ops[0].args.env?.HF_TOKEN &&
          !jobDefinition.ops[0].args.env?.HUGGING_FACE_HUB_TOKEN
        ) {
          warnings.push(
            `Model ${modelId} might be gated or private. Consider adding HF_TOKEN if needed.`,
          );
        }
      }

      return {
        content: [
          {
            type: "text",
            text: `
✅ **Job Definition is Valid!**

${warnings.length > 0
                ? `
⚠️ **Warnings (non-critical):**
${warnings.map((w) => `  • ${w}`).join("\n")}
`
                : ""
              }

**Validated JSON:**
\`\`\`json
${JSON.stringify(jobDefinition, null, 2)}
\`\`\`

**Summary:**
- Type: ${jobDefinition.type}
- Operations: ${jobDefinition.ops?.length || 0}
- Image: ${jobDefinition.ops?.[0]?.args?.image || "Not specified"}
- Exposed Port: ${jobDefinition.ops?.[0]?.args?.expose || "None"}
- GPU Required: ${jobDefinition.ops?.[0]?.args?.gpu ? "Yes" : "No"}
- VRAM: ${vram || "Not specified"} GB

**Next Steps:**
1. Copy this JSON to Nosana Dashboard: https://dashboard.nosana.com/deploy
2. Or use createJob tool to deploy it with your wallet

${issues.length > 0
                ? `
**Critical Issues to Fix:**
${issues.map((i) => `  • ${i}`).join("\n")}
`
                : ""
              }
`,
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `
❌ **Validation Error**

${err.message || "Unknown error during validation"}

**Provided JSON:**
\`\`\`json
${JSON.stringify(jobDefinition, null, 2)}
\`\`\`

**Common Issues:**
- Missing required fields (type, version, ops, meta)
- Invalid JSON structure
- Incorrect data types for fields

Would you like me to help you create a proper job definition from scratch?
`,
          },
        ],
      };
    }
  },
});
