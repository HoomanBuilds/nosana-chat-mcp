import z from "zod";
import { tool } from "ai";
import { chatJSONRetry, createJobDefination, findFamilyByModel, getModelData, getRelatedModels } from "./utils/draft.helper";
import { chatJSON } from "./utils/helpers";
import { ContainerExecutionTemplate, ModelQuerySchema } from "./utils/schema";
import { model_families } from "../modelfamily";
import { DEFAULT_MARKETS } from "./utils/types";
import { fail } from "assert";
import { validateJobDefinition } from "@nosana/sdk";
import { MARKETS } from "./utils/supportingModel";
import { ensureDeployer } from "./Deployer";
import { JOB_MESSAGE } from "./utils/contants";
import { extractDefination, getResolvedPrompt } from "./utils/draft.prompt";
import { ExtractedJobDefinition, JobDefinitionSchema } from "./utils/draft.schema";


export const createJob = tool({
     description: `
     Create or update a Nosana job definition.
     - Use 'directJobDef' only when the user provides a full Nosana job JSON (type, ops, meta).
     - If user just gives changes (e.g., add env var, update port, etc.), modify existing def internally.
     - Always include 'requirements' — a verbose summary of model, GPU, runtime, env , commands and all configuration details.
     - If user mentions GPU or runtime, extract 'market' accordingly.
     - show the job defination to user in JSON code block one you get it
     `,

     inputSchema: z.object({
          directJobDef: z
               .record(z.string(), z.any())
               .optional()
               .describe(
                    "Complete Nosana job definition with 'type', 'ops', and 'meta'. If not given, generate dynamically."
               ),
          requirements: z
               .string()
               .describe(
                    "Complete user request context. Must include model name, family, GPU needs, env vars (like API_KEY), ports, commands, and all custom parameters provided by the user. Used to dynamically build the full job definition."
               ),
          userPublicKey: z.string(),
          market: z
               .enum(DEFAULT_MARKETS)
               .optional()
               .describe("GPU market; if unsure, auto-select safe default."),
          timeoutSeconds: z
               .number()
               .min(600)
               .max(86400 * 7)
               .default(3600)
               .describe("Default: 1 hour."),
     }),

     execute: async (params) => {
          const deployer = ensureDeployer();
          let market_public_key: string = "";
          let Job_cost: number | null = null;

          console.log("params", params);
          try {
               if (params.directJobDef) {
                    try {
                         const validation = validateJobDefinition(params.directJobDef);
                         if (!validation.success) {
                              return fail(
                                   JOB_MESSAGE.validation_failed(validation.errors?.join("\n") || "Unknown validation errors", schemaShape(ContainerExecutionTemplate))
                              );
                         }

                         try {
                              const defaultMarket = MARKETS[params.market || "nvidia-4070"];
                              if (!defaultMarket)
                                   throw new Error(`Market ${params.market || "nvidia-4070"} not found in MARKETS`);
                              market_public_key = defaultMarket.address;
                         } catch (err) {
                              console.error("Market resolution error:", err);
                              return fail(`GPU market resolution failed: ${(err as Error).message}`);
                         }

                         const jobImage = params.directJobDef.ops?.[0]?.args?.image || "";
                         const vram =
                              params.directJobDef.ops?.[0]?.args?.required_vram ||
                              params.directJobDef.meta?.system_requirements?.required_vram ||
                              8;

                         try {
                              if (!params.market) {
                                   const compatibleMarket = Object.entries(MARKETS).find(
                                        ([, m]) => m.vram_gb >= vram
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
                              const costDetails = await deployer.getExactValue(market_public_key, params.timeoutSeconds);
                              Job_cost = costDetails.TOTAL_USD;
                         } catch (err) {
                              console.warn("Job cost computation failed:", err);
                              return fail(
                                   JOB_MESSAGE.job_cost_failed(market_public_key, params.timeoutSeconds, err)
                              );
                         }

                         return {
                              tool_execute: true,
                              args: {
                                   ...params,
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
                                             Job_cost
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
                    const resolvedPrompt = getResolvedPrompt(params.requirements, model_families);
                    const query = await chatJSONRetry(resolvedPrompt, ModelQuerySchema);

                    console.log("query", query);
                    const models = await getModelData();
                    const results = getRelatedModels(models, query);
                    console.log("results", results);

                    const extract_jobdef_prompt = extractDefination(
                         params.requirements + query.input,
                         results,
                         MARKETS
                    );

                    const extract_jobdef: ExtractedJobDefinition = await chatJSON(
                         extract_jobdef_prompt,
                         JobDefinitionSchema,
                         "qwen3:0.6b"
                    );

                    try {
                         let selected;

                         if (params.market) {
                              selected = MARKETS[params.market];
                              if (!selected) throw new Error(`Market ${params.market} not found.`);
                         } else {
                              const fallback = Object.entries(MARKETS).find(
                                   ([, m]) => m.vram_gb >= (extract_jobdef.vRAM_required || 6)
                              );
                              selected = fallback?.[1];
                         }

                         market_public_key = selected?.address ?? MARKETS["nvidia-4070"].address;
                    } catch (err) {
                         console.warn("Market resolution fallback:", err);
                         market_public_key = MARKETS["nvidia-4070"].address;
                    }

                    const family = findFamilyByModel(models, extract_jobdef.modelName) || query.families[0] || "";
                    let jobdef: any;
                    try {
                         jobdef = createJobDefination(extract_jobdef, {
                              userPubKey: params.userPublicKey,
                              market: params.market || market_public_key,
                              timeoutSeconds: params.timeoutSeconds,
                              family: family + "/"
                         });
                    } catch (err) {
                         console.error("Job definition creation failed:", err);
                         return fail(`Failed to create job definition: ${(err as Error).message}`);
                    }
                    console.log("jobdef", JSON.stringify(jobdef));

                    if (!jobdef)
                         return fail("❌ Job definition missing after resolution. Abort.");

                    const validation = validateJobDefinition(jobdef);

                    if (!validation.success) {
                         const formattedErrors = (validation.errors || [])
                              .map(e => {
                                   const path = Array.isArray(e.path)
                                        ? e.path.join(".")
                                        : (typeof e.path === "string" ? e.path : "");
                                   const msg = typeof e === 'object' && e ? (e as { message?: string }).message || JSON.stringify(e) : String(e);
                                   return `• ${path}: ${msg}`;
                              })
                              .join("\n");

                         return fail(
                              JOB_MESSAGE.validation_failed(
                                   formattedErrors || "Unknown validation errors",
                                   schemaShape(ContainerExecutionTemplate)
                              )
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
                                        extract_jobdef.image || "",
                                        market_public_key,
                                        extract_jobdef.vRAM_required,
                                        params.timeoutSeconds,
                                        Job_cost
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
     description: `
     Expands user requests into a detailed model definition.
     Extract key details like family, size, GPU preference, quantization, and constraints from the query.
     Write a single, clear, and descriptive prompt that captures all main requirements — no need for long extra text or repetition.
     Focus on clarity and intent, not verbosity.
     `,

     inputSchema: z.object({
          prompt: z
               .string()
               .describe("User or system query describing the model requirement. | dont ask it from user get it from text and history context"),
     }),

     execute: async ({ prompt }) => {
          console.log(prompt);
          const resolvedPrompt = getResolvedPrompt(prompt, model_families);
          const query = await chatJSON(resolvedPrompt, ModelQuerySchema, "qwen3:0.6b");
          const models = await getModelData();

          console.log(query);
          const results = getRelatedModels(models, query);
          const summary = `
          Model request: ${query.input}

          Families: ${query.families?.join(", ") || "-"}
          Params: ${query.params?.op || ""} ${query.params?.value || "any"}
          Quant: ${query.quant || "-"}
          GPU: ${query.gpuPreference || "-"}
          Memory: ${query.memoryUtilization || "-"}
          Parallelism: ${query.tensorParallelism ?? "auto"}
          Sort: ${query.sort || "relevance"}

          Write a clear, readable summary of the top ${results.length} models.
          Use a short intro explaining which types of models fit best and why.
          Then show the models in a clean bullet or numbered list, one per line, including size, GPU needs, and notes.
          Add brief recommendations or trade-offs (e.g., cost vs. speed, lighter vs. powerful).
          Be natural and confident — like an engineer giving advice, not a robot or narrator.
          Avoid repeating the query text; focus on insight.

          Models:
          ${results.map((m, i) =>
               `${i + 1}. ${m.family} → ${m.name} (${m.recommendedGPU?.parameters || "?"} GPU, score: ${m.score.toFixed(2)})`
          ).join("\n")}
          `.trim();

          return {
               content: [{ type: "tool", text: summary }],
          };
     },
});


function schemaShape(schema: z.ZodObject<any>): Record<string, string> {
     return Object.fromEntries(
          Object.entries(schema.shape).map(([k, v]) => [k, (v as any)._def.typeName])
     );
}