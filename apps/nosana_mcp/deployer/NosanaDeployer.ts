import { Client, Job, Market } from "@nosana/sdk";
import { PublicKey } from "@solana/web3.js";
import {
  WalletBalance,
  CreateJobParams,
  CreditBalance,
  GpuMarketSlug,
  MarketInfo,
  Network,
  AuthMode,
  AuthContext,
  detectAuthMode,
  NOSANA_API_BASE,
  DeploymentCreateParams,
  DeploymentResponse,
} from "./utils/types.js";
import { MARKETS } from "./utils/supportingModel.js";
import { ExtendJobWithCreditsRequest } from "@nosana/sdk/dist/services/api/types.js";
import {
  assertModelOnMarket,
  assertImagePresent,
  buildJobDefinition,
} from "./utils/helpers.js";

export class NosanaDeployer {
  private nosana: Client;
  private network: Network;
  private serverApiKey?: string;

  constructor(network: Network = "mainnet") {
    this.network = network;
    this.nosana = new Client(network);
    this.serverApiKey = process.env.NOSANA_API_KEY;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Get the right API key: prefer per-request API key, fallback to server env */
  private getApiKey(auth?: AuthContext): string {
    if (auth?.mode === "api_key" && auth.credential) return auth.credential;
    if (this.serverApiKey) return this.serverApiKey;
    throw new Error(
      "No Nosana API key available. Provide one via auth or set NOSANA_API_KEY env.",
    );
  }

  /** Get the base URL for the Nosana HTTP API */
  private getApiBase(): string {
    return NOSANA_API_BASE[this.network];
  }

  /** Make an authenticated HTTP request to the Nosana API */
  private async apiRequest<T = any>(
    path: string,
    options: {
      method?: string;
      body?: any;
      auth?: AuthContext;
    } = {},
  ): Promise<T> {
    const { method = "GET", body, auth } = options;
    const apiKey = this.getApiKey(auth);
    const url = `${this.getApiBase()}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Nosana API error (${res.status} ${res.statusText}): ${text}`,
      );
    }

    return res.json() as Promise<T>;
  }

  /** Detect auth mode from a credential string */
  detectAuth(credential: string): AuthContext {
    return {
      mode: detectAuthMode(credential),
      credential,
    };
  }

  // ── Jobs ─────────────────────────────────────────────────────────────────

  async getAllJobs(userPubKey: string): Promise<any[]> {
    return Promise.resolve([]);
  }

  // ── Wallet Balance (wallet mode only) ────────────────────────────────────

  async getWalletBalance(publicKey?: string): Promise<WalletBalance> {
    const pk = new PublicKey(publicKey as string);
    const sol =
      (await this.nosana.solana.getSolBalance(pk ? pk : undefined)) / 1e9;
    let nos =
      (await this.nosana.solana.getNosBalance(pk ? pk : undefined))?.amount ??
      0;
    nos = Number(nos) / 1000000;
    return { sol, nos };
  }

  // ── Credit Balance (dual mode) ──────────────────────────────────────────

  async getCreditBalance(auth?: AuthContext): Promise<CreditBalance> {
    // If using API key mode, go directly to REST API
    if (auth?.mode === "api_key") {
      return this.getCreditBalanceViaApi(auth);
    }

    // Wallet mode: try SDK first, then fallback to REST
    try {
      const response = await this.nosana.api.credits.balance();
      if (response) {
        return {
          assignedCredits: Number(response.assignedCredits ?? 0),
          reservedCredits: Number(response.reservedCredits ?? 0),
          settledCredits: Number(response.settledCredits ?? 0),
        };
      }
    } catch (sdkErr) {
      console.warn("SDK balance fetch failed, using REST fallback:", sdkErr);
    }

    return this.getCreditBalanceViaApi(auth);
  }

  private async getCreditBalanceViaApi(
    auth?: AuthContext,
  ): Promise<CreditBalance> {
    const data = await this.apiRequest<CreditBalance>("/credits/balance", {
      auth,
    });
    return {
      assignedCredits: Number(data.assignedCredits ?? 0),
      reservedCredits: Number(data.reservedCredits ?? 0),
      settledCredits: Number(data.settledCredits ?? 0),
    };
  }

  // ── Markets ──────────────────────────────────────────────────────────────

  async get_market(gpuMarket_slug: GpuMarketSlug): Promise<Market> {
    const address = MARKETS[gpuMarket_slug].address;
    const marketInfo: Market = await this.nosana.jobs.getMarket(address);
    if (!marketInfo) throw new Error(`Unknown GPU market: ${address}`);
    return marketInfo;
  }

  /** List markets via the Nosana HTTP API */
  async listMarketsViaApi(auth?: AuthContext): Promise<any[]> {
    return this.apiRequest<any[]>("/markets", { auth });
  }

  /** Get specific market details via the Nosana HTTP API */
  async getMarketViaApi(
    marketAddress: string,
    auth?: AuthContext,
  ): Promise<any> {
    return this.apiRequest<any>(`/markets/${marketAddress}`, { auth });
  }

  async getAvailableGpuNodes(gpuMarket: GpuMarketSlug): Promise<number> {
    const marketInfo: MarketInfo | undefined = MARKETS[gpuMarket];
    if (!marketInfo) throw new Error(`Unknown GPU market: ${gpuMarket}`);

    const marketAddress = new PublicKey(marketInfo.address);
    const market = await this.nosana.jobs.getMarket(marketAddress);
    return Array.isArray(market.queue) ? market.queue.length : 0;
  }

  // ── Cost Estimation ──────────────────────────────────────────────────────

  async estimateJobCost(
    gpuMarket: GpuMarketSlug,
    durationSeconds: number,
  ): Promise<{ pricePerSecond: number; estimatedCost: number }> {
    const marketInfo: MarketInfo | undefined = MARKETS[gpuMarket];
    if (!marketInfo) throw new Error(`Unknown GPU market: ${gpuMarket}`);

    const marketAddress = new PublicKey(marketInfo.address);
    const market = await this.nosana.jobs.getMarket(marketAddress);

    const pricePerSecond = Number(market.jobPrice) / 1e6;
    const estimatedCost = pricePerSecond * durationSeconds;

    return { pricePerSecond, estimatedCost };
  }

  // ── Create Job / Deployment (dual mode) ──────────────────────────────────

  async createJob(
    params: CreateJobParams,
    auth?: AuthContext,
  ): Promise<{ jobId: string; ipfsHash: string; market: string }> {
    const {
      modelName,
      gpuMarket,
      cmd,
      requiredVramGB,
      exposePort,
      env,
      userPublicKey,
    } = params;

    const modelSpec = assertModelOnMarket(modelName, gpuMarket);
    assertImagePresent(modelSpec);

    const jobDefinition = buildJobDefinition({
      model: modelName,
      market: gpuMarket,
      entryCmd: cmd ?? modelSpec.defaultCmd,
      requiredVramGB,
      exposePort,
      env,
    });

    const marketAddress = MARKETS[gpuMarket].address;

    // ── API Key Mode: Use Deployments API ──
    if (auth?.mode === "api_key") {
      return this.createJobViaApi(jobDefinition, marketAddress, params, auth);
    }

    // ── Wallet Mode: Use SDK (on-chain) ──
    const ipfsHash = await this.nosana.ipfs.pin(jobDefinition);
    const marketPk = new PublicKey(marketAddress);

    const deploymentBody = {
      ipfs: ipfsHash,
      market: marketPk.toBase58(),
      metadata: {
        model: modelName,
        gpuMarket,
        network: this.network,
        userPubKey: userPublicKey?.toBase58(),
      },
    };

    const response = await this.nosana.deployments.create(
      deploymentBody as any,
    );

    const jobId =
      (response as any).deployment ??
      (response as any).job ??
      (response as any).id ??
      "unknown";

    return { jobId, ipfsHash, market: marketPk.toBase58() };
  }

  /** Create a deployment via the Nosana HTTP API (API key mode) */
  private async createJobViaApi(
    jobDefinition: any,
    marketAddress: string,
    params: CreateJobParams,
    auth: AuthContext,
  ): Promise<{ jobId: string; ipfsHash: string; market: string }> {
    // Step 1: Create job via API
    const deploymentPayload: any = {
      name: `${params.modelName}-deployment`,
      market: marketAddress,
      timeout: params.timeoutSeconds || 3600,
      timeoutSeconds: params.timeoutSeconds || 3600,
      replicas: 1,
      strategy: "SIMPLE",
      job_definition: {
        ...jobDefinition,
        meta: {
          ...jobDefinition.meta,
          trigger: "api",
        },
      },
    };

    const deployment = await this.apiRequest<DeploymentResponse>("/jobs", {
      method: "POST",
      body: deploymentPayload,
      auth,
    });

    const deploymentId = deployment.id;

    return {
      jobId: deploymentId,
      ipfsHash: `api-deployment-${deploymentId}`,
      market: marketAddress,
    };
  }

  // ── Post Job via API (one-off job with IPFS) ────────────────────────────

  async postJobViaApi(
    jobDefinition: any,
    marketAddress: string,
    auth: AuthContext,
    timeout?: number,
  ): Promise<{ jobAddress: string; creditsUsed?: number }> {
    // Pin to IPFS first
    const ipfsHash = await this.nosana.ipfs.pin(jobDefinition);

    const result = await this.apiRequest<any>("/jobs/list", {
      method: "POST",
      body: {
        ipfsHash,
        market: marketAddress,
        ...(timeout ? { timeout, timeoutSeconds: timeout } : {}),
      },
      auth,
    });

    return {
      jobAddress: result.job ?? result.address ?? "unknown",
      creditsUsed: result.credits?.creditsUsed,
    };
  }

  // ── Get Job (dual mode) ──────────────────────────────────────────────────

  async getJob(jobId: string, auth?: AuthContext): Promise<Job | any | null> {
    // API key mode: try API first
    if (auth?.mode === "api_key") {
      try {
        return await this.getJobViaApi(jobId, auth);
      } catch (err) {
        console.warn("API job fetch failed:", err);
        return null;
      }
    }

    // Wallet mode: use SDK
    try {
      return await this.nosana.jobs.get(new PublicKey(jobId));
    } catch (error) {
      console.error(`Could not fetch job ${jobId}:`, error);
      return null;
    }
  }

  /** Get job details via the Nosana HTTP API */
  private async getJobViaApi(jobId: string, auth: AuthContext): Promise<any> {
    return this.apiRequest<any>(`/jobs/${jobId}`, { auth });
  }

  // ── Get Job API (API key mode) ────────────────────────────────────────

  async getJob_api(deploymentId: string, auth: AuthContext): Promise<any> {
    return this.apiRequest<any>(`/jobs/${deploymentId}`, { auth });
  }

  // ── List Jobs API (API key mode) ──────────────────────────────────────

  async listJobs(auth: AuthContext): Promise<any[]> {
    return this.apiRequest<any[]>("/jobs", { auth });
  }

  // ── Stop Job (dual mode) ─────────────────────────────────────────────────

  async stopJob(
    jobId: string,
    auth?: AuthContext,
  ): Promise<{ ok: boolean; tx?: string; note?: string }> {
    // API key mode
    if (auth?.mode === "api_key") {
      return this.stopJobViaApi(jobId, auth);
    }

    // Wallet mode: try on-chain first
    try {
      const result = await this.nosana.jobs.end(jobId);
      if ("tx" in result)
        return {
          ok: true,
          tx: result.tx,
          note: "Stopped via blockchain transaction",
        };
      return { ok: true, note: "Instruction generated for manual broadcast" };
    } catch (err) {
      console.warn("Blockchain stop failed, fallback to API:", err);
    }

    // Fallback to API
    const apiKey = this.serverApiKey;
    if (apiKey) {
      try {
        const res = await this.nosana.api.jobs.stop({ jobAddress: jobId });
        return {
          ok: true,
          note: "Stopped via credits API",
          tx: res.transactionId ?? undefined,
        };
      } catch (err2) {
        console.warn("Credits stop failed:", err2);
      }

      const response = await fetch(
        `${this.getApiBase()}/jobs/stop-with-credits`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ jobAddress: jobId }),
        },
      );

      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      const json = await response.json();
      return {
        ok: true,
        note: "Stopped via manual REST",
        tx: json.tx ?? undefined,
      };
    }

    throw new Error("Failed to stop job (no valid method available)");
  }

  /** Stop a job via the Nosana HTTP API */
  private async stopJobViaApi(
    jobId: string,
    auth: AuthContext,
  ): Promise<{ ok: boolean; tx?: string; note?: string }> {
    try {
      const result = await this.apiRequest<any>(`/jobs/stop`, {
        method: "POST",
        body: { address: jobId },
        auth,
      });
      return {
        ok: true,
        tx: result.transactionId ?? result.tx ?? undefined,
        note: "Stopped via Nosana API (API key mode)",
      };
    } catch (err: any) {
      if (err.message.includes("job cannot be delisted except when in queue")) {
        throw new Error(
          "Job is currently running. Credit-based jobs on the Nosana platform can only be cancelled while in the queued state. Once a job is running, it must complete its allocated time.",
        );
      }
      // Try stop-with-credits endpoint as fallback
      try {
        const result = await this.apiRequest<any>("/jobs/stop-with-credits", {
          method: "POST",
          body: { jobAddress: jobId },
          auth,
        });
        return {
          ok: true,
          tx: result.tx ?? undefined,
          note: "Stopped via credits API (API key mode)",
        };
      } catch (err2: any) {
        if (
          err2.message.includes("job cannot be delisted except when in queue")
        ) {
          throw new Error(
            "Job is currently running. Credit-based jobs on the Nosana platform can only be cancelled while in the queued state. Once a job is running, it must complete its allocated time.",
          );
        }
        throw new Error(`Failed to stop job via API: ${err2.message}`);
      }
    }
  }

  // ── Stop Job API (API key mode) ──────────────────────────────────────

  async stopJob_api(
    deploymentId: string,
    auth: AuthContext,
  ): Promise<{ ok: boolean; note: string }> {
    await this.apiRequest("/jobs/stop", {
      method: "POST",
      body: { address: deploymentId },
      auth,
    });
    return { ok: true, note: "Job stopped via Nosana API" };
  }

  // ── Archive Job API (API key mode) ────────────────────────────────────

  async archiveJob_api(
    deploymentId: string,
    auth: AuthContext,
  ): Promise<{ ok: boolean; note: string }> {
    await this.apiRequest(`/jobs/${deploymentId}/archive`, {
      method: "POST",
      auth,
    });
    return { ok: true, note: "Job archived via Nosana API" };
  }

  // ── Cost helpers ─────────────────────────────────────────────────────────

  async getExactValue(marketPubKey: string | PublicKey, seconds: number) {
    const SOL = 0.00429;

    const marketSlug = Object.keys(MARKETS).find(
      (slug) => MARKETS[slug as GpuMarketSlug].address === marketPubKey,
    );
    if (!marketSlug) throw new Error("Invalid market public key.");

    const pricePerHour = MARKETS[marketSlug as GpuMarketSlug]
      .estimated_price_usd_per_hour as number;
    const pricePerSecond = pricePerHour / 3600;
    const totalUsd = pricePerSecond * seconds;

    const nos = await this.nosana.solana.getNosPrice();
    const nosUsd = Number(nos.usd);
    const totalNos = (totalUsd / nosUsd).toFixed(3);

    return {
      SOL,
      NOS: totalNos,
      NOS_USD: nosUsd,
      USD: totalUsd,
      seconds,
      hours: seconds / 3600,
      market: marketSlug,
    };
  }

  // ── Extend Job Runtime (dual mode) ──────────────────────────────────────

  async extendJobRuntime(
    jobId: string,
    extensionSeconds: number,
    auth?: AuthContext,
  ): Promise<{ ok: boolean; txId?: string; note: string }> {
    // API key mode
    if (auth?.mode === "api_key") {
      return this.extendJobViaApi(jobId, extensionSeconds, auth);
    }

    // Wallet mode: try SDK first
    try {
      const payload: ExtendJobWithCreditsRequest = {
        jobAddress: jobId,
        extensionSeconds,
      };
      const res = await this.nosana.api.jobs.extend(payload);
      return {
        ok: true,
        txId: (res as any).transactionId ?? undefined,
        note: "Extended via Nosana SDK API",
      };
    } catch (sdkErr) {
      console.warn("SDK extend failed, trying REST fallback:", sdkErr);
    }

    const apiKey = this.serverApiKey;
    if (!apiKey)
      throw new Error("NOSANA_API_KEY environment variable not set.");

    const res = await fetch(`${this.getApiBase()}/jobs/extend-with-credits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobAddress: jobId, extensionSeconds }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Extend job API error: ${res.status} ${res.statusText}\n${text}`,
      );
    }

    const data = await res.json();
    return {
      ok: true,
      txId: data.transactionId ?? undefined,
      note: "Extended via REST API fallback",
    };
  }

  /** Extend a job via the Nosana HTTP API */
  private async extendJobViaApi(
    jobId: string,
    extensionSeconds: number,
    auth: AuthContext,
  ): Promise<{ ok: boolean; txId?: string; note: string }> {
    const result = await this.apiRequest<any>("/jobs/extend", {
      method: "POST",
      body: {
        address: jobId,
        timeout: extensionSeconds,
        timeoutSeconds: extensionSeconds,
      },
      auth,
    });
    return {
      ok: true,
      txId: result.transactionId ?? undefined,
      note: "Extended via Nosana API (API key mode)",
    };
  }
}

let deployerInstance: NosanaDeployer | null = null;
try {
  deployerInstance = new NosanaDeployer("mainnet");
} catch {
  console.log("error connecting nosana_deployer");
}

export default deployerInstance;
