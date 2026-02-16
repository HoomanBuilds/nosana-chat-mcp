import { Client, Market } from "@nosana/sdk";
import { PublicKey } from "@solana/web3.js";
import {
  WalletBalance,
  CreditBalance,
  GpuMarketSlug,
  MarketInfo,
  Network,
  JobsResponse,
  HFModel,
  ModelQuery,
} from "./utils/types";
import { MARKETS, MARKET_ADDRESS_TO_SLUG } from "./utils/supportingModel";
import { DEFAULT_DEPLOYER } from "../constants";

export class NosanaDeployer {
  private nosana: Client;
  private network: Network;
  private apiKey?: string;

  constructor(network: Network = "mainnet") {
    this.network = network;
    this.nosana = new Client(network);
    this.apiKey = process.env.NOSANA_API_KEY;
  }

  async getAllJobs(
    userPubKey: string,
    { limit, state }: { limit: number; state: string },
  ): Promise<JobsResponse> {
    if (!userPubKey) throw new Error("userPubKey required");
    const { status, body } = await this.fetchJobsTemp(userPubKey, {
      limit,
      state,
    });
    if (status !== 200) throw new Error(`fetchJobs failed: ${status}`);

    for (const job of body.jobs) delete job.jobDefinition;
    return body;
  }

  async getWalletBalance(publicKey?: string): Promise<WalletBalance> {
    const pk = new PublicKey(publicKey as string);
    // Parallelize balance fetching for better performance
    const [solBalance, nosBalance] = await Promise.all([
      this.nosana.solana.getSolBalance(pk ? pk : undefined),
      this.nosana.solana.getNosBalance(pk ? pk : undefined),
    ]);
    const sol = solBalance / 1e9;
    const nos = Number(nosBalance?.amount ?? 0) / 1000000;
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
      console.warn("SDK balance fetch failed, using REST fallback:", sdkErr);
    }

    if (!this.apiKey)
      throw new Error("NOSANA_API_KEY environment variable not set.");

    const endpoint =
      this.network === "mainnet"
        ? "https://dashboard.k8s.prd.nos.ci/api/credits/balance"
        : "https://dashboard.k8s.dev.nos.ci/api/credits/balance";

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

  async get_market(
    gpuMarket_slug?: GpuMarketSlug,
    gpuMarket_address?: string,
  ): Promise<{
    market: Market;
    nos: number;
    gpu_usd: number;
    marketName?: string;
  }> {
    if (!this.nosana || !this.nosana.jobs) {
      throw new Error("Nosana SDK not initialized (nosana.jobs missing)");
    }

    let nos_usd: number | undefined;
    try {
      const nosPrice = await this.nosana.jobs.getNosPrice();
      nos_usd = nosPrice?.usd ?? nosPrice?.price ?? nosPrice?.data?.usd;
    } catch {
      console.warn("⚠️ NOS price fetch failed, using fallback 0.02 USD/NOS");
    }

    if (!nos_usd || !Number.isFinite(nos_usd) || nos_usd <= 0) {
      nos_usd = DEFAULT_DEPLOYER.VALUES.NOS_USD;
    }

    const hasAddr =
      typeof gpuMarket_address === "string" && gpuMarket_address.length > 20;
    const hasSlug =
      typeof gpuMarket_slug === "string" && gpuMarket_slug.length > 0;

    if (!(hasAddr || hasSlug)) {
      throw new Error(
        "Either gpuMarket_slug or gpuMarket_address must be provided",
      );
    }

    if (hasAddr) {
      const address = new PublicKey(gpuMarket_address!);
      // Use O(1) lookup instead of O(n) search
      const slug = MARKET_ADDRESS_TO_SLUG[address.toString()];

      const gpu_usd = slug
        ? MARKETS[slug].estimated_price_usd_per_hour
        : undefined;
      if (gpu_usd == null)
        throw new Error(`No pricing info for ${gpuMarket_address}`);

      const marketInfo: Market = await this.nosana.jobs.getMarket(address);
      if (!marketInfo)
        throw new Error(`Unknown GPU market: ${gpuMarket_address}`);

      return { market: marketInfo, nos: nos_usd, gpu_usd, marketName: slug };
    }

    const entry = MARKETS[gpuMarket_slug as GpuMarketSlug];
    if (!entry?.address)
      throw new Error(`Unknown GPU market slug: ${gpuMarket_slug}`);

    const address = new PublicKey(entry.address);
    const gpu_usd = entry.estimated_price_usd_per_hour;
    const marketInfo: Market = await this.nosana.jobs.getMarket(address);
    if (!marketInfo) throw new Error(`Unknown GPU market: ${entry.address}`);

    return {
      market: marketInfo,
      nos: nos_usd,
      gpu_usd,
      marketName: gpuMarket_slug,
    };
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
    durationSeconds: number,
  ): Promise<{ pricePerSecond: number; estimatedCost: number }> {
    const marketInfo = MARKETS[gpuMarket];
    if (!marketInfo?.address)
      throw new Error(`Invalid or missing market address for ${gpuMarket}`);

    let marketAddress;
    try {
      marketAddress = new PublicKey(marketInfo.address);
    } catch (err) {
      console.error(
        "Invalid address:",
        marketInfo.address,
        (err as Error).message,
      );
      marketAddress = marketInfo.address;
    }

    const market = await this.nosana?.jobs?.getMarket?.(marketAddress);
    if (!market || market.jobPrice == null) {
      console.error("Missing jobPrice for market:", gpuMarket, market);
      throw new Error(`Market data missing jobPrice for ${gpuMarket}`);
    }

    const jobPrice = Number(market.jobPrice);
    if (isNaN(jobPrice)) throw new Error(`Invalid jobPrice for ${gpuMarket}`);

    const pricePerSecond = jobPrice / 1e6;
    const estimatedCost = pricePerSecond * durationSeconds;
    return { pricePerSecond, estimatedCost };
  }

  async getJob(jobId: string): Promise<any | null> {
    try {
      const job = await this.nosana.jobs.get(new PublicKey(jobId));
      const NOS_USD = this.nosana.jobs.getNosPrice();

      return { job, NOS_USD };
    } catch (error) {
      console.error(`Could not fetch job ${jobId}:`, error);
      return null;
    }
  }

  async getAllMarket() {
    const market: any[] = await this.nosana.jobs.allMarkets();

    console.log(market);
  }
  async getExactValue(marketPubKey: string | PublicKey, seconds: number) {
    const SOL = 0.00429;
    const NETWORK = 0.00002;

    // Convert PublicKey to string if needed
    const addressStr =
      typeof marketPubKey === "string" ? marketPubKey : marketPubKey.toString();

    // Use O(1) lookup instead of O(n) search
    const marketSlug = MARKET_ADDRESS_TO_SLUG[addressStr];
    if (!marketSlug)
      throw new Error(`Invalid market public key: ${addressStr}`);

    const pricePerHour = MARKETS[marketSlug].estimated_price_usd_per_hour;
    const totalUsd = (pricePerHour / 3600) * seconds;
    const hours = seconds / 3600;

    // Parallelize price fetching for better performance
    const [nosUsd, solUsd] = await Promise.all([
      this.get_nos_Usd(), // USD value of 1 NOS
      this.get_sol_Usd(), // USD value of 1 SOL
    ]);

    const totalNos = Number(totalUsd / nosUsd);
    const NOS_USD = totalNos * nosUsd;
    const SOL_USD = solUsd * SOL;
    const NETWORK_USD = NETWORK * solUsd;

    const TOTAL_USD = totalUsd + SOL * solUsd + NETWORK_USD;

    return {
      market: marketSlug,
      hours,
      USD: totalUsd,
      NOS: totalNos.toFixed(3),
      NOS_USD,
      SOL,
      NETWORK,
      SOL_USD,
      NETWORK_USD,
      TOTAL_USD,
    };
  }

  async fetchJobsTemp(
    publicKey: string,
    opts: { limit: number; state?: string | undefined } = { limit: 20 },
  ) {
    const baseUrl = "https://dashboard.k8s.prd.nos.ci/api/jobs";
    const u = new URL(baseUrl);
    u.searchParams.set("limit", String(opts.limit));
    if (opts.state && opts.state.toLocaleLowerCase() != "all")
      u.searchParams.set("state", opts.state);
    u.searchParams.set("poster", publicKey);

    const res = await fetch(u.toString(), {
      method: "GET",
      headers: {
        Origin: "https://dashboard.nosana.com",
        Referer: "https://dashboard.nosana.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
        "sec-ch-ua":
          '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
      },
    });

    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json")
      ? await res.json()
      : await res.text();
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers),
      body,
    };
  }

  async get_nos_Usd(): Promise<number> {
    try {
      const price = await this.nosana.solana.getNosPrice();
      return Number(price?.usd ?? DEFAULT_DEPLOYER.VALUES.NOS_USD);
    } catch (err) {
      console.error("getNosPrice failed:", err);
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=nosana&vs_currencies=usd",
        );
        const data = await res.json();
        return Number(data?.nosana?.usd ?? DEFAULT_DEPLOYER.VALUES.NOS_USD);
      } catch (err2) {
        console.error("Coingecko fallback failed:", err2);
        return DEFAULT_DEPLOYER.VALUES.NOS_USD;
      }
    }
  }

  async get_sol_Usd() {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (res.status === 429) {
        console.warn(
          "Rate limited by CoinGecko, using last known or default price",
        );
        return DEFAULT_DEPLOYER.VALUES.SOL_USD;
      }
      const data = await res.json();
      return Number(data.solana?.usd) || DEFAULT_DEPLOYER.VALUES.SOL_USD;
    } catch (err) {
      console.warn("get_sol_Usd failed:", err);
      return DEFAULT_DEPLOYER.VALUES.SOL_USD;
    }
  }

  async getModels({
    organization,
    pipeline,
    keywords = [],
    limit = 10,
    topK = 10,
  }: ModelQuery): Promise<HFModel[]> {
    console.log("getModels :", organization, pipeline, keywords);
    const base = new URL("https://huggingface.co/api/models");
    base.searchParams.set("author", organization);
    // base.searchParams.set("sort", "trending")
    // base.searchParams.set("inference_provider", "all")
    base.searchParams.set("limit", limit.toString());
    base.searchParams.set("pipeline_tag", pipeline);
    console.log(base);

    const res = await fetch(base.href);
    if (!res.ok) throw new Error(`HF fetch failed: ${res.statusText}`);
    const models: any[] = await res.json();

    const kws = keywords.map((k) =>
      k.toLowerCase().replace(/\s+/g, "").replace(/-/g, ""),
    );

    const scored = models.map((m) => {
      const name = (m.modelId || m.id || "").toLowerCase();
      const tags = (m.tags || []).join(" ").toLowerCase();
      const pipe = (m.pipeline_tag || "").toLowerCase();
      let score = 0;

      for (const kw of kws) {
        if (name.includes(kw)) score += 3;
        if (tags.includes(kw)) score += 2;
      }

      if (pipeline && pipe === pipeline.toLowerCase()) score += 2;
      if (name.includes(organization.toLowerCase())) score += 1;
      score += (m.likes || 0) / 1000 + (m.downloads || 0) / 1000000;

      return { id: m.id, private: !!m.private, score };
    });

    const sorted = scored.sort((a, b) => b.score - a.score);
    const filtered = sorted.filter((m) => m.score > 0);
    return filtered.slice(0, filtered.length ? topK : 10);
  }
}

let deployerInstance: NosanaDeployer | null = null;

export function ensureDeployer(): NosanaDeployer {
  if (!deployerInstance) {
    console.warn("Initializing NosanaDeployer...");
    deployerInstance = new NosanaDeployer("mainnet");
  }
  return deployerInstance;
}
