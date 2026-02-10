import { Client, Job, getJobExposedServices } from "@nosana/sdk";
import { PublicKey } from "@solana/web3.js";
import { useWalletStore } from "@/store/wallet.store";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const NOSANA_API_BASE = "https://dashboard.k8s.prd.nos.ci/api";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function extractJobId(res: unknown): string | null {
  if (!res || typeof res !== "object") return null;
  const obj = res as Record<string, unknown>;
  if (typeof obj.job === "string" && obj.job.trim()) return obj.job;
  if (typeof obj.jobId === "string" && obj.jobId.trim()) return obj.jobId;
  if (typeof obj.id === "string" && obj.id.trim()) return obj.id;
  return null;
}

// ── Wallet Mode: Create job on-chain ─────────────────────────────────────

async function createJobViaWallet(
  jobDef: object,
  userSelectedMarketKey: PublicKey | string,
  minutes: number,
) {
  const { wallet, provider } = useWalletStore.getState();
  if (!provider || !wallet) throw new Error("Wallet not connected");

  const signer = {
    publicKey: provider.publicKey,
    payer: provider.publicKey,
    signTransaction: (tx: any) => provider.signTransaction(tx),
    signAllTransactions: (txs: any[]) => provider.signAllTransactions(txs),
  };

  const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as
    | "devnet"
    | "mainnet";
  const marketPublicKey = new PublicKey(userSelectedMarketKey.toString());

  const nosana = new Client(NETWORK, signer, {
    solana: {
      dynamicPriorityFee: true,
      priorityFeeStrategy: "medium",
    },
  });

  const ipfsHash = await nosana.ipfs.pin(jobDef);
  console.log("Job pinned to IPFS:", ipfsHash);

  const res = await nosana.jobs.list(ipfsHash, minutes * 60, marketPublicKey);
  const jobId = extractJobId(res);
  if (!jobId) {
    throw new Error(
      `Nosana jobs.list did not return a job id. Response: ${JSON.stringify(res)}`
    );
  }

  console.log(`Job ${jobId} posted to market ${marketPublicKey.toBase58()}`);

  let job: Job | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      job = await nosana.jobs.get(new PublicKey(jobId));
      break;
    } catch (err) {
      if (attempt === 3) {
        console.warn(`Could not fetch job details for ${jobId}:`, err);
        break;
      }
      await sleep(1200);
    }
  }

  let firstService: { hash: string } | null = null;
  try {
    const services = getJobExposedServices(jobDef as any, jobId);
    firstService = services.length > 0 ? (services[0] as { hash: string }) : null;
  } catch (err) {
    console.warn("Could not resolve exposed service from job definition:", err);
  }

  const nodeDomain =
    NETWORK === "mainnet" ? "node.k8s.prd.nos.ci" : "node.k8s.dev.nos.ci";
  const serviceUrl = firstService
    ? `https://${firstService.hash}.${nodeDomain}`
    : `https://${jobId}.${nodeDomain}`;

  const log: NosanaJobLog = {
    wallet,
    authMode: 'wallet',
    ipfsHash,
    market: marketPublicKey.toBase58(),
    timeOut: minutes * 60,
    jobResponse: res,
    jobId,
    ipfsUrl: nosana.ipfs.config.gateway + ipfsHash,
    marketUrl: `https://dashboard.nosana.com/markets/${marketPublicKey.toString()}`,
    serviceUrl,
    explorerUrl: `https://dashboard.nosana.com/jobs/${jobId}`,
    chatUrl: `https://www.inferia.ai/chat/${firstService?.hash || jobId}.${nodeDomain}?jobId=${jobId}`,
    jobDetails: job,
  };

  const response_to_send = { ...(job ?? {}), ...(res as object), ...log };
  console.log("Job complete:", { jobId, serviceUrl });
  return { jobId, result: { jobDetails: response_to_send } };
}

// ── API Key Mode: Create deployment via REST API ─────────────────────────

async function createJobViaApiKey(
  jobDef: object,
  userSelectedMarketKey: PublicKey | string,
  minutes: number,
) {
  const { nosanaApiKey } = useWalletStore.getState();
  if (!nosanaApiKey) throw new Error("Nosana API key not set");

  const marketAddress = userSelectedMarketKey.toString();

  // Create deployment via REST API
  const deploymentPayload = {
    name: `deployment-${Date.now()}`,
    market: marketAddress,
    timeout: minutes,
    replicas: 1,
    strategy: 'SIMPLE',
    job_definition: {
      ...(jobDef as any),
      meta: {
        ...(jobDef as any).meta,
        trigger: 'api',
      },
    },
  };

  const createRes = await fetch(`${NOSANA_API_BASE}/deployments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${nosanaApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(deploymentPayload),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create deployment: ${createRes.status} ${errText}`);
  }

  const deployment = await createRes.json();
  const deploymentId = deployment.id;

  // Start the deployment
  try {
    await fetch(`${NOSANA_API_BASE}/deployments/${deploymentId}/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nosanaApiKey}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (startErr) {
    console.warn('Auto-start might have failed:', startErr);
  }

  const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as "devnet" | "mainnet";
  const nodeDomain = NETWORK === "mainnet" ? "node.k8s.prd.nos.ci" : "node.k8s.dev.nos.ci";

  const log: NosanaJobLog = {
    wallet: null,
    authMode: 'api_key',
    ipfsHash: `api-deployment-${deploymentId}`,
    market: marketAddress,
    timeOut: minutes * 60,
    jobResponse: deployment,
    jobId: deploymentId,
    ipfsUrl: '',
    marketUrl: `https://dashboard.nosana.com/markets/${marketAddress}`,
    serviceUrl: `https://${deploymentId}.${nodeDomain}`,
    explorerUrl: `https://dashboard.nosana.com/deployments/${deploymentId}`,
    chatUrl: `https://www.inferia.ai/chat/${deploymentId}.${nodeDomain}?jobId=${deploymentId}`,
    jobDetails: deployment,
  };

  console.log("Deployment created (API key mode):", { deploymentId });
  return { jobId: deploymentId, result: { jobDetails: { ...deployment, ...log } } };
}

// ── Main entry point ──────────────────────────────────────────────────────

export async function createJob(
  jobDef: object,
  userSelectedMarketKey: PublicKey | string,
  minutes: number
) {
  const { authMode, wallet, nosanaApiKey } = useWalletStore.getState();

  // Determine which mode to use
  if (authMode === 'api_key' && nosanaApiKey) {
    return createJobViaApiKey(jobDef, userSelectedMarketKey, minutes);
  }

  if (wallet) {
    return createJobViaWallet(jobDef, userSelectedMarketKey, minutes);
  }

  throw new Error("Not connected. Please connect a wallet or provide a Nosana API key.");
}

export type NosanaJobLog = {
  wallet: string | null;
  authMode: 'wallet' | 'api_key';
  ipfsHash: string;
  market: string;
  timeOut: number;
  jobResponse: any;
  jobId: string;
  ipfsUrl: string;
  marketUrl: string;
  serviceUrl: string;
  explorerUrl: string;
  chatUrl: string;
  jobDetails: any | null;
};
