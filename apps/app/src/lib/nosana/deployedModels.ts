const STORAGE_KEY = "nosanaDeployedModels";
const UPDATE_EVENT = "nosana-deployed-models-updated";
const MODEL_PREFIX = "nosana-deployed:";

export type DeployedChatModel = {
  id: string;
  value: string;
  label: string;
  baseURL: string;
  model: string;
  apiKey?: string;
  jobId: string;
  serviceUrl: string;
  createdAt: number;
};

function parseStored(value: string | null): DeployedChatModel[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeBaseUrl(serviceUrl: string, chatPath?: string): string {
  const root = serviceUrl.replace(/\/+$/, "");
  const path = (chatPath || "/v1/chat/completions").trim();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedPath.endsWith("/chat/completions")) {
    return `${root}${normalizedPath.replace(/\/chat\/completions$/, "")}`;
  }
  if (normalizedPath === "/v1") return `${root}/v1`;
  return `${root}/v1`;
}

function extractOllamaModelFromCmd(cmd: unknown): string | null {
  if (!Array.isArray(cmd)) return null;

  for (const part of cmd) {
    if (typeof part !== "string") continue;

    const pullMatch = part.match(/ollama\s+pull\s+([^\s;|&]+)/i);
    if (pullMatch?.[1]) return pullMatch[1];

    const runMatch = part.match(/ollama\s+run\s+([^\s;|&]+)/i);
    if (runMatch?.[1]) return runMatch[1];
  }

  return null;
}

function getEnvValue(env: unknown, key: string): string | null {
  if (!env) return null;

  if (typeof env === "object" && !Array.isArray(env)) {
    const obj = env as Record<string, unknown>;
    const value = obj[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  if (Array.isArray(env)) {
    for (const item of env) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const rowKey =
        (typeof row.key === "string" && row.key) ||
        (typeof row.name === "string" && row.name) ||
        "";
      if (rowKey !== key) continue;

      const rowValue = row.value;
      if (typeof rowValue === "string" && rowValue.trim()) {
        return rowValue.trim();
      }
    }
  }

  return null;
}

function getGlobalVar(jobDef: any, key: string): string | null {
  const variables = jobDef?.global?.variables;
  if (!variables || typeof variables !== "object") return null;

  const value = (variables as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveTemplateGlobalVar(value: string, jobDef: any): string {
  const match = value.match(/^%%global\.variables\.([A-Za-z0-9_]+)%%$/);
  if (!match) return value;

  const resolved = getGlobalVar(jobDef, match[1]);
  return resolved || value;
}

function extractModelFromResources(jobDef: any): string | null {
  const resources = jobDef?.ops?.[0]?.args?.resources;
  if (!Array.isArray(resources)) return null;

  for (const resource of resources) {
    if (!resource || typeof resource !== "object") continue;
    const candidate = (resource as Record<string, unknown>).model;
    if (typeof candidate !== "string" || !candidate.trim()) continue;

    return resolveTemplateGlobalVar(candidate.trim(), jobDef);
  }

  return null;
}

function extractModelName(jobDef: any): string {
  const cmd = jobDef?.ops?.[0]?.args?.cmd;
  if (Array.isArray(cmd)) {
    const servedIdx = cmd.indexOf("--served-model-name");
    if (servedIdx >= 0 && cmd[servedIdx + 1]) return String(cmd[servedIdx + 1]);

    const modelIdx = cmd.indexOf("--model");
    if (modelIdx >= 0 && cmd[modelIdx + 1]) return String(cmd[modelIdx + 1]);

    const ollamaModel = extractOllamaModelFromCmd(cmd);
    if (ollamaModel) return ollamaModel;
  }

  const env = jobDef?.ops?.[0]?.args?.env;
  for (const key of ["MODEL", "SERVED_MODEL_NAME", "MODEL_NAME", "MODEL_ID"]) {
    const envValue = getEnvValue(env, key);
    if (envValue) return resolveTemplateGlobalVar(envValue, jobDef);
  }

  const modelFromResources = extractModelFromResources(jobDef);
  if (modelFromResources) return modelFromResources;

  for (const key of ["MODEL", "SERVED_MODEL_NAME", "MODEL_NAME", "MODEL_ID"]) {
    const globalValue = getGlobalVar(jobDef, key);
    if (globalValue) return globalValue;
  }

  return "local-model";
}

export function inferModelNameFromJobDef(jobDef: any): string | null {
  const model = extractModelName(jobDef);
  if (!model || model === "local-model") return null;
  return model;
}

function isLikelyChatDeployment(jobDef: any, chatPath?: string): boolean {
  if (chatPath?.includes("/v1/chat/completions")) return true;

  const image = String(jobDef?.ops?.[0]?.args?.image || "").toLowerCase();
  if (
    image.includes("vllm-openai") ||
    image.includes("oneclickllm") ||
    image.includes("ollama")
  ) {
    return true;
  }

  const env = jobDef?.ops?.[0]?.args?.env;
  if (env && typeof env === "object") {
    if (typeof env.MODEL === "string") return true;
    if (typeof env.SERVED_MODEL_NAME === "string") return true;
    if (typeof env.MODEL_NAME === "string") return true;
  }

  return false;
}

function extractApiKey(jobDef: any): string | undefined {
  const env = jobDef?.ops?.[0]?.args?.env;
  if (!env || typeof env !== "object") return undefined;

  return (
    (typeof env.API_KEY === "string" && env.API_KEY) ||
    (typeof env.OPENAI_API_KEY === "string" && env.OPENAI_API_KEY) ||
    undefined
  );
}

function extractChatPath(jobDef: any): string | undefined {
  const expose = jobDef?.ops?.[0]?.args?.expose;
  if (!Array.isArray(expose) || expose.length === 0) return undefined;

  const checks = expose[0]?.health_checks;
  if (Array.isArray(checks) && checks.length > 0 && checks[0]?.path) {
    return String(checks[0].path);
  }
  return undefined;
}

function emitUpdated() {
  window.dispatchEvent(new Event(UPDATE_EVENT));
}

export function getDeployedChatModels(): DeployedChatModel[] {
  if (typeof window === "undefined") return [];
  return parseStored(localStorage.getItem(STORAGE_KEY)).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

export function getDeployedChatModelByValue(
  value: string,
): DeployedChatModel | undefined {
  return getDeployedChatModels().find((m) => m.value === value);
}

export function isDeployedChatModel(value: string): boolean {
  return value.startsWith(MODEL_PREFIX);
}

export function onDeployedModelsUpdated(handler: () => void): () => void {
  window.addEventListener(UPDATE_EVENT, handler);
  return () => window.removeEventListener(UPDATE_EVENT, handler);
}

export function saveDeployedChatModelFromJob(args: {
  jobId: string;
  serviceUrl: string;
  jobDef: any;
}): DeployedChatModel | null {
  const { jobId, serviceUrl, jobDef } = args;
  const model = inferModelNameFromJobDef(jobDef) || "local-model";
  const chatPath = extractChatPath(jobDef);
  if (!isLikelyChatDeployment(jobDef, chatPath)) return null;
  const baseURL = normalizeBaseUrl(serviceUrl, chatPath);
  const apiKey = extractApiKey(jobDef);

  const item: DeployedChatModel = {
    id: `${MODEL_PREFIX}${jobId}`,
    value: `${MODEL_PREFIX}${jobId}`,
    label: `${model} (Nosana)`,
    baseURL,
    model,
    apiKey,
    jobId,
    serviceUrl,
    createdAt: Date.now(),
  };

  const existing = getDeployedChatModels().filter((m) => m.jobId !== jobId);
  const next = [item, ...existing].slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitUpdated();
  return item;
}
