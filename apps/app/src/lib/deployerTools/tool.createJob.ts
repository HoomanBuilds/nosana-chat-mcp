import z from "zod";
import { tool } from "ai";
import { buildOllamaJob, buildVllmJob } from "./utils/draft.helper";
import { fail } from "./utils/helpers";
import { DEFAULT_MARKETS } from "./utils/types";
import { validateJobDefinition } from "@nosana/sdk";
import { MARKETS } from "./utils/supportingModel";
import { ensureDeployer } from "./Deployer";
import { JOB_MESSAGE } from "./utils/contants";
import { extractDefination } from "./utils/draft.prompt";
import { getPlannerModel } from "./utils/plannerContext";
import { schemaShape, ContainerExecutionTemplate } from "./utils/schema";

export const createJob = tool({
  description: `Create a Nosana job and show a deploy button.
- For model deployments: REQUIRES resolvedModel from getModels tool. Call getModels first, then pass its result here.
- For direct JSON: use directJobDef.
- For custom containers only (nginx, n8n, etc.): use requirements.
- If user mentions "vllm", "openai-compatible", or "openai api", set runtime to "vllm". Otherwise defaults to "ollama".`,

  inputSchema: z.object({
    directJobDef: z
      .record(z.string(), z.any())
      .optional()
      .describe(
        "Complete Nosana job definition with 'type', 'ops', and 'meta'.",
      ),
    resolvedModel: z
      .object({
        hf_id: z
          .string()
          .describe(
            "HuggingFace model ID for vLLM, e.g. mistralai/Mistral-7B-Instruct-v0.3",
          ),
        ollama_tag: z
          .string()
          .nullable()
          .describe(
            "Ollama pull tag e.g. mistral:7b, or null if not in Ollama library",
          ),
        vram: z.number().describe("Required VRAM in GB"),
      })
      .optional()
      .describe("Pre-resolved model info from getModels tool."),
    runtime: z
      .enum(["ollama", "vllm"])
      .optional()
      .describe(
        "Runtime engine for model deployments. Set to 'vllm' when user asks for vLLM, OpenAI-compatible API, or HuggingFace model. Defaults to 'ollama'.",
      ),
    requirements: z
      .string()
      .optional()
      .describe(
        "Only for custom non-LLM containers (e.g. nginx, n8n, Jupyter). Do NOT use this for model deployments — use resolvedModel from getModels instead.",
      ),
    userPublicKey: z
      .string()
      .optional()
      .describe("User's Solana wallet address. Optional in API key mode."),
    market: z
      .enum(DEFAULT_MARKETS)
      .optional()
      .describe("GPU market; if unsure, auto-select based on VRAM."),
    timeoutSeconds: z
      .number()
      .min(600)
      .max(86400 * 7)
      .default(3600)
      .describe("Default: 1 hour."),
  }),

  execute: async (params) => {
    const deployer = ensureDeployer();
    const plannerModel = getPlannerModel();
    if (!plannerModel) throw new Error("No model selected");
    let market_public_key: string = "";
    let Job_cost: number | null = null;

    // Default userPublicKey if missing (API key mode)
    const effectiveUserPubKey = params.userPublicKey || "api-key-user";

    console.log("params", params);
    try {
      if (params.directJobDef) {
        try {
          const validation = validateJobDefinition(params.directJobDef);
          if (!validation.success) {
            const formattedErrors = (validation.errors || [])
              .map((e: any) => {
                const path = Array.isArray(e?.path)
                  ? e.path.join(".")
                  : typeof e?.path === "string"
                    ? e.path
                    : "";
                const message =
                  typeof e?.message === "string"
                    ? e.message
                    : JSON.stringify(e);
                return path ? `• ${path}: ${message}` : `• ${message}`;
              })
              .join("\n");
            return fail(
              JOB_MESSAGE.validation_failed(
                formattedErrors || "Unknown validation errors",
                schemaShape(ContainerExecutionTemplate),
              ),
            );
          }

          try {
            const defaultMarket = MARKETS[params.market || "nvidia-4070"];
            if (!defaultMarket)
              throw new Error(
                `Market ${params.market || "nvidia-4070"} not found in MARKETS`,
              );
            market_public_key = defaultMarket.address;
          } catch (err) {
            console.error("Market resolution error:", err);
            return fail(
              `GPU market resolution failed: ${(err as Error).message}`,
            );
          }

          const jobImage = params.directJobDef.ops?.[0]?.args?.image || "";
          const vram =
            params.directJobDef.ops?.[0]?.args?.required_vram ||
            params.directJobDef.meta?.system_requirements?.required_vram ||
            8;

          try {
            if (!params.market) {
              const compatibleMarket = Object.entries(MARKETS).find(
                ([, m]) => m.vram_gb >= vram,
              );
              if (compatibleMarket) {
                params.market = compatibleMarket[0] as any;
                market_public_key = compatibleMarket[1].address;
              }
            } else {
              const selected = MARKETS[params.market];
              if (!selected)
                throw new Error(`Unknown market: ${params.market}`);
              market_public_key = selected.address;
            }
          } catch (err) {
            console.warn("Market fallback logic failed:", err);
            market_public_key = MARKETS["nvidia-4070"]?.address ?? "";
          }

          try {
            const costDetails = await deployer.getExactValue(
              market_public_key,
              params.timeoutSeconds,
            );
            Job_cost = costDetails.TOTAL_USD;
          } catch (err) {
            console.warn("Job cost computation failed:", err);
            return fail(
              JOB_MESSAGE.job_cost_failed(
                market_public_key,
                params.timeoutSeconds,
                err,
              ),
            );
          }

          return {
            tool_execute: true,
            args: {
              ...params,
              userPublicKey: effectiveUserPubKey,
              marketPubKey: market_public_key,
            },
            prompt: params.directJobDef,
            content: [
              {
                type: "text",
                text: JOB_MESSAGE.job_ready_to_deploy(
                  params.directJobDef,
                  jobImage,
                  market_public_key,
                  vram,
                  params.timeoutSeconds,
                  Job_cost,
                ),
              },
            ],
          };
        } catch (err: any) {
          console.error("Direct job def error:", err);
          return fail(`Failed to process job definition: ${err.message}`);
        }
      }

      try {
        // --- Fast-path: resolvedModel from getModels tool ---
        let jobdef: any;

        if (params.resolvedModel) {
          const { hf_id, ollama_tag, vram } = params.resolvedModel;
          const wantsVllm =
            params.runtime === "vllm" ||
            /vllm|openai.?compat|openai.?api/i.test(params.requirements || "");
          if (!wantsVllm && ollama_tag) {
            jobdef = buildOllamaJob(ollama_tag, vram);
          } else {
            jobdef = buildVllmJob(hf_id, vram);
          }
        } else {
          // Fallback: LLM generates job JSON from requirements
          const req = params.requirements || "";
          const extract_jobdef_prompt = extractDefination(req, {}, MARKETS);
          const { text } = await (
            await import("ai")
          ).generateText({
            model: (await import("@ai-sdk/openai"))
              .createOpenAI({
                apiKey:
                  process.env.LLM_PROVIDER === "deepseek"
                    ? process.env.DEEPSEEK_API_KEY || ""
                    : process.env.INFERIA_LLM_API_KEY || "nosana-local",
                baseURL:
                  process.env.LLM_PROVIDER === "deepseek"
                    ? process.env.DEEPSEEK_BASE_URL ||
                      "https://api.deepseek.com/v1"
                    : process.env.NEXT_PUBLIC_INFERIA_LLM_URL || "",
              })
              .chat(plannerModel),
            prompt: extract_jobdef_prompt,
          });
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) return fail("No JSON in LLM response");
          jobdef = JSON.parse(jsonMatch[0]);
        }

        // Resolve market_public_key
        if (params.market) {
          const selected = MARKETS[params.market];
          if (!selected) return fail(`Unknown market: ${params.market}`);
          market_public_key = selected.address;
        } else {
          const requiredVram =
            jobdef.meta?.system_requirements?.required_vram || 6;
          const fallback = Object.entries(MARKETS).find(
            ([, m]) => m.vram_gb >= requiredVram,
          );
          market_public_key =
            fallback?.[1]?.address ?? MARKETS["nvidia-4070"].address;
        }

        // Inject only the required meta fields into the job definition
        jobdef.meta = {
          trigger: jobdef.meta?.trigger || "dashboard",
          system_requirements: jobdef.meta?.system_requirements,
        };

        console.log("jobdef", JSON.stringify(jobdef));

        if (!jobdef)
          return fail("❌ Job definition missing after resolution. Abort.");

        const validation = validateJobDefinition(jobdef);

        if (!validation.success) {
          const formattedErrors = (validation.errors || [])
            .map((e) => {
              const path = Array.isArray(e.path)
                ? e.path.join(".")
                : typeof e.path === "string"
                  ? e.path
                  : "";
              const msg =
                typeof e === "object" && e
                  ? (e as { message?: string }).message || JSON.stringify(e)
                  : String(e);
              return `• ${path}: ${msg}`;
            })
            .join("\n");

          return fail(
            JOB_MESSAGE.validation_failed(
              formattedErrors || "Unknown validation errors",
              schemaShape(ContainerExecutionTemplate),
            ),
          );
        }

        return {
          tool_execute: true,
          args: {
            ...params,
            marketPubKey: market_public_key,
          },
          prompt: jobdef,
          content: [
            {
              type: "text",
              text: JOB_MESSAGE.job_ready_to_deploy(
                jobdef,
                jobdef.ops?.[0]?.args?.image || "",
                market_public_key,
                jobdef.meta?.system_requirements?.required_vram,
                params.timeoutSeconds,
                Job_cost,
              ),
            },
          ],
        };
      } catch (err: any) {
        console.error("Dynamic job creation error:", err);
        return fail(`Unexpected error during job creation: ${err.message}`);
      }
    } catch (outerErr: any) {
      console.error("Top-level createJob error:", outerErr);
      return fail(`Fatal error in createJob: ${outerErr.message}`);
    }
  },
});

export const getModels = tool({
  description: `Resolve a model name into its HuggingFace ID, Ollama tag, and estimated VRAM. Call this before createJob for any model deployment.`,

  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "The user's model request, e.g. 'mistral 7b', 'GPT-OSS 20B', 'llama 3.1 70b instruct'",
      ),
  }),

  execute: async ({ query }) => {
    const plannerModel = getPlannerModel();
    if (!plannerModel) throw new Error("No model selected");

    const { generateText } = await import("ai");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const openai = createOpenAI({
      apiKey:
        process.env.LLM_PROVIDER === "deepseek"
          ? process.env.DEEPSEEK_API_KEY || ""
          : process.env.INFERIA_LLM_API_KEY || "nosana-local",
      baseURL:
        process.env.LLM_PROVIDER === "deepseek"
          ? process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1"
          : process.env.NEXT_PUBLIC_INFERIA_LLM_URL || "",
    });

    // Step 1: search HuggingFace API
    const hfUrl = new URL("https://huggingface.co/api/models");
    hfUrl.searchParams.set("search", query);
    hfUrl.searchParams.set("limit", "5");
    hfUrl.searchParams.set("sort", "downloads");
    hfUrl.searchParams.set("direction", "-1");
    const hfRes = await fetch(hfUrl.href).catch(() => null);
    const hfModels: any[] = hfRes?.ok ? await hfRes.json().catch(() => []) : [];
    const candidates = hfModels
      .map((m: any) => m.modelId || m.id)
      .filter(Boolean);

    // Step 2: LLM resolves both IDs
    const { text } = await generateText({
      model: openai.chat(plannerModel),
      prompt: `You are a model resolver. The user wants to deploy: "${query}"

HuggingFace search returned these real model IDs:
${candidates.length ? candidates.map((c, i) => `${i + 1}. ${c}`).join("\n") : "(no results)"}

Output ONLY a JSON object with:
- "hf_id": best matching HuggingFace model ID from the list (used for vLLM)
- "ollama_tag": the Ollama pull tag from ollama.com/library (e.g. "mistral:7b", "llama3.1:8b"). Set null if the model is not in the Ollama library.
- "vram": estimated VRAM in GB (integer). 7B fp16=14, 7B int4=5, 13B=26, 20B=40, 70B int4=40

Output only JSON.`,
    });

    const match = text.match(/\{[\s\S]*\}/);
    if (!match)
      return {
        content: [
          { type: "text", text: `Could not resolve model for: ${query}` },
        ],
      };

    const resolved = JSON.parse(match[0]);
    console.log("resolved model:", resolved);
    return { content: [{ type: "text", text: JSON.stringify(resolved) }] };
  },
});
