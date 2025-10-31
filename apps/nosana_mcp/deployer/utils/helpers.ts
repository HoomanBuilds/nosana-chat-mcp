import { Job, validateJobDefinition } from "@nosana/sdk";
import { MARKETS, MODELS } from "./supportingModel.js";
import { CreateJobInput, GpuMarketSlug, ModelId, ModelSpec } from "./types.js";
import { PublicKey } from "@solana/web3.js";
import { NosanaDeployer } from "../NosanaDeployer.js";

export function assertModelOnMarket(model: ModelId, market: GpuMarketSlug): ModelSpec {
  const m = MODELS[model];
  if (!m) throw new Error(`Model not found: ${model}`);
  // if (!m.allowedMarkets.includes(market)) {
  //   throw new Error(`Model ${model} not allowed on market ${market}`);
  // }
  return m;
}

export function assertImagePresent(spec: ModelSpec): void {
  if (!spec.dockerImage || spec.dockerImage.trim().length === 0) {
    throw new Error(`Model ${spec.id} missing docker image`);
  }
}

export function buildJobDefinition(input: CreateJobInput): any {
  const marketInfo = MARKETS[input.market];
  if (!marketInfo) throw new Error(`Unknown market: ${input.market}`);

  const spec = assertModelOnMarket(input.model, input.market);
  assertImagePresent(spec);

  const requiredVram = input.requiredVramGB ?? spec.minVramGB;
  const expose = input.exposePort ?? spec.exposePort;

  const jobDef: any = {
    version: '0.1',
    type: 'container',
    meta: {
      trigger: 'cli',
      system_resources: { required_vram: requiredVram },
    },
    ops: [
      {
        id: spec.id,
        type: 'container/run',
        args: {
          image: spec.dockerImage,
          gpu: true,
          ...(expose ? { expose } : {}),
          ...(spec.defaultCmd || input.entryCmd ? { cmd: input.entryCmd ?? spec.defaultCmd! } : {}),
          ...(input.env ? { env: input.env } : {})
        },
      },
    ],
  };

  const res = validateJobDefinition(jobDef);
  if (!res.success) {
    throw new Error(`Job definition invalid: ${JSON.stringify(res.errors, null, 2)}`);
  }
  return jobDef;
}


export const fail = (msg: string) => ({
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
  if (extensionSeconds <= 0) return fail("Extension time must be positive.");
  if (extensionSeconds > 86400) return fail("Extension exceeds 24hours limit");

  return null;
}

export function checkJobStop(
  job: Job | null,
  ownerPubKey: string
): { content: { type: "text"; text: string }[] } | null {
  if (!job) return fail("Job not found.");
  if (!job.payer.equals(new PublicKey(ownerPubKey))) return fail("Unauthorized: only job owner can stop Job.");
  if (job.state !== "RUNNING") return fail("Job must be RUNNING to Stop.");

  return null;
}


export async function checkCreateJob(
  params: any
): Promise<{ content: { type: "text" | "result"; text: string }[] } | null> {
  if (!params) return fail("Missing job parameters.");
  const { modelName, gpuMarket, timeoutSeconds, cmd, env, exposePort, userPublicKey } = params;

  if (!modelName) return fail(`Missing model — select from ${Object.keys(MODELS).join(", ")}`);
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
  const estimatedPrice = await deployer.getExactValue(marketPubKey, timeoutSeconds);
  const walletBalance = await deployer.getWalletBalance(userPublicKey);

  const errors: string[] = [];
  if (Number(estimatedPrice.NOS) > walletBalance.nos) errors.push("Not enough NOS tokens to create job.");
  if (estimatedPrice.SOL > walletBalance.sol) errors.push("Not enough SOL for transaction fees.");

  if (errors.length)
    return fail(
      `${errors.join(" ")} 
Available Balance:
  - NOS: ${walletBalance.nos}
  - SOL: ${walletBalance.sol}

Estimated Price:
  - NOS: ${estimatedPrice.NOS}
  - SOL: ${estimatedPrice.SOL}

Please add more NOS or SOL to complete the transaction. 
Below is the required additional amount (difference):

| Token | Required | Available | Difference |
|--------|-----------|------------|-------------|
| NOS    | ${estimatedPrice.NOS} | ${walletBalance.nos} | ${(Number(estimatedPrice.NOS) - walletBalance.nos > 0) ? Number(estimatedPrice.NOS) - walletBalance.nos : "sufficient"} |
| SOL    | ${estimatedPrice.SOL} | ${walletBalance.sol} | ${(estimatedPrice.SOL - walletBalance.sol > 0) ? estimatedPrice.SOL - walletBalance.sol : "sufficient"} |
`
    );
  return {
    content: [
      { type: "result", text: ` NOS = ${estimatedPrice.NOS} and SOL = ${estimatedPrice.SOL}`},
      { type: "result", text: ` NOS = ${walletBalance.nos} and SOL = ${walletBalance.sol}`},
      { type: "result", text: ` USD = ${estimatedPrice.USD} + ${(await getSolPrice()) * estimatedPrice.SOL} (onetime)`},
    ]
  };
  
}

async function getSolPrice() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
  );
  const data = await res.json();
  return data.solana.usd;
}