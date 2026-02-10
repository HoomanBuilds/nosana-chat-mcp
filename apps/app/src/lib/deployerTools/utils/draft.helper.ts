import path from "path";
import fs from "fs";
import { ModelFamily, QueryFilter, ScoredModel } from "./types";
import { ExtractedJobDefinition } from "./draft.schema";
import { HOOMAN_IMAGE } from "./contants";
import { chatJSON } from "./helpers";
import z from "zod";
import { getPlannerModel } from "./plannerContext";

export async function getModelData(): Promise<any[]> {
    if (typeof window === "undefined") {
        const filePath = path.join(process.cwd(), "data", "models.json");
        const data = fs.readFileSync(filePath, "utf8");
        return JSON.parse(data);
    }

    const res = await fetch("/models.json");
    if (!res.ok) throw new Error(`Failed to fetch models.json: ${res.status}`);
    return await res.json();
}

export function getRelatedModels(models: ModelFamily[], q: QueryFilter): ScoredModel[] {
    const scored: ScoredModel[] = [];

    const cmp = (a: number, op: string, b: number): boolean => {
        switch (op) {
            case "<": return a < b;
            case "<=": return a <= b;
            case ">": return a > b;
            case ">=": return a >= b;
            case "=":
            case "==": return Math.abs(a - b) <= b * 0.001;
            default: return false;
        }
    };

    for (const fam of models) {
        if (q.families && !q.families.some(f => fam.family.toLowerCase().includes(f.toLowerCase())))
            continue;

        for (const m of fam.models) {
            const rec = m.recommendedGPU ?? {};
            const params = parseParameters(rec.parameters ?? m.parameters ?? 0);
            const price = rec.pricePerHour ?? 6;
            const mem = parseMemLevel(rec.memoryUtilization ?? "mid");
            const hasTP = !!rec.tensorParallelism;

            let score = 0;

            // --- PARAMETER MATCH ---
            if (q.params?.value) {
                const v = q.params.value;
                const op = (q.params.op ?? "=").trim();
                const strict = q.params.strict ?? false;

                if (!params || isNaN(params)) {
                    if (strict) continue;
                    else score -= 1;
                }

                if (strict) {
                    if (!cmp(params, op, v)) continue;
                    score += 1;
                } else {
                    const diffRatio = params / v;

                    switch (op) {
                        case "<":
                        case "<=":
                            if (params < v) score += 1 + 0.3 * Math.log10(v / params + 1);
                            else score -= 0.5 * Math.log10(params / v + 1);
                            break;

                        case ">":
                        case ">=":
                            if (params > v) score += 1 + 0.3 * Math.log10(params / v + 1);
                            else score -= 0.5 * Math.log10(v / params + 1);
                            break;

                        default:
                            const diff = Math.abs(Math.log10(params / v));
                            score += Math.max(0, 1 - diff);
                            break;
                    }
                }
            }

            // --- SIZE BOOST ---
            if (params >= 1e9) score += 0.3;
            if (params >= 5e9) score += 0.5;

            // --- QUANT / TAGS ---
            if (q.quant && m.name.toLowerCase().includes(q.quant.toLowerCase())) score += 0.5;
            if (q.tags?.some(t => fam.tags?.includes(t))) score += 0.3;

            // --- GPU PREF ---
            if (q.gpuPreference) {
                if (price > 6 && q.gpuPreference === "expensive") score += 0.7;
                else if (price > 2 && price <= 6 && q.gpuPreference === "medium") score += 0.5;
                else if (price >= 0.5 && price <= 2 && q.gpuPreference === "balance") score += 0.4;
                else score -= 0.3;
                if (/fp16|bf16|full/.test(m.name.toLowerCase()) && q.gpuPreference === "expensive")
                    score += 0.3;
            }

            // --- MEMORY UTILIZATION ---
            const pref = q.memoryUtilization?.toLowerCase();
            if (pref) {
                score += pref === mem ? 0.4 : -0.2;
                if (pref === "high" && mem === "high" && params >= 1e9) score += 0.2;
            }

            // --- PARALLELISM ---
            if (typeof q.tensorParallelism === "boolean") {
                score += q.tensorParallelism === hasTP ? 0.3 : -0.2;
                if (q.tensorParallelism && hasTP && params >= 1e9) score += 0.2;
            }

            // --- FRESHNESS / RECENCY ---
            const isLatest =
                m.name.toLowerCase().includes("latest") ||
                fam.tags?.some(t => t.toLowerCase() === "latest");
            if (fam.last_updated?.includes("day")) score += 0.2;
            if (isLatest) score += 0.7 + (q.sort === "latest" ? 0.8 : 0);

            scored.push({ ...m, family: fam.family, score });
        }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, 10);
}

function parseParameters(p: string | number): number {
    if (!p || p === "unknown") return 0;
    const val = typeof p === "number" ? p : parseFloat(p);
    if (isNaN(val)) return 0;
    const lower = p.toString().toLowerCase();
    if (lower.includes("b")) return val * 1e9;
    if (lower.includes("m")) return val * 1e6;
    if (lower.includes("k")) return val * 1e3;
    return val;
}

function parseMemLevel(utilStr: string): "low" | "mid" | "high" {
    const val = parseFloat(utilStr);
    if (isNaN(val)) return "mid";
    if (val >= 75) return "high";
    if (val >= 40) return "mid";
    return "low";
}


export function createJobDefination(
    result: ExtractedJobDefinition,
    { userPubKey, market, timeoutSeconds, family }: { userPubKey: string; market?: string; timeoutSeconds?: number, family?: string }
) {
    const now = new Date().toISOString();
    const isTemplate = result.type === "template";

    const baseEnv: Record<string, string> = {
        MODEL_NAME: `${result.modelName}` || "unknown",
        SERVED_MODEL_NAME: result.modelName || "unknown",
        PORT: String(result.exposePort) || "8000",
        MAX_MODEL_LEN: "NAN",
        PARAMETER_SIZE: result.parameterSize ? getSafeParameterSize(result.parameterSize) : "10B",
        QUANTIZATION: "NAN",
        MEMORY_LIMIT: "NAN",
        TENSOR_PARALLEL_SIZE: "1",
        GPU_MEMORY_UTILIZATION: "NAN",
        SWAP_SPACE: "NAN",
        BLOCK_SIZE: "NAN",
        ENABLE_STREAMING: "false",
        API_KEY: "",
    };

    const resultEnvObject = Array.isArray(result.env)
        ? Object.fromEntries(result.env.map(({ key, value }) => [key, value]))
        : (result.env || {});

    const env = isTemplate
        ? { ...baseEnv, ...resultEnvObject }
        : resultEnvObject;
    // const hardcodedResources = [
    //     {
    //         type: "HF",
    //         repo: `${result.modelName}`,
    //         target: `/data-models/`,
    //     },
    // ];

    return {
        version: "0.1",
        type: "container",
        meta: {
            trigger: "cli",
            system_requirements: {
                required_vram: result.vRAM_required || 6,
            },
            description:
                result.otherExtra?.Description ?? `AI job for ${result.modelName} model.`,
            owner: userPubKey,
            created_at: now,
            referer: "nosana-chat",
            ...(market && { market }),
            ...(timeoutSeconds && { timeout: timeoutSeconds }),
            // category: result.category ?? "Unknown",
        },
        ops: [
            {
                id: `oneClickLLM`,
                type: "container/run",
                args: {
                    ...(result.command != null ? { cmd: result.command } : {}),
                    gpu: result.gpu ?? false,
                    image: isTemplate ? HOOMAN_IMAGE : result.image,
                    expose: result.exposePort || 8000,
                    env: env,
                    resources: isTemplate
                        ? []
                        : result.resources?.length
                            ? result.resources
                            : [],
                },
            },
        ],

    };
}

export async function chatJSONRetry<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    primaryModel?: string
): Promise<T> {
    const preferredModel =
        primaryModel ||
        getPlannerModel() ||
        process.env.DEPLOYER_PLANNER_MODEL ||
        "qwen3:0.6b";
    const fallbackModels = ["llama-3.8b", "mistral-7b"];
    const modelsToTry = [preferredModel, ...fallbackModels].filter(
        (m, i, arr) => m && arr.indexOf(m) === i,
    );
    const maxRetries = 1;

    for (const model of modelsToTry) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🧠 chatJSON → ${model} (attempt ${attempt}/${maxRetries})`);
                const result = await chatJSON(prompt, schema, model);
                return result;
            } catch (err: any) {
                const msg = String(err?.message || err);
                console.warn(`⚠️ ${model} attempt ${attempt} failed: ${msg}`);
                // Auth problems will not be fixed by trying other models with the same key.
                if (/unauthorized|401|for model\/key combination/i.test(msg)) {
                    throw new Error(`Planner model authorization failed: ${msg}`);
                }
                if (attempt === maxRetries) break;
                await new Promise((r) => setTimeout(r, 500 * attempt));
            }
        }
    }

    throw new Error("All chatJSON model retries failed");
}

export function findFamilyByModel(models: any, modelName: string) {
    for (const entry of models) {
        if (entry.models?.some((m: { name: string }) => m.name === modelName)) return entry.family;
    }
    return null;
}


function getSafeParameterSize(size: string): string {
    const match = size.trim().toUpperCase().match(/^([\d.]+)\s*([MBT])$/);
    if (!match) return "NAN";

    const [, numStr, suffix] = match;
    let value = parseFloat(numStr);

    if (suffix === "M") value /= 1000;
    else if (suffix === "T") value *= 1000;

    if (value <= 2) return "4B";
    if (value <= 4) return "6B";
    if (value <= 7) return "10B";
    if (value <= 13) return "20B";
    if (value <= 30) return "40B";
    if (value <= 65) return "70B";
    return `${Math.ceil(value / 10) * 10}B`
}
