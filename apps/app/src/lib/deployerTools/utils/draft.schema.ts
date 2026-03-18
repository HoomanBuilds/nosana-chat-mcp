import { z } from "zod";

const ResourceSchema = z.object({
  type: z.string().describe("Type of external resource, e.g., 'HF' or 'Git'."),
  repo: z
    .string()
    .describe("Repository name or model identifier, e.g., 'mosaicml/mpt-30b'."),
  target: z
    .string()
    .describe("Filesystem path where the resource should be mounted."),
});

export const EnvVarSchema = z.object({
  key: z
    .string()
    .describe("Environment variable name, e.g., 'API_KEY' or 'MODEL_NAME'."),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.null()])
    .optional()
    .describe(
      "Environment variable value; may be string, number, boolean, or null.",
    ),
});

const envField = z
  .union([
    z.array(EnvVarSchema),
    z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).transform(
      (obj) => Object.entries(obj).map(([key, value]) => ({ key, value: value ?? null }))
    ),
  ])
  .optional()
  .describe("Environment variables as array or key-value object.");

export const ContainerSchema = z.object({
  type: z.string().default("container"),
  modelName: z.string().optional().default(""),
  image: z.string().nullable().optional(),
  command: z.union([z.array(z.string()), z.null()]).optional(),
  entrypoint: z.array(z.string()).optional(),
  work_dir: z.string().optional(),
  env: envField,
  exposePort: z.number().optional().default(8000),
  gpu: z.boolean().default(true),
  notes: z.string().optional(),
  resources: z.array(ResourceSchema).optional(),
  parameterSize: z.string().optional(),
  vRAM_required: z.number().min(1).max(2048).optional(),
  category: z.string().optional(),
  otherExtra: z.object({ Description: z.string().optional() }).optional(),
});

export const TemplateSchema = z.object({
  type: z.string().default("template"),
  modelName: z.string().optional().default(""),
  image: z.string().nullable().optional(),
  command: z.union([z.array(z.string()), z.null()]).optional(),
  env: envField,
  exposePort: z.number().optional().default(8000),
  gpu: z.boolean().default(true),
  notes: z.string().optional(),
  resources: z.array(ResourceSchema).optional(),
  parameterSize: z.string().optional(),
  vRAM_required: z.number().min(1).max(2048).optional(),
  category: z.string().optional(),
  otherExtra: z.object({ Description: z.string().optional() }).optional(),
});

export const JobDefinitionSchema = ContainerSchema
  .describe("Unified schema for both container and template job definitions.");

export type ExtractedJobDefinition = z.infer<typeof JobDefinitionSchema>;
