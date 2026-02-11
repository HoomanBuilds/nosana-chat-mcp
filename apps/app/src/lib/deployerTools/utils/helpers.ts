import { Job } from "@nosana/sdk";
import { MARKETS } from "./supportingModel";
import { GpuMarketSlug, JobsResponse, ModelSpec } from "./types";
import { PublicKey } from "@solana/web3.js";
import { NosanaDeployer } from "../Deployer";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { ZodType } from "zod";
import { TResult } from "./schema";
import { getPlannerModel } from "./plannerContext";
import { IMAGE_REGISTRY } from "./ImageRegistry";
import { SolanaService } from "../../services/SolanaService";

const openai = createOpenAI({
  apiKey: process.env.INFERIA_LLM_API_KEY,
  baseURL: process.env.INFERIA_LLM_URL,
});

function resolvePlannerModel(model?: string): string {
  return (
    model ||
    getPlannerModel() ||
    process.env.DEPLOYER_PLANNER_MODEL ||
    "qwen3:0.6b"
  );
}

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
  extensionSeconds: number,
): { content: { type: "text"; text: string }[] } | null {
  if (!job) return fail("Job not found.");
  if (!job.payer.equals(new PublicKey(ownerPubKey)))
    return fail("Unauthorized: only job owner can extend runtime.");
  if (
    job.state !== "RUNNING" ||
    (job.state as string).toUpperCase() !== "RUNNING"
  )
    return fail("Job must be RUNNING to extend runtime.");
  if (extensionSeconds <= 60) return fail("Extension time must be positive.");
  if (extensionSeconds > 86400) return fail("Extension exceeds 24hours limit");

  return null;
}

export function checkJobStop(
  job: Job,
  ownerPubKey: string,
): { content: { type: "text"; text: string }[] } | null {
  if (!job.payer.equals(new PublicKey(ownerPubKey)))
    return fail("Unauthorized: only job owner can stop Job.");
  if (job.state !== "RUNNING") return fail("Job must be RUNNING to Stop.");

  return null;
}

export async function checkCreateJob(params: {
  modelName: string;
  gpuMarket: string;
  timeoutSeconds: number;
  userPublicKey: string;
  cmd?: string;
  env?: any;
  exposePort?: number;
}): Promise<{ content: { type: "text" | "result"; text: string }[] } | null> {
  if (!params) return fail("Missing job parameters.");
  const {
    modelName,
    gpuMarket,
    timeoutSeconds,
    cmd,
    env,
    exposePort,
    userPublicKey,
  } = params;

  if (!userPublicKey || typeof userPublicKey !== "string")
    return fail("Missing or invalid user public key.");

  if (exposePort == 9000)
    return fail("the port is occupied by process try selecting other port");

  if (!SolanaService.isValidPublicKey(userPublicKey)) {
    return fail("Invalid Solana public key format." + userPublicKey);
  }

  if (!gpuMarket)
    return fail(
      `Missing GPU market — select from ${Object.keys(MARKETS).join(", ")}`,
    );

  const marketPubKey = MARKETS[gpuMarket as GpuMarketSlug].address;
  if (
    typeof timeoutSeconds !== "number" ||
    timeoutSeconds <= 0 ||
    !Number.isFinite(timeoutSeconds)
  )
    return fail("Timeout must be a positive number (seconds).");

  if (timeoutSeconds > 86400 * 7) return fail("Timeout exceeds 7-days limit ");

  if (cmd && typeof cmd !== "string")
    return fail("Command must be a string if provided.");
  if (env && typeof env !== "object")
    return fail("Environment variables must be a valid key-value object.");

  if (
    exposePort &&
    (typeof exposePort !== "number" || exposePort <= 0 || exposePort > 65535)
  )
    return fail("Expose port must be a valid TCP port (1–65535).");

  const deployer = new NosanaDeployer("mainnet");
  const exactJobPrice = await deployer.getExactValue(
    marketPubKey,
    timeoutSeconds,
  );
  const walletBalance = await deployer.getWalletBalance(userPublicKey);

  const errors: string[] = [];
  if (Number(exactJobPrice.NOS) > walletBalance.nos)
    errors.push("Not enough NOS tokens to create job.");
  if (exactJobPrice.SOL > walletBalance.sol)
    errors.push("Not enough SOL for transaction fees.");

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
| NOS    | ${exactJobPrice.NOS} | ${walletBalance.nos} | ${Number(exactJobPrice.NOS) - walletBalance.nos > 0 ? (Number(exactJobPrice.NOS) - walletBalance.nos).toFixed(4) : "sufficient"} |
| SOL    | ${exactJobPrice.SOL} | ${walletBalance.sol} | ${exactJobPrice.SOL - walletBalance.sol > 0 ? (exactJobPrice.SOL - walletBalance.sol).toFixed(4) : "sufficient"} |
`,
    );
  return {
    content: [
      {
        type: "result",
        text: ` NOS = ${exactJobPrice.NOS} and SOL = ${exactJobPrice.SOL}`,
      },
      {
        type: "result",
        text: ` NOS = ${walletBalance.nos} and SOL = ${walletBalance.sol}`,
      },
      {
        type: "result",
        text: ` USD = ${exactJobPrice.NOS_USD} + ${(await deployer.get_sol_Usd()) * exactJobPrice.SOL} (onetime)`,
      },
    ],
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
    const modelSlug = (Object.keys(MARKETS) as MarketSlug[]).find(
      (slug) => MARKETS[slug].address === j.market,
    );

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

export async function chatJSON<T>(
  prompt: string,
  schema: ZodType<T>,
  model?: string,
): Promise<T> {
  const { object } = await generateObject({
    model: openai.chat(resolvePlannerModel(model)),
    prompt,
    schema,
  });
  return object;
}

export function normalizeOllamaTag(name: string, vramGb?: number): string {
  const n = (name || "").toLowerCase().replace(/\s+/g, "");
  if (n.includes("qwen")) {
    if (/(3b|3\.\d+b|3b-instruct)/.test(n) || (vramGb && vramGb <= 8))
      return "qwen2.5:3b-instruct";
    if (/(7b|7\.\d+b|7b-instruct)/.test(n) || (vramGb && vramGb >= 12))
      return "qwen2.5:7b-instruct";
    if (/(4b|4\.\d+b)/.test(n))
      return vramGb && vramGb > 8
        ? "qwen2.5:7b-instruct"
        : "qwen2.5:3b-instruct";
    return "qwen2.5:3b-instruct";
  }
  if (n.includes("mistral")) return "mistral:7b";
  if (n.includes("llama")) return "llama3.1:8b-instruct";
  if (n.includes("gemma")) return "gemma2:9b-instruct";
  if (n.includes("phi")) return "phi3:mini-4k-instruct";
  return name;
}

export function createJobDefination(
  result: TResult,
  {
    userPubKey,
    market,
    timeoutSeconds,
  }: { userPubKey: string; market?: string; timeoutSeconds?: number },
) {
  const now = new Date().toISOString();
  const isHF = result.providerName === "huggingface";
  const isOllama = !isHF && result.image?.includes("ollama/ollama");
  const isOneClickLLM =
    !isHF && /hoomanhq\/oneclickllm:ollama01$/.test(result.image || "");

  if (!isHF && !result.image) {
    throw new Error("Container provider requires an 'image' field.");
  }

  const categoryConfig = IMAGE_REGISTRY[result.category];
  if (isHF && !categoryConfig) {
    throw new Error(
      `Invalid category '${result.category}' for huggingface provider.`,
    );
  }

  let derivedCmd: any = isHF
    ? categoryConfig.cmd({
        model: result.modelName,
        port: result.exposedPorts || 8080,
        host: "0.0.0.0",
        api_key: result.apiKey,
      })
    : result.commands;

  if (isOllama) {
    const normalizedModel = normalizeOllamaTag(
      result.modelName || "",
      result.vRAM_required,
    );
    derivedCmd = derivedCmd ?? [
      "-lc",
      `export OLLAMA_HOST=0.0.0.0:11434; ollama serve & PID=$!; sleep 6; ollama pull ${normalizedModel} || true; wait $PID`,
    ];
  }

  const env = {
    ...(Array.isArray(result.env)
      ? Object.fromEntries(result.env.map(({ key, value }) => [key, value]))
      : result.env || {}),
    ...(isHF && result.huggingFaceToken
      ? { HF_TOKEN: result.huggingFaceToken }
      : {}),
    ...(isOllama
      ? { OLLAMA_HOST: "0.0.0.0:11434", OLLAMA_KEEP_ALIVE: "5m" }
      : {}),
    ...(isOneClickLLM
      ? (() => {
          const tag = normalizeOllamaTag(
            result.modelName || "",
            result.vRAM_required,
          );
          return {
            MODEL_NAME: tag,
            SERVED_MODEL_NAME: tag,
            PORT: String(result.exposedPorts || 8000),
            MAX_MODEL_LEN: "8192",
            PARAMETER_SIZE:
              (result.params || "").toUpperCase() ||
              (tag.includes("3b") ? "3B" : "7B"),
            TENSOR_PARALLEL_SIZE: "1",
            ENABLE_STREAMING: "false",
            API_KEY: result.apiKey || "",
          };
        })()
      : {}),
  };

  return {
    type: "container",
    version: "0.1",
    ops: [
      {
        id:
          result.otherExtra?.id ??
          `op_${Buffer.from(result.modelName).toString("base64url").slice(0, 10)}`,
        type: "container/run",
        args: {
          cmd: derivedCmd,
          gpu: result.gpu ?? false,
          image: isHF ? categoryConfig.image : result.image,
          expose:
            result.exposedPorts ||
            (isOllama ? 11434 : isOneClickLLM ? 8000 : 8080),
          ...(result.vRAM_required !== 0 &&
            result.gpu && { required_vram: result.vRAM_required }),
          ...(result.otherExtra?.work_dir &&
            !isHF && { work_dir: result.otherExtra.work_dir }),
          ...(!isHF && result.entrypoint && { entrypoint: result.entrypoint }),
          env,
          ...(!isHF &&
            result.resources?.length && { resources: result.resources }),
        },
      },
    ],
    meta: {
      trigger: result.otherExtra?.trigger ?? "cli",
      system_resources: { required_vram: result.vRAM_required || 6 },
      description:
        result.otherExtra?.Description ??
        `AI job for ${result.modelName} model.`,
      owner: userPubKey,
      created_at: now,
      referer: "nosana-chat",
      ...(market && { market }),
      ...(timeoutSeconds && { timeout: timeoutSeconds }),
      category: result.category ?? "Unknown",
    },
  };
}

export async function checkHuggingFaceModel(modelName: string) {
  const url = `https://huggingface.co/api/models/${modelName}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { status: res.status, private: null, gated: null };
    const json = await res.json();
    return { status: 200, private: !!json.private, gated: !!json.gated };
  } catch (err: any) {
    console.error("❌ checkHuggingFaceModel error:", err?.message || err);
    return { status: 0, private: null, gated: null };
  }
}
