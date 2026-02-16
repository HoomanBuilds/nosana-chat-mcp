import { z } from "zod";

const EnvKVSchema = z
  .array(
    z.object({
      key: z.string(),
      value: z.string(),
    }),
  )
  .default([]);

export const pipeline = z.enum([
  "text-generation",
  "feature-extraction",
  "text-to-image",
  "image-to-image",
  "speech-to-text",
  "text-to-speech",
  "audio-classification",
  "image-classification",
  "image-text-to-text",
  "generic-transformer",
]);

export type Pipeline = z.infer<typeof pipeline>;

export const DecisionSchema = z.object({
  providerName: z
    .enum(["huggingface", "container"])
    .describe(
      "container used when user want to host container with env , cmd etc",
    ),

  category: pipeline.describe(
    "Functional category of the resource: text, image, or general transformer inference.",
  ),

  modelName: z
    .string()
    .describe(
      "Full canonical identifier, e.g., 'Qwen/Qwen2-72B-Instruct' or 'org/repo:tag'.",
    ),

  entrypoint: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe(
      "entrypoint of container , must be there when provider name is container",
    ),
  commands: z
    .array(z.string())
    .optional()
    .describe("commands to execute in container"),
  image: z
    .string()
    .describe(
      "Container image name org/repo:tag , only when provider name is container",
    )
    .optional(),

  params: z
    .string()
    .describe(
      "Model size or configuration tag, e.g., '7B', '40B', '72B', 'base', 'quantized'.",
    ),

  gpu: z
    .boolean()
    .default(true)
    .describe("only for gpu only workloads , otherwise false"),

  vRAM_required: z
    .number()
    .min(0)
    .default(0)
    .describe(
      "Minimum GPU VRAM required in GB. Optional for CPU-only workloads.",
    ),

  env: EnvKVSchema.optional(),

  apiKey: z
    .string()
    .optional()
    .describe("api key to control model access , Bearer token basically"),
  huggingFaceToken: z
    .string()
    .optional()
    .describe("hugging face token to access gated/private models"),

  notes: z
    .string()
    .default("")
    .describe(
      "Additional information — quantization, tuning details, runtime hints, etc.",
    ),

  exposedPorts: z.number().default(8000),

  otherExtra: z
    .object({
      id: z
        .string()
        .optional()
        .describe(
          "recommnded to suggest that , the jobDefination name you want to give? as its id",
        ),
      version: z
        .string()
        .optional()
        .default("0.1")
        .describe("keep default until don't ask for"),
      trigger: z
        .enum(["cli", "dashboard"])
        .optional()
        .default("cli")
        .describe("hugging face model generally have cli trigger"),
      Description: z.string().optional(),
      work_dir: z
        .string()
        .optional()
        .describe(
          "based on containerr or user requirement consider this otherwise no need to touch this",
        ),
    })
    .describe(
      "All fields are only included when the user explicitly wants to modify them; otherwise, they are omitted.",
    ),

  resources: z
    .array(
      z.object({
        type: z.literal("S3"),
        url: z.string().describe("object remote resource URL"),
        target: z.string().describe("target path in container"),
      }),
    )
    .optional()
    .default([]),
});

export type TResult = z.infer<typeof DecisionSchema>;

export const ContainerExecutionTemplate = z.object({
  type: z.literal("container"),
  version: z.string().default("0.1"),

  ops: z.array(
    z.object({
      id: z.string().describe("Unique operation identifier"),
      type: z.literal("container/run"),

      args: z.object({
        cmd: z
          .union([z.string(), z.array(z.union([z.string(), z.any()]))])
          .optional(),
        gpu: z.boolean().default(true),
        work_dir: z.string().optional(),
        image: z.string().describe("Container image name or tag"),
        entrypoint: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .nullable(),
        expose: z.number().optional().describe("Port to expose publicly"),
        env: z
          .record(z.string(), z.string())
          .optional()
          .describe("Environment variables"),
        required_vram: z.number().optional(),
        resources: z
          .array(
            z
              .object({
                url: z.string().url(),
                type: z.enum(["S3"]),
                target: z.string(),
              })
              .or(z.any()),
          )
          .optional(),
      }),
    }),
  ),

  meta: z
    .object({
      trigger: z.enum(["dashboard", "cli"]).default("cli"),
      system_requirements: z.object({
        required_vram: z
          .number()
          .describe("Minimum VRAM required (in GB)")
          .optional()
          .default(8),
      }),
      description: z.string().optional(),
      timeout: z
        .number()
        .describe(
          "time in seconds for which market will run ,consider default 3600 sec",
        ),
    })
    .optional(),
});

export type ContainerExecutionTemplate = z.infer<
  typeof ContainerExecutionTemplate
>;

export const suggest_model_market_schema = z.object({
  model: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "Make sure you only and only recommend hugging face model with full name *org/modelName*",
          ),
        reason: z
          .string()
          .describe("why this model fits the given requirements"),
        recommandation_score: z
          .number()
          .min(0)
          .max(10)
          .default(0)
          .describe("its totally comparative score between selected models"),
      }),
    )
    .min(1)
    .max(5),

  market: z
    .array(
      z.object({
        name: z
          .string()
          .describe("market name or slug (e.g., vastai, tensor.market)"),
        reason: z
          .string()
          .describe("reason for recommending this market or GPU"),
        price: z.string().describe("estimated cost per hour in USD"),
        address: z
          .string()
          .describe("public key or market identifier (e.g., Solana address)"),
        recommandation_score: z
          .number()
          .min(0)
          .max(10)
          .default(0)
          .describe("its totally comparative score between selected markets"),
      }),
    )
    .min(1)
    .max(6),
});

export const ModelQuerySchema = z.object({
  input: z.string().describe("Verbose restatement of the user's query."),
  families: z
    .array(z.string())
    .describe("List of relevant model families, chosen from known families.")
    .default([]),

  params: z
    .object({
      op: z.enum(["<", "<=", ">", ">=", "="]).default("="),
      value: z.number().nullable().default(null),
      strict: z.boolean().optional().default(false),
    })
    .nullable()
    .describe("Numeric parameter constraint, like model size in params."),

  tags: z
    .array(z.string())
    .describe("Purpose-related tags such as 'coder', 'vision', 'reasoning'.")
    .default([]),

  quant: z
    .string()
    .nullable()
    .describe("Quantization type such as 'fp16' or 'q4_K_M'.")
    .default(null),

  context: z
    .string()
    .nullable()
    .describe("Model context length if mentioned, e.g. '128K'.")
    .default(null),

  sort: z
    .enum(["latest", "popular"])
    .nullable()
    .describe("User preference for newest or popular models.")
    .default(null),

  gpuPreference: z
    .enum(["balance", "medium", "expensive"])
    .nullable()
    .describe("GPU cost class preference inferred from query.")
    .default(null),

  memoryUtilization: z
    .enum(["high", "mid", "low"])
    .nullable()
    .describe("Preferred memory load level.")
    .default(null),

  tensorParallelism: z
    .boolean()
    .nullable()
    .describe("Whether user implied multi-GPU or parallel execution.")
    .default(null),
});

export type ModelQuery = z.infer<typeof ModelQuerySchema>;
