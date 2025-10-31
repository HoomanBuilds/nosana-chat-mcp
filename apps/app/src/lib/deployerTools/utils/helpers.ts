/* eslint-disable @typescript-eslint/no-unused-vars */
import { Job } from "@nosana/sdk";
import { MARKETS } from "./supportingModel";
import { GpuMarketSlug, JobsResponse, ModelSpec } from "./types";
import { PublicKey } from "@solana/web3.js";
import { NosanaDeployer } from "../Deployer";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { ZodType } from "zod";
import { Pipeline, TResult } from "./schema";


const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});


export function assertImagePresent(spec: ModelSpec): void {
  if (!spec.dockerImage || spec.dockerImage.trim().length === 0) {
    throw new Error(`Model ${spec.id} missing docker image`);
  }
}

export const fail = (msg: string) => ({
  tool_execute: false,
  success: false,
  args: {},
  content: [{ type: "text" as const, text: `❌ ${msg}` }],
});

export function checkJobExtendable(
  job: Job | null,
  ownerPubKey: string,
  extensionSeconds: number
): { content: { type: "text"; text: string }[] } | null {
  if (!job) return fail("Job not found.");
  if (!job.payer.equals(new PublicKey(ownerPubKey))) return fail("Unauthorized: only job owner can extend runtime.");
  if (job.state !== "RUNNING" || (job.state as string).toUpperCase() !== "RUNNING") return fail("Job must be RUNNING to extend runtime.");
  if (extensionSeconds <= 60) return fail("Extension time must be positive.");
  if (extensionSeconds > 86400) return fail("Extension exceeds 24hours limit");

  return null;
}

export function checkJobStop(
  job: Job,
  ownerPubKey: string
): { content: { type: "text"; text: string }[] } | null {
  if (!job.payer.equals(new PublicKey(ownerPubKey))) return fail("Unauthorized: only job owner can stop Job.");
  if (job.state !== "RUNNING") return fail("Job must be RUNNING to Stop.");

  return null;
}

export async function checkCreateJob(
  params: any
): Promise<{ content: { type: "text" | "result"; text: string }[] } | null> {
  if (!params) return fail("Missing job parameters.");
  const { modelName, gpuMarket, timeoutSeconds, cmd, env, exposePort, userPublicKey } = params;

  if (!userPublicKey || typeof userPublicKey !== "string") return fail("Missing or invalid user public key.");

  if (exposePort == 9000) return fail("the port is occupied by process try selecting other port")
  try {
    new PublicKey(userPublicKey);
  } catch {
    return fail("Invalid Solana public key format." + userPublicKey);
  }

  if (!gpuMarket) return fail(`Missing GPU market — select from ${Object.keys(MARKETS).join(", ")}`);

  const marketPubKey = MARKETS[gpuMarket as GpuMarketSlug].address;
  if (
    typeof timeoutSeconds !== "number" ||
    timeoutSeconds <= 0 ||
    !Number.isFinite(timeoutSeconds)
  )
    return fail("Timeout must be a positive number (seconds).");

  if (timeoutSeconds > 86400 * 7) return fail("Timeout exceeds 7-days limit ");

  if (cmd && typeof cmd !== "string") return fail("Command must be a string if provided.");
  if (env && typeof env !== "object") return fail("Environment variables must be a valid key-value object.");

  if (exposePort && (typeof exposePort !== "number" || exposePort <= 0 || exposePort > 65535)) return fail("Expose port must be a valid TCP port (1–65535).");

  const deployer = new NosanaDeployer("mainnet")
  const exactJobPrice = await deployer.getExactValue(marketPubKey, timeoutSeconds);
  const walletBalance = await deployer.getWalletBalance(userPublicKey);

  const errors: string[] = [];
  if (Number(exactJobPrice.NOS) > walletBalance.nos) errors.push("Not enough NOS tokens to create job.");
  if (exactJobPrice.SOL > walletBalance.sol) errors.push("Not enough SOL for transaction fees.");

  if (errors.length)
    return fail(
      `${errors.join(" ")} 
Available Balance:
  - NOS: ${walletBalance.nos}
  - SOL: ${walletBalance.sol}

Estimated Price:
  - NOS: ${exactJobPrice.NOS}
  - SOL: ${exactJobPrice.SOL}

Please add more NOS or SOL to complete the transaction. 
Below is the required additional amount (difference):

| Token | Required | Available | Difference |
|--------|-----------|------------|-------------|
| NOS    | ${exactJobPrice.NOS} | ${walletBalance.nos} | ${(Number(exactJobPrice.NOS) - walletBalance.nos > 0) ? Number(exactJobPrice.NOS) - walletBalance.nos : "sufficient"} |
| SOL    | ${exactJobPrice.SOL} | ${walletBalance.sol} | ${(exactJobPrice.SOL - walletBalance.sol > 0) ? exactJobPrice.SOL - walletBalance.sol : "sufficient"} |
`
    );
  return {
    content: [
      { type: "result", text: ` NOS = ${exactJobPrice.NOS} and SOL = ${exactJobPrice.SOL}` },
      { type: "result", text: ` NOS = ${walletBalance.nos} and SOL = ${walletBalance.sol}` },
      { type: "result", text: ` USD = ${exactJobPrice.NOS_USD} + ${(await deployer.get_sol_Usd()) * exactJobPrice.SOL} (onetime)` },
    ]
  };
}


export function buildJobTable(jobs: JobsResponse["jobs"]) {
  const rows: any[] = [];

  for (const j of jobs) {
    const start = new Date(j.timeStart * 1000).toLocaleString();
    const end = new Date(j.timeEnd * 1000).toLocaleString();

    const h = Math.floor(j.timeout / 3600);
    const m = Math.floor((j.timeout % 3600) / 60);
    const s = j.timeout % 60;

    type MarketSlug = keyof typeof MARKETS;
    const modelSlug = (Object.keys(MARKETS) as MarketSlug[])
      .find(slug => MARKETS[slug].address === j.market);


    const row: Record<string, any> = {
      id: j.id,
      address: j.address,
      market_address: j.market,
      market_name: modelSlug || "NAN",
      payer: j.payer,
      price: j.price,
      jobStatus: j.jobStatus,
      timeStart: start,
      timeEnd: end,
      timeout: `${j.timeout}s (${h}h ${m}m ${s}s)`,
    };

    rows.push(row);
  }

  return rows;
}


export async function chatJSON<T>(prompt: string, schema: ZodType<T> , model: string = "gemini-2.0-flash"): Promise<T> {
  const { object } = await generateObject({
    model: google(model),
    prompt,
    tools: { google_search: google.tools.googleSearch({}) },
    providerOptions: { google: { structuredOutputs: true } },
    schema,
  });
  return object;
}

export function createJobDefination(result: TResult, { userPubKey, market, timeoutSeconds }: { userPubKey: string, market?: string, timeoutSeconds?: number }) {
  const now = new Date().toISOString();

  const isHF = result.providerName == "huggingface";
  const isOllama = !isHF && typeof result.image === "string" && result.image.includes("ollama/ollama");
  const isOneClickLLM = !isHF && typeof result.image === "string" && /hoomanhq\/oneclickllm:ollama01$/.test(result.image);

  // Determine if we have a proper image
  const hasCustomImage = result.image && result.image.trim().length > 0;
  const categoryExists = result.category in getImage;

  // For container provider, we MUST have an image
  if (!isHF && !hasCustomImage) {
    throw new Error(`Container provider requires an 'image' field. Please specify a Docker image (e.g., "jupyter/tensorflow-notebook:latest")`);
  }

  // For HF provider, check if category is valid
  if (isHF && !categoryExists) {
    throw new Error(`Invalid category '${result.category}' for huggingface provider. Valid categories: ${Object.keys(getImage).join(', ')}`);
  }

  // Derive sensible defaults for common containers
  let derivedEntrypoint: string | string[] | undefined = !isHF ? result.entrypoint : undefined;
  let derivedCmd: any = isHF ? getImage[result.category].cmd({
    model: result.modelName,
    port: result.exposedPorts || 8080,
    host: "0.0.0.0",
    api_key: result.apiKey
  }) : result.commands;

  function normalizeOllamaTag(name: string, vramGb?: number): string {
    const n = (name || "").toLowerCase().replace(/\s+/g, "");
    // Prefer sensible defaults based on family
    if (n.includes("qwen")) {
      if (/(3b|3\.\d+b|3b-instruct)/.test(n) || (vramGb && vramGb <= 8)) return "qwen2.5:3b-instruct";
      if (/(7b|7\.\d+b|7b-instruct)/.test(n) || (vramGb && vramGb >= 12)) return "qwen2.5:7b-instruct";
      // fuzzy "4b" → choose closest available
      if (/(4b|4\.\d+b)/.test(n)) return vramGb && vramGb > 8 ? "qwen2.5:7b-instruct" : "qwen2.5:3b-instruct";
      return "qwen2.5:3b-instruct";
    }
    if (n.includes("mistral")) return "mistral:7b";
    if (n.includes("llama")) return "llama3.1:8b-instruct";
    if (n.includes("gemma")) return "gemma2:9b-instruct";
    if (n.includes("phi")) return "phi3:mini-4k-instruct";
    return name; // fallback to provided
  }

  if (isOllama) {
    // Safe defaults for Ollama to run the daemon and pre-pull the model, then keep process in foreground
    derivedEntrypoint = derivedEntrypoint ?? "/bin/bash";
    const normalizedModel = normalizeOllamaTag((result.modelName || "").trim(), result.vRAM_required) || "llama3.1:8b-instruct";
    derivedCmd = derivedCmd ?? [
      "-lc",
      `export OLLAMA_HOST=0.0.0.0:11434; ollama serve & PID=$!; sleep 6; ollama pull ${normalizedModel} || true; wait $PID`
    ];
  }

  const args = {
    model: result.modelName,
    port: result.exposedPorts || 8080,
    host: "0.0.0.0",
    api_key: result.apiKey
  };

  return {
    type: "container",
    version: "0.1",
    ops: [
      {
        id: result.otherExtra?.id ?? `op_${Buffer.from(result.modelName).toString("base64url").slice(0, 10)}`,
        type: "container/run",
        args: {
          cmd: derivedCmd,

          gpu: result.gpu ?? false,
          image: isHF ? getImage[result.category].image : result.image,
          expose: result.exposedPorts || (isOllama ? 11434 : isOneClickLLM ? 8000 : 8080),
          ...(result.vRAM_required != 0 && result.gpu && { required_vram: result.vRAM_required }),
          ...(result.otherExtra?.work_dir && !isHF && { work_dir: result.otherExtra.work_dir }),
          ...(!isHF && derivedEntrypoint && { entrypoint: derivedEntrypoint }),
          env: {
            ...(
              Array.isArray(result.env)
                ? Object.fromEntries(result.env.map(({ key, value }) => [key, value]))
                : (result.env || {})
            ),
            ...(isHF && result.huggingFaceToken ? { HF_TOKEN: result.huggingFaceToken } : {}),
            ...(isOllama ? { OLLAMA_HOST: "0.0.0.0:11434", OLLAMA_KEEP_ALIVE: "5m" } : {}),
            ...(isOneClickLLM
              ? (() => {
                const tag = normalizeOllamaTag(result.modelName || "", result.vRAM_required);
                const paramSize = (result.params || "").toUpperCase();
                return {
                  MODEL_NAME: tag,
                  SERVED_MODEL_NAME: tag,
                  PORT: String(result.exposedPorts || 8000),
                  MAX_MODEL_LEN: String(8192),
                  PARAMETER_SIZE: paramSize || (tag.includes("3b") ? "3B" : tag.includes("7b") ? "7B" : ""),
                  QUANTIZATION: "",
                  MEMORY_LIMIT: "",
                  TENSOR_PARALLEL_SIZE: String(result.env?.find?.((e: any) => e.key === "TENSOR_PARALLEL_SIZE")?.value || 1),
                  GPU_MEMORY_UTILIZATION: "",
                  SWAP_SPACE: "",
                  BLOCK_SIZE: "",
                  ENABLE_STREAMING: (result.env?.find?.((e: any) => e.key === "ENABLE_STREAMING")?.value || "false").toString(),
                  API_KEY: (result.apiKey || "")
                };
              })()
              : {}),
          },
          ...(!isHF && result.resources && result.resources.length > 0 && { resources: result.resources })
        }
      },
    ],
    meta: {
      trigger: result.otherExtra?.trigger ?? "cli",
      system_requirements: {
        required_vram: result.vRAM_required || 6
      },
      description: result.otherExtra?.Description ?? `AI job for ${result.modelName} model.`,
      owner: userPubKey,
      created_at: now,
      referer: "nosana-chat",
      ...(market && { market }),
      ...(timeoutSeconds && { timeout: timeoutSeconds }),
      category: result.category ?? "Unknown",
    },
  };
}

function buildCmd(
  base: string[],
  args: Record<string, any>,
  map: Record<string, string>,
  defaults: Record<string, any> = {}
): string[] {
  const merged = { ...defaults, ...args };
  const dynamic = Object.entries(merged).flatMap(([k, v]) =>
    v != null && map[k] ? [map[k], String(v)] : []
  );
  return [...base, ...dynamic];
}

const getImage: Record<
  Pipeline,
  {
    image: string;
    description: string;
    cmd: (args: any) => string[];
    legacy?: string[];
  }
> = {
  "image-to-image": {
    image: "ghcr.io/huggingface/api-inference-community:latest",
    description: "Image-to-image transformation models.",
    cmd: (args) =>
      buildCmd(
        ["python3", "manage.py", "start"],
        args,
        { model: "--model-id", port: "--port", framework: "--framework", task: "--task" },
        { framework: "diffusers", task: "image-to-image" }
      ),
  },

  "audio-classification": {
    image: "ghcr.io/huggingface/api-inference-community:latest",
    description: "Audio classification models.",
    cmd: (args) =>
      buildCmd(
        ["python3", "manage.py", "start"],
        args,
        { model: "--model-id", port: "--port", framework: "--framework", task: "--task" },
        { framework: "transformers", task: "audio-classification" }
      ),
  },

  "image-classification": {
    image: "ghcr.io/huggingface/api-inference-community:latest",
    description: "Image classification models.",
    cmd: (args) =>
      buildCmd(
        ["python3", "manage.py", "start"],
        args,
        { model: "--model-id", port: "--port", framework: "--framework", task: "--task" },
        { framework: "transformers", task: "image-classification" }
      ),
  },

  "text-generation": {
    image: "ghcr.io/huggingface/text-generation-inference:latest",
    description: "High-performance LLM backend for text tasks (chat, summarization, translation).",
    legacy: ["text-generation"],
    cmd: (args) =>
      buildCmd([], args, {
        model: "--model-id",
        port: "--port",
        api_key: "--api-key",
        host: "--hostname",
      }),
  },

  "feature-extraction": {
    image: "ghcr.io/huggingface/text-embeddings-inference:latest",
    description: "Text embedding service optimized for semantic search and RAG pipelines.",
    legacy: ["embeddings"],
    cmd: (args) =>
      buildCmd([], args, {
        model: "--model-id",
        port: "--port",
        api_key: "--api-key",
        host: "--host",
      }),
  },

  "text-to-image": {
    image: "ghcr.io/huggingface/api-inference-community:latent-to-image-sha-7c94b2a",
    description: "Diffusion-based image generation backend (Stable Diffusion, Kandinsky, etc.).",
    legacy: ["diffusers", "image-generation"],
    cmd: (args) =>
      buildCmd(
        ["python3", "manage.py", "start"],
        args,
        { model: "--model-id", port: "--port", framework: "--framework", task: "--task" },
        { framework: "diffusers", task: "text-to-image" }
      ),
  },

  "image-text-to-text": {
    image: "ghcr.io/huggingface/api-inference-community:latent-to-image-sha-7c94b2a",
    description: "Vision backend for OCR, captioning, and document understanding.",
    legacy: ["ocr"],
    cmd: (args) =>
      buildCmd(
        ["python3", "manage.py", "start"],
        args,
        { model: "--model-id", port: "--port", framework: "--framework", task: "--task" },
        { framework: "transformers", task: "image-to-text" }
      ),
  },

  "speech-to-text": {
    image: "ghcr.io/huggingface/api-inference-community:latent-to-image-sha-7c94b2a",
    description: "Automatic Speech Recognition backend (Whisper, Wav2Vec2).",
    legacy: ["audio"],
    cmd: (args) =>
      buildCmd(
        ["python3", "manage.py", "start"],
        args,
        { model: "--model-id", port: "--port", framework: "--framework", task: "--task" },
        { framework: "transformers", task: "automatic-speech-recognition" }
      ),
  },

  "text-to-speech": {
    image: "ghcr.io/huggingface/api-inference-community:latest",
    description: "Text-to-Speech backend (Bark, XTTS, FastSpeech2).",
    legacy: ["audio"],
    cmd: (args) =>
      buildCmd(
        ["python3", "manage.py", "start"],
        args,
        { model: "--model-id", port: "--port", framework: "--framework", task: "--task" },
        { framework: "transformers", task: "text-to-speech" }
      ),
  },

  "generic-transformer": {
    image: "ghcr.io/huggingface/transformers-inference:0.9.4",
    description: "General-purpose inference container for Transformers models.",
    legacy: ["transformers-inference"],
    cmd: (args) =>
      buildCmd([], args, {
        model: "--model-id",
        port: "--port",
      }),
  },
};

export async function checkHuggingFaceModel(modelName: string) {
  const url = `https://huggingface.co/api/models/${modelName}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { status: res.status, private: null, gated: null };

    const json = await res.json();
    const isPrivate = !!json.private;
    const isGated = !!json.gated;
    return { status: 200, private: isPrivate, gated: isGated };
  } catch (err: any) {
    console.error("❌ checkHuggingFaceModel error:", err?.message || err);
    return { status: 0, private: null, gated: null };
  }
}

const imageDocsSoure = {
  "api-inference-comminity": ["https://github.com/huggingface/api-inference-community/blob/main/README.md"]
}