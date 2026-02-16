import { Pipeline } from "./schema";

export type ImageConfig = {
  image: string;
  description: string;
  cmd: (args: {
    model: string;
    port: number;
    host: string;
    api_key?: string;
  }) => string[];
  legacy?: string[];
};

export const IMAGE_REGISTRY: Record<Pipeline, ImageConfig> = {
  "image-to-image": {
    image: "ghcr.io/huggingface/api-inference-community:latest",
    description: "Image-to-image transformation models.",
    cmd: (args) => [
      "python3",
      "manage.py",
      "start",
      "--model-id",
      args.model,
      "--port",
      String(args.port),
      "--framework",
      "diffusers",
      "--task",
      "image-to-image",
    ],
  },
  "audio-classification": {
    image: "ghcr.io/huggingface/api-inference-community:latest",
    description: "Audio classification models.",
    cmd: (args) => [
      "python3",
      "manage.py",
      "start",
      "--model-id",
      args.model,
      "--port",
      String(args.port),
      "--framework",
      "transformers",
      "--task",
      "audio-classification",
    ],
  },
  "image-classification": {
    image: "ghcr.io/huggingface/api-inference-community:latest",
    description: "Image classification models.",
    cmd: (args) => [
      "python3",
      "manage.py",
      "start",
      "--model-id",
      args.model,
      "--port",
      String(args.port),
      "--framework",
      "transformers",
      "--task",
      "image-classification",
    ],
  },
  "text-generation": {
    image: "ghcr.io/huggingface/text-generation-inference:latest",
    description: "High-performance LLM backend for text tasks.",
    legacy: ["text-generation"],
    cmd: (args) => {
      const base = [
        "--model-id",
        args.model,
        "--port",
        String(args.port),
        "--hostname",
        args.host,
      ];
      if (args.api_key) base.push("--api-key", args.api_key);
      return base;
    },
  },
  "feature-extraction": {
    image: "ghcr.io/huggingface/text-embeddings-inference:latest",
    description: "Text embedding service optimized for semantic search.",
    legacy: ["embeddings"],
    cmd: (args) => {
      const base = [
        "--model-id",
        args.model,
        "--port",
        String(args.port),
        "--host",
        args.host,
      ];
      if (args.api_key) base.push("--api-key", args.api_key);
      return base;
    },
  },
  "text-to-image": {
    image:
      "ghcr.io/huggingface/api-inference-community:latent-to-image-sha-7c94b2a",
    description: "Diffusion-based image generation backend.",
    legacy: ["diffusers", "image-generation"],
    cmd: (args) => [
      "python3",
      "manage.py",
      "start",
      "--model-id",
      args.model,
      "--port",
      String(args.port),
      "--framework",
      "diffusers",
      "--task",
      "text-to-image",
    ],
  },
  "image-text-to-text": {
    image:
      "ghcr.io/huggingface/api-inference-community:latent-to-image-sha-7c94b2a",
    description: "Vision backend for OCR and captioning.",
    legacy: ["ocr"],
    cmd: (args) => [
      "python3",
      "manage.py",
      "start",
      "--model-id",
      args.model,
      "--port",
      String(args.port),
      "--framework",
      "transformers",
      "--task",
      "image-to-text",
    ],
  },
  "speech-to-text": {
    image:
      "ghcr.io/huggingface/api-inference-community:latent-to-image-sha-7c94b2a",
    description: "Automatic Speech Recognition backend.",
    legacy: ["audio"],
    cmd: (args) => [
      "python3",
      "manage.py",
      "start",
      "--model-id",
      args.model,
      "--port",
      String(args.port),
      "--framework",
      "transformers",
      "--task",
      "automatic-speech-recognition",
    ],
  },
  "text-to-speech": {
    image: "ghcr.io/huggingface/api-inference-community:latest",
    description: "Text-to-Speech backend.",
    legacy: ["audio"],
    cmd: (args) => [
      "python3",
      "manage.py",
      "start",
      "--model-id",
      args.model,
      "--port",
      String(args.port),
      "--framework",
      "transformers",
      "--task",
      "text-to-speech",
    ],
  },
  "generic-transformer": {
    image: "ghcr.io/huggingface/transformers-inference:0.9.4",
    description: "General-purpose inference container.",
    legacy: ["transformers-inference"],
    cmd: (args) => ["--model-id", args.model, "--port", String(args.port)],
  },
};
