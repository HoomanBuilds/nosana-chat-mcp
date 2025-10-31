import {
  Client,
  Job,
  Market,
} from '@nosana/sdk';
import { PublicKey } from '@solana/web3.js';
import {
  WalletBalance,
  CreateJobParams,
  CreditBalance,
  GpuMarketSlug,
  MarketInfo,
  Network
} from "./utils/types.js";
import { MARKETS } from './utils/supportingModel.js';
import { ExtendJobWithCreditsRequest } from '@nosana/sdk/dist/services/api/types.js';
import {
  assertModelOnMarket,
  assertImagePresent,
  buildJobDefinition,
} from './utils/helpers.js';


export class NosanaDeployer {
  private nosana: Client;
  private network: Network;
  private apiKey?: string;

  constructor(network: Network = 'mainnet') {
    this.network = network;
    this.nosana = new Client(network);
    this.apiKey = process.env.NOSANA_API_KEY;
  }


  async getAllJobs(userPubKey: string): Promise<any[]> {
    return Promise.resolve([]);
  }


  async getWalletBalance(publicKey?: string): Promise<WalletBalance> {
    const pk = new PublicKey(publicKey as string)
    const sol = (await this.nosana.solana.getSolBalance(pk ? pk : undefined)) / 1e9;
    let nos = (await this.nosana.solana.getNosBalance(pk ? pk : undefined))?.amount ?? 0;
    nos = Number(nos) / 1000000;
    return { sol, nos };
  }

  async getCreditBalance(): Promise<CreditBalance> {
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
      console.warn('SDK balance fetch failed, using REST fallback:', sdkErr);
    }

    if (!this.apiKey)
      throw new Error('NOSANA_API_KEY environment variable not set.');

    const endpoint =
      this.network === 'mainnet'
        ? 'https://dashboard.k8s.prd.nos.ci/api/credits/balance'
        : 'https://dashboard.k8s.dev.nos.ci/api/credits/balance';

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok)
      throw new Error(`Credit API error: ${res.status} ${res.statusText}`);
    const data = await res.json();

    return {
      assignedCredits: Number(data.assignedCredits ?? 0),
      reservedCredits: Number(data.reservedCredits ?? 0),
      settledCredits: Number(data.settledCredits ?? 0),
    };
  }

  // async listAll_Market() {
  //   return this.nosana.nodes.all();
  // }

  // async listAll_Market2() {
  //   const markets: Record<string, any> = {};

  //   console.log(this.nosana.deployments.list())
  //   for (const [slug, { address }] of Object.entries(MARKETS)) {
  //     try {
  //       const market = await this.nosana.jobs.getMarket(address);
  //       markets[slug] = market;
  //     } catch (err) {
  //       console.error(`Failed to fetch market ${slug}:`, err);
  //     }
  //   }

  //   return markets;
  // }

  async get_market(gpuMarket_slug: GpuMarketSlug): Promise<Market> {
    const address = MARKETS[gpuMarket_slug].address;
    const marketInfo: Market = await this.nosana.jobs.getMarket(address);
    if (!marketInfo) throw new Error(`Unknown GPU market: ${address}`);

    return marketInfo
  }

  async getAvailableGpuNodes(gpuMarket: GpuMarketSlug): Promise<number> {
    const marketInfo: MarketInfo | undefined = MARKETS[gpuMarket];
    if (!marketInfo) throw new Error(`Unknown GPU market: ${gpuMarket}`);

    const marketAddress = new PublicKey(marketInfo.address);
    const market = await this.nosana.jobs.getMarket(marketAddress);
    return Array.isArray(market.queue) ? market.queue.length : 0;
  }

  async estimateJobCost(
    gpuMarket: GpuMarketSlug,
    durationSeconds: number
  ): Promise<{ pricePerSecond: number; estimatedCost: number }> {
    const marketInfo: MarketInfo | undefined = MARKETS[gpuMarket];
    if (!marketInfo) throw new Error(`Unknown GPU market: ${gpuMarket}`);

    const marketAddress = new PublicKey(marketInfo.address);
    const market = await this.nosana.jobs.getMarket(marketAddress);
    
    const pricePerSecond = Number(market.jobPrice) / 1e6;
    const estimatedCost = pricePerSecond * durationSeconds;

    return { pricePerSecond, estimatedCost };
  }

  async createJob(
    params: CreateJobParams
  ): Promise<{ jobId: string; ipfsHash: string; market: string }> {
    const { modelName, gpuMarket, cmd, requiredVramGB, exposePort, env, userPublicKey } = params;

    const modelSpec = assertModelOnMarket(modelName, gpuMarket);
    assertImagePresent(modelSpec);

    const jobDefinition = buildJobDefinition({
      model: modelName,
      market: gpuMarket,
      entryCmd: cmd ?? modelSpec.defaultCmd,
      requiredVramGB,
      exposePort,
      env
    });

    const ipfsHash = await this.nosana.ipfs.pin(jobDefinition);
    const marketPk = new PublicKey(MARKETS[gpuMarket].address);

    const deploymentBody = {
      ipfs: ipfsHash,
      market: marketPk.toBase58(),
      metadata: { model: modelName, gpuMarket, network: this.network, userPubKey: userPublicKey?.toBase58() },
    };

    const response = await this.nosana.deployments.create(deploymentBody as any);

    const jobId =
      (response as any).deployment ??
      (response as any).job ??
      (response as any).id ??
      'unknown';

    return { jobId, ipfsHash, market: marketPk.toBase58() };
  }

  async getJob(jobId: string): Promise<Job | null> {
    try {
      return await this.nosana.jobs.get(new PublicKey(jobId));
    } catch (error) {
      console.error(`Could not fetch job ${jobId}:`, error);
      return null;
    }
  }

  async stopJob(jobId: string): Promise<{ ok: boolean; tx?: string; note?: string }> {
    try {
      const result = await this.nosana.jobs.end(jobId);
      if ('tx' in result)
        return { ok: true, tx: result.tx, note: 'Stopped via blockchain transaction' };
      return { ok: true, note: 'Instruction generated for manual broadcast' };
    } catch (err) {
      console.warn('Blockchain stop failed, fallback to API:', err);
    }

    if (this.apiKey) {
      try {
        const res = await this.nosana.api.jobs.stop({ jobAddress: jobId });
        return { ok: true, note: 'Stopped via credits API', tx: res.transactionId ?? undefined };
      } catch (err2) {
        console.warn('Credits stop failed:', err2);
      }

      const endpoint =
        this.network === 'mainnet'
          ? 'https://dashboard.k8s.prd.nos.ci/api/jobs'
          : 'https://dashboard.k8s.dev.nos.ci/api/jobs';

      const response = await fetch(`${endpoint}/stop-with-credits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobAddress: jobId }),
      });

      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      const json = await response.json();
      return { ok: true, note: 'Stopped via manual REST', tx: json.tx ?? undefined };
    }

    throw new Error('Failed to stop job (no valid method available)');
  }

  async getExactValue(marketPubKey: string | PublicKey, seconds: number) {
    const SOL = 0.00429;

    const marketSlug = Object.keys(MARKETS).find(
      slug => MARKETS[slug as GpuMarketSlug].address === marketPubKey
    );
    if (!marketSlug) throw new Error("Invalid market public key.");

    const pricePerHour = MARKETS[marketSlug as GpuMarketSlug].estimated_price_usd_per_hour as number;
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


  async extendJobRuntime(
    jobId: string,
    extensionSeconds: number
  ): Promise<{ ok: boolean; txId?: string; note: string }> {
    try {
      const payload: ExtendJobWithCreditsRequest = { jobAddress: jobId, extensionSeconds };
      const res = await this.nosana.api.jobs.extend(payload);
      return {
        ok: true,
        txId: (res as any).transactionId ?? undefined,
        note: 'Extended via Nosana SDK API',
      };
    } catch (sdkErr) {
      console.warn('SDK extend failed, trying REST fallback:', sdkErr);
    }

    if (!this.apiKey)
      throw new Error('NOSANA_API_KEY environment variable not set.');

    const endpoint =
      this.network === 'mainnet'
        ? 'https://dashboard.k8s.prd.nos.ci/api/jobs/extend-with-credits'
        : 'https://dashboard.k8s.dev.nos.ci/api/jobs/extend-with-credits';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobAddress: jobId, extensionSeconds }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Extend job API error: ${res.status} ${res.statusText}\n${text}`);
    }

    const data = await res.json();
    return {
      ok: true,
      txId: data.transactionId ?? undefined,
      note: 'Extended via REST API fallback',
    };
  }
}

let deployerInstance: NosanaDeployer | null = null
try {
  deployerInstance = new NosanaDeployer("mainnet");
} catch {
  console.log("error conncting nosana_deployer");
}

export default deployerInstance