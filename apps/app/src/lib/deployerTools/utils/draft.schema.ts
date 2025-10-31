import { z } from "zod";

const ResourceSchema = z.object({
  type: z.string().describe("Type of external resource, e.g., 'HF' or 'Git'."),
  repo: z.string().describe("Repository name or model identifier, e.g., 'mosaicml/mpt-30b'."),
  target: z.string().describe("Filesystem path where the resource should be mounted."),
});

export const EnvVarSchema = z.object({
  key: z.string().describe("Environment variable name, e.g., 'API_KEY' or 'MODEL_NAME'."),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.null()])
    .optional()
    .describe("Environment variable value; may be string, number, boolean, or null."),
});

export const ContainerSchema = z.object({
  type: z.literal("container"),
  modelName: z.string().describe("Name of the ML model being served or executed."),
  image: z.string().describe("Docker image name, e.g., 'hoomanhq/oneclickllm:prodversion1'."),
  command: z.array(z.string()).optional().describe("List of shell commands to execute in container."),
  entrypoint: z.array(z.string()).optional().describe("Container entrypoint command, if required."),
  work_dir: z.string().optional().describe("Working directory inside the container."),
  env: z.array(EnvVarSchema).optional().describe("List of environment variables (key/value pairs)."),
  exposePort: z.number().optional().default(8000),
  gpu: z.boolean().optional().default(false).describe("Whether GPU access is required for this job."),
//   volumes: z.array(z.string()).optional().describe("List of volume mount paths."),
  notes: z.string().optional().describe("Optional notes or metadata about the container job."),
  resources: z.array(ResourceSchema).optional().describe("Additional resources required for the job."),
  parameterSize: z.string().optional().describe("Parameter size of the model, e.g., '13B'."),
  vRAM_required: z
    .number()
    .min(1)
    .max(2048)
    .optional()
    .describe("VRAM requirement in GB; valid range is 1–2048."),
  category: z.string().optional().describe("Category of the model, e.g., 'LLM', 'Vision', 'ASR'."),
  otherExtra: z
    .object({
      Description: z.string().optional().describe("Detailed description of the job or model."),
    })
    .optional()
    .describe("Additional optional fields for descriptive metadata."),
});

export const TemplateSchema = z.object({
  type: z.literal("template"),
  modelName: z.string().describe("Template name or associated model."),
  image: z.null().optional().describe("Template-level image (typically null, provided at runtime)."),
  command: z.null().optional(),
  env: z.array(EnvVarSchema).optional(),
  exposePort: z.number().optional().default(8000),
  gpu: z.boolean().optional().default(false).describe("Indicates if GPU is required for the template."),
  notes: z.string().optional().describe("Freeform text describing the template purpose."),
  resources: z.array(ResourceSchema).optional().describe("Static resources used by this template."),
  parameterSize: z.string().optional().describe("Estimated model size, e.g., '70B'."),
  vRAM_required: z
    .number()
    .min(1)
    .max(2048)
    .optional()
    .describe("VRAM required in GB; must be between 1–2048."),
  category: z.string().optional().describe("Model or job category.- text-generation etc."),
  otherExtra: z
    .object({
      Description: z.string().optional().describe("Detailed description of the template job."),
    })
    .optional()
    .describe("Extra metadata container for flexible description fields."),
});

export const JobDefinitionSchema = z
  .union([ContainerSchema, TemplateSchema])
  .describe("Unified schema for both container and template job definitions.");

export type ExtractedJobDefinition = z.infer<typeof JobDefinitionSchema>;
