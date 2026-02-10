import { PublicKey } from "@solana/web3.js";

// ── Auth Mode ──────────────────────────────────────────────
export type AuthMode = 'wallet' | 'api_key';

export interface AuthContext {
  mode: AuthMode;
  /** Wallet public key (wallet mode) or API key (api_key mode) */
  credential: string;
}

/** Detect auth mode from the credential string */
export function detectAuthMode(credential: string): AuthMode {
  // Nosana API keys start with 'nos_'
  if (credential.startsWith('nos_')) return 'api_key';
  return 'wallet';
}

// ── Nosana HTTP API Config ─────────────────────────────────
export const NOSANA_API_BASE = {
  mainnet: 'https://dashboard.k8s.prd.nos.ci/api',
  devnet: 'https://dashboard.k8s.dev.nos.ci/api',
} as const;

// ── Deployment API Types ───────────────────────────────────
export interface DeploymentCreateParams {
  name: string;
  market: string;
  timeout: number;
  replicas: number;
  strategy: 'SIMPLE' | 'SCHEDULED';
  job_definition: Record<string, any>;
}

export interface DeploymentResponse {
  id: string;
  name: string;
  status: string;
  market: string;
  replicas: number;
  strategy: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export interface WalletBalance {
  sol: number;
  nos: number;
}

export const SELF_MODEL_AVAILABLE = ["qwen3:0.6b", "llama-3.8b", "deepseek-r1:7b", "mistral-7b"] as const;
export type SELF_MODEL_AVAILABLE = typeof SELF_MODEL_AVAILABLE[number];
export interface CreditBalance {
  assignedCredits: number;
  reservedCredits: number;
  settledCredits: number;
}

export const DEFAULT_MARKETS = ['nvidia-3060', 'nvidia-3070', 'nvidia-3080', 'nvidia-4060' , 'nvidia-h100'] as const;
export type GpuMarketSlug = typeof DEFAULT_MARKETS[number];

export interface MarketInfo {
  slug: GpuMarketSlug;
  address: string;
  vram_gb?: number;
  vram_type?: string;
  cuda_cores?: number;
  tdp_w?: number;
  memory_gb?: number;  
  storage_gb?: number;
  country?: string;
  version?: string;
  estimated_price_usd_per_hour?: number;
  notes?: string;
}

export type ModelId = SELF_MODEL_AVAILABLE

export type ModelSpec = {
  id: ModelId;
  dockerImage: string;
  modelName: string;
    minVramGB: number;
  defaultCmd?: string[] | string;
  exposePort?: number;
  health?: { type: 'http'; path: string; expectedStatus: number } | { type:'websocket'; expected: string };
  allowedMarkets: GpuMarketSlug[];
};


export interface CreateJobParams {
  modelName: ModelId;
  gpuMarket: GpuMarketSlug;
  cmd?: string[] | string;
  userPublicKey?: PublicKey;
  requiredVramGB?: number;
  exposePort?: number;
  env?: Record<string, string>;
  resources?: Array<{
    type: 'S3' | 'HF';
    url?: string;
    target: string;
    repo?: string;
    files?: string[];
    bucket?: string;
    IAM?: {
      ACCESS_KEY_ID?: string;
      SECRET_ACCESS_KEY?: string;
      REGION?: string;
    };
  }>;
}


export interface JobDefinition {
  version: '0.1';
  type: 'container';
  meta: {
    trigger: 'cli';
    system_resources: { required_vram: number };
  };
  ops: Array<{
    id: string;
    type: 'container/run';
    args: {
      image: string;
      cmd?: string[] | string;
      gpu: boolean;
    };
  }>;
}

export type CreateJobInput = {
  model: ModelId;
  market: GpuMarketSlug;       
  entryCmd?: string[] | string;
  env?: Record<string, string>;
  requiredVramGB?: number;            
  exposePort?: number;
  cmd?: string;
  timeoutSeconds?: number;
};


export type UpdateJobInput =
  | { type: 'update_runtime'; jobAddress: string; extensionSeconds: number }
  | { type: 'update_gpu'; jobAddress: string; market: GpuMarketSlug };

export type Network = 'mainnet' | 'devnet';

// ── API-mode Job Types ─────────────────────────────────────
export interface ApiJobPostParams {
  ipfsHash: string;
  market: string;
  timeout?: number;
  node?: string;
}

export interface ApiJobResponse {
  address?: string;
  job?: string;
  state?: string;
  credits?: {
    creditsUsed?: number;
  };
  [key: string]: any;
}

export interface ApiCreditBalance {
  assignedCredits: number;
  reservedCredits: number;
  settledCredits: number;
}
