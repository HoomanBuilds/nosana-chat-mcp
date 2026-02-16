import { GpuMarketSlug, MarketInfo } from "./types";

export const MARKETS: Record<GpuMarketSlug, MarketInfo> = {
  "nvidia-3060": {
    slug: "nvidia-3060",
    address: "7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq",
    vram_gb: 4,
    estimated_price_usd_per_hour: 0.048,
  },
  "nvidia-4060": {
    slug: "nvidia-4060",
    address: "47LQHZwT7gfVoBDYnRYhsYv6vKk8a1oW3Y3SdHAp1gTr",
    vram_gb: 8,
    estimated_price_usd_per_hour: 0.064,
  },
  "nvidia-3070": {
    slug: "nvidia-3070",
    address: "RXP7JK8MTY4uPJng4UjC9ZJdDDSG6wGr8pvVf3mwgXF",
    vram_gb: 8,
    estimated_price_usd_per_hour: 0.08,
  },
  "nvidia-3080": {
    slug: "nvidia-3080",
    address: "7RepDm4Xt9k6qV5oiSHvi8oBoty4Q2tfBGnCYjFLj6vA",
    vram_gb: 10,
    estimated_price_usd_per_hour: 0.096,
  },
  "nvidia-4070": {
    slug: "nvidia-4070",
    address: "EzuHhkrhmV98HWzREsgLenKj2iHdJgrKmzfL8psP8Aso",
    vram_gb: 12,
    estimated_price_usd_per_hour: 0.096,
  },
  "nvidia-a4000": {
    slug: "nvidia-a4000",
    address: "7fnuvPYzfd961iRDPRgMSKLrUf1QjTGnn7viu3P12Zuc",
    vram_gb: 16,
    estimated_price_usd_per_hour: 0.128,
  },
  "nvidia-4080": {
    slug: "nvidia-4080",
    address: "77wdaAuYVxBW5u2QiqddkAzoBZ5cuKxH9ZCbx5HfFUb2",
    vram_gb: 16,
    estimated_price_usd_per_hour: 0.16,
  },
  "nvidia-3090": {
    slug: "nvidia-3090",
    address: "CA5pMpqkYFKtme7K31pNB1s62X2SdhEv1nN9RdxKCpuQ",
    vram_gb: 24,
    estimated_price_usd_per_hour: 0.192,
  },
  "nvidia-5070": {
    slug: "nvidia-5070",
    address: "5eX3kWkrcbwejEc1svbfP4F7NKYjtPDuyU5KnV1hUBKg",
    estimated_price_usd_per_hour: 0.24,
    vram_gb: 15,
  },
  "nvidia-a5000": {
    slug: "nvidia-a5000",
    address: "4uBye3vJ1FAYukDdrvqQ36MZZZxqW3o8utWu8fyomRuN",
    vram_gb: 24,
    estimated_price_usd_per_hour: 0.32,
  },
  "nvidia-4090": {
    slug: "nvidia-4090",
    address: "97G9NnvBDQ2WpKu6fasoMsAKmfj63C9rhysJnkeWodAf",
    vram_gb: 24,
    estimated_price_usd_per_hour: 0.32,
  },
  "nvidia-5080": {
    slug: "nvidia-5080",
    address: "9HnJacS25TnErsKMYJmKqWeCAMYuwY7gzhz9Eqhp5VE7",
    vram_gb: 24,
    estimated_price_usd_per_hour: 0.39,
  },
  "nvidia-a40": {
    slug: "nvidia-a40",
    address: "BLqSzPzcXMX5gseNXE4Ma45f31Eo6tNFVYoRmPG7kxP2",
    vram_gb: 48,
    estimated_price_usd_per_hour: 0.4,
  },
  "nvidia-a6000": {
    slug: "nvidia-a6000",
    address: "EjryZ6XEthz3z7nnLfjXBYafyn7VyHgChfbfM47LfAao",
    vram_gb: 48,
    estimated_price_usd_per_hour: 0.45,
  },
  "nvidia-6000-ada": {
    slug: "nvidia-6000-ada",
    address: "6eMivCx49anWFYwNgg8KNJQfSJYB5nBdif8CK6z52dem",
    vram_gb: 48,
    estimated_price_usd_per_hour: 0.61,
  },
  "nvidia-a100-40gb": {
    slug: "nvidia-a100-40gb",
    address: "F3aGGSMb73XHbJbDXVbcXo7iYM9fyevvAZGQfwgrnWtB",
    vram_gb: 40,
    estimated_price_usd_per_hour: 0.61,
  },
  "nvidia-5090": {
    slug: "nvidia-5090",
    address: "6Xt8hgVLLL2PSHC9NtJP8E8oTdA5ZJc95hZEnHcdqKqb",
    vram_gb: 40,
    estimated_price_usd_per_hour: 0.68,
  },
  "nvidia-a100-80gb": {
    slug: "nvidia-a100-80gb",
    address: "GLJHzqRN9fKGBsvsFzmGnaQGknUtLN1dqaFR8n3YdM22",
    vram_gb: 80,
    estimated_price_usd_per_hour: 0.9,
  },
  "nvidia-pro-6000": {
    slug: "nvidia-pro-6000",
    address: "Ekro9NTNqLbnMkN7x7y2rY9AeTkazcHj2PPaTxT1Cogz",
    vram_gb: 80,
    estimated_price_usd_per_hour: 1.0,
  },
  "nvidia-h100": {
    slug: "nvidia-h100",
    address: "Crop49jpc7prcgAcS82WbWyGHwbN5GgDym3uFbxxCTZg",
    vram_gb: 80,
    estimated_price_usd_per_hour: 1.5,
  },
};

// Precomputed lookup map for O(1) address-to-slug resolution
export const MARKET_ADDRESS_TO_SLUG: Record<string, GpuMarketSlug> =
  Object.fromEntries(
    Object.entries(MARKETS).map(([slug, info]) => [
      info.address,
      slug as GpuMarketSlug,
    ]),
  );

// Precomputed array of markets sorted by VRAM for quick lookups
export const MARKETS_BY_VRAM = Object.values(MARKETS).sort(
  (a, b) => a.vram_gb - b.vram_gb,
);
