import { GpuMarketSlug, MarketInfo, ModelId, ModelSpec } from "./types.js";


export const MARKETS: Record<GpuMarketSlug, MarketInfo> = {
  'nvidia-3060': {
    slug: 'nvidia-3060',
    address: '7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq',
    vram_gb: 12,
    vram_type: 'GDDR6',
    cuda_cores: 3584,
    tdp_w: 170,
    memory_gb: 32,
    storage_gb: 250,
    country: 'unknown',
    version: '1.0',
    estimated_price_usd_per_hour: 0.048,
    notes: 'Consumer-grade GPU; efficient for small-scale ML and inference.'
  },

  'nvidia-4060': {
    slug: 'nvidia-4060',
    address: '47LQHZwT7gfVoBDYnRYhsYv6vKk8a1oW3Y3SdHAp1gTr',
    vram_gb: 8,
    vram_type: 'GDDR6',
    cuda_cores: 3072,
    tdp_w: 115,
    memory_gb: 32,
    storage_gb: 250,
    country: 'unknown',
    version: '1.0',
    estimated_price_usd_per_hour: 0.064,
    notes: 'Ada Lovelace architecture; efficient, but limited VRAM.'
  },

  'nvidia-3070': {
    slug: 'nvidia-3070',
    address: 'RXP7JK8MTY4uPJng4UjC9ZJdDDSG6wGr8pvVf3mwgXF',
    vram_gb: 8,
    vram_type: 'GDDR6',
    cuda_cores: 5888,
    tdp_w: 220,
    memory_gb: 64,
    storage_gb: 500,
    country: 'unknown',
    version: '1.0',
    estimated_price_usd_per_hour: 0.080,
    notes: 'Upper mid-range; strong for medium ML workloads and training.'
  },

  'nvidia-3080': {
    slug: 'nvidia-3080',
    address: '7RepDm4Xt9k6qV5oiSHvi8oBoty4Q2tfBGnCYjFLj6vA',
    vram_gb: 10,
    vram_type: 'GDDR6X',
    cuda_cores: 8704,
    tdp_w: 320,
    memory_gb: 128,
    storage_gb: 1000,
    country: 'unknown',
    version: '1.0',
    estimated_price_usd_per_hour: 0.096,
    notes: 'High-end consumer GPU; capable of large-scale inference and some training.'
  },

  'nvidia-h100': {
    slug: 'nvidia-h100',
    address: 'Crop49jpc7prcgAcS82WbWyGHwbN5GgDym3uFbxxCTZg',
    vram_gb: 80,
    vram_type: 'HBM3',
    cuda_cores: 16896,
    tdp_w: 700,
    memory_gb: 1024,
    storage_gb: 2000,
    country: 'unknown',
    version: '1.0',
    estimated_price_usd_per_hour: 1.5,
    notes: 'Enterprise-grade Hopper GPU; designed for large-scale AI and LLM workloads.'
  }
};

export const MODELS: Record<ModelId, ModelSpec> = {
  'deepseek-r1:7b': {
    modelName : "deepseek",
    id: 'deepseek-r1:7b',
    dockerImage: 'docker.io/hoomanhq/oneclickllm:latest',
    minVramGB: 16,
    defaultCmd: ["-c", "echo 'ready'"],
    exposePort: 8000,
    allowedMarkets: ['nvidia-3060', 'nvidia-3070', 'nvidia-3080', 'nvidia-4060'],
  },
  'llama-3.8b': {
    modelName: "llama",
    id: 'llama-3.8b',
    dockerImage: 'docker.io/hoomanhq/oneclickllm:latest',
    minVramGB: 18,
    defaultCmd: ["-c", "ollama serve"],
    exposePort: 8000,
    allowedMarkets: ['nvidia-3060', 'nvidia-3070', 'nvidia-3080', 'nvidia-4060'],
  },
  'mistral-7b': {
    id: 'mistral-7b',
    modelName : "mistral",
    dockerImage: 'docker.io/hoomanhq/oneclickllm:latest',
    minVramGB: 8,
    exposePort: 8000,
    defaultCmd: [""],
    allowedMarkets: ['nvidia-3060', 'nvidia-3070', 'nvidia-3080', 'nvidia-4060'],
  },
  'qwen3:0.6b': {
    id: 'qwen3:0.6b',
    modelName : 'qwen',
    dockerImage: 'docker.io/hoomanhq/oneclickllm:latest',
    minVramGB: 16,
    defaultCmd: [
      "",
      ""
    ],
    exposePort: 8000,
    allowedMarkets: ['nvidia-3060', 'nvidia-3070', 'nvidia-3080', 'nvidia-4060'],
  },
};

export const modelsForMarket = (slug: GpuMarketSlug) =>
  Object.values(MODELS).filter(m => m.allowedMarkets.includes(slug));
