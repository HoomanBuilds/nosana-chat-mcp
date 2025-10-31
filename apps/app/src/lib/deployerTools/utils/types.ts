import { PublicKey } from "@solana/web3.js";
import { Pipeline } from "./schema";

export interface WalletBalance {
  sol: number;
  nos: number;
}

export const SELF_MODEL_AVAILABLE = ["qwen", "llama", "deepseek", "mistral"] as const;

export type SELF_MODEL_AVAILABLE = typeof SELF_MODEL_AVAILABLE[number];
export interface CreditBalance {
  assignedCredits: number;
  reservedCredits: number;
  settledCredits: number;
}

export const DEFAULT_MARKETS = [
  'nvidia-3060',
  'nvidia-4060',
  'nvidia-3070',
  'nvidia-3080',
  'nvidia-4070',
  'nvidia-a4000',
  'nvidia-4080',
  'nvidia-3090',
  'nvidia-5070',
  'nvidia-a5000',
  'nvidia-4090',
  'nvidia-5080',
  'nvidia-a40',
  'nvidia-a6000',
  'nvidia-6000-ada',
  'nvidia-a100-40gb',
  'nvidia-5090',
  'nvidia-a100-80gb',
  'nvidia-pro-6000',
  'nvidia-h100'
] as const;


export type GpuMarketSlug = typeof DEFAULT_MARKETS[number];

export interface MarketInfo {
  slug: GpuMarketSlug;
  address: string;
  vram_gb: number;
  estimated_price_usd_per_hour: number;
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


export type CreateJobInput = {
  model: string;
  market: GpuMarketSlug;

  entryCmd?: string[] | string;     
  cmd?: string;                     
  env?: Record<string, string>;     

  requiredVramGB?: number;          
  requiredCuda?: string[];          
  exposePort?: number;              
  timeoutSeconds?: number;          
};


export type UpdateJobInput =
  | { type: 'update_runtime'; jobAddress: string; extensionSeconds: number }
  | { type: 'update_gpu'; jobAddress: string; market: GpuMarketSlug };

export type Network = 'mainnet' | 'devnet';


export interface JobDefinition {
  version?: string;
  type: string;
  meta?: {
    trigger: string;
    system_requirements?: {
      required_vram?: number;
      required_cuda?: string[];
    };
    timeout_seconds?: number;
  };
  ops?: {
    id: string;
    type: string;
    args: {
      image: string;
      gpu?: boolean;
      env?: Record<string, string>;
      cmd?: string[];
      expose?: {
        port: number;
        health_checks?: {
          body?: string;
          path: string;
          type: string;
          method: string;
          headers?: Record<string, string>;
          continuous?: boolean;
          expected_status?: number;
        }[];
      }[];
    };
  }[];
}

export interface JobResult {
  status: string;
  startTime: number;
  endTime: number;
  secrets?: Record<string, any>;
  opStates: {
    status: string;
    startTime: number;
    endTime: number;
    exitCode: number;
    providerId: string;
    operationId: string;
  }[];
}

export interface JobC {
  id: number;
  address: string;
  ipfsJob: string;
  ipfsResult: string;
  market: string;
  node: string;
  payer: string;
  price: number;
  project: string;
  state: number;
  type: string;
  jobDefinition?: JobDefinition;
  jobResult?: JobResult;
  jobStatus: string;
  timeStart: number;
  timeEnd: number;
  benchmarkProcessedAt?: number | null;
  timeout: number;
  usdRewardPerHour: number;
  listedAt: number;
}

export interface JobsResponse {
  jobs: JobC[];
  totalJobs: number;
}

  
export interface ModelQuery {
  organization: string
  pipeline: Pipeline
  keywords?: string[]
  limit?: number
  topK?: number
}

export interface HFModel {
  id: string
  private: boolean
}




export interface RecommendedGPU {
    parameters?: string;
    gpuModel?: string;
    requiredVram?: string;
    pricePerHour?: number;
    memoryUtilization?: string;
    tensorParallelism?: boolean;
    [key: string]: any;
}

export interface ModelEntry {
    name: string;
    size?: string;
    context?: string;
    recommendedGPU?: RecommendedGPU;
    [key: string]: any;
}

export interface ModelFamily {
    family: string;
    description?: string;
    tags?: string[];
    models: ModelEntry[];
    last_updated?: string;
    [key: string]: any;
}

export interface QueryParams {
  op: "<" | "<=" | ">" | ">=" | "=";
  value?: number | null;
  strict?: boolean;
}

export interface QueryFilter {
  families?: string[];
  params?: QueryParams | null;
  quant?: string | null;
  tags?: string[];
  gpuPreference?: "balance" | "medium" | "expensive" | null;
  memoryUtilization?: "high" | "mid" | "low" | null;
  tensorParallelism?: boolean | null;
  sort?: "latest" | "popular" | null;
}


export interface QueryFilter {
  families?: string[];
  params?: QueryParams | null;
  quant?: string | null;
  tags?: string[];
  gpuPreference?: "balance" | "medium" | "expensive" | null;
  memoryUtilization?: "high" | "mid" | "low" | null;
  tensorParallelism?: boolean | null;
  sort?: "latest" | "popular" | null;
}


export interface ScoredModel extends ModelEntry {
    family: string;
    score: number;
}