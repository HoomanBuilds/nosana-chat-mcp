import { GpuMarketSlug, MarketInfo } from "./types";


export function extractDefination(
  requirements: string,
  models: { [slug: string]: any },
  markets: Record<GpuMarketSlug, MarketInfo>
) {
  const marketList = Object.entries(markets)
    .map(([slug, m]) => `- ${slug}: ${m.vram_gb}GB VRAM, $${m.estimated_price_usd_per_hour}/hr`)
    .join("\n");

  return `
You are a Nosana job definition generator. Output ONLY valid JSON — no markdown, no explanation.

Generate a Nosana job definition JSON based on the requirements below.

## Templates to use

### Ollama (DEFAULT for most LLM deployments):
{
  "ops": [{ "id": "<model-tag>", "type": "container/run", "args": {
    "gpu": true,
    "image": "docker.io/ollama/ollama:0.15.4",
    "expose": [{ "port": 11434, "health_checks": [{ "path": "/api/tags", "type": "http", "method": "GET", "continuous": false, "expected_status": 200 }] }],
    "resources": [{ "type": "Ollama", "model": "%%global.variables.MODEL%%" }]
  }}],
  "meta": { "trigger": "dashboard", "system_requirements": { "required_vram": <vram> } },
  "type": "container", "global": { "variables": { "MODEL": "<ollama-tag>" } }, "version": "0.1"
}

### vLLM (when user asks for vLLM, OpenAI-compatible API, or HuggingFace model):
{
  "ops": [{ "id": "<model-id>", "type": "container/run", "args": {
    "gpu": true,
    "image": "docker.io/vllm/vllm-openai:v0.10.2",
    "expose": 8000,
    "cmd": ["--model", "<hf-model-id>", "--served-model-name", "<hf-model-id>", "--port", "8000", "--max-model-len", "30000"]
  }}],
  "meta": { "trigger": "dashboard", "system_requirements": { "required_vram": <vram> } },
  "type": "container", "version": "0.1"
}

### Jupyter (for notebooks/interactive):
{
  "ops": [{ "id": "jupyter", "type": "container/run", "args": {
    "gpu": true,
    "image": "docker.io/nosana/pytorch-jupyter:2.0.0",
    "expose": 8888,
    "cmd": ["jupyter", "lab", "--ip=0.0.0.0", "--port=8888", "--no-browser", "--allow-root", "--ServerApp.token=''", "--ServerApp.password=''"]
  }}],
  "meta": { "trigger": "dashboard", "system_requirements": { "required_vram": 4 } },
  "type": "container", "version": "0.1"
}

## Rules
- Pick the right template based on requirements
- Set required_vram based on model size (7B fp16=14GB, 7B int4=5GB, 13B fp16=26GB, 70B int4=40GB)
- For Ollama: set MODEL to valid ollama tag (e.g. mistral:7b, llama3.1:8b, gemma3:4b-it-qat)
- For vLLM: set model to HuggingFace ID (e.g. mistralai/Mistral-7B-Instruct-v0.3)
- NEVER use "docker.io/hoomanhq/oneclickllm:ollama01"
- NEVER add env vars like ENABLE_STREAMING, GPU_MEMORY_UTILIZATION, TENSOR_PARALLEL_SIZE unless explicitly requested

## Available GPU Markets
${marketList}

## Requirements
${requirements}
`;
}



export function getResolvedPrompt(userQuery: string, model_families: string[]): string {
  return `
You are a **Model Query Interpreter**.

Read a fuzzy human query about AI models and output a structured JSON following this schema:
{
  input,
  families[],
  params: { op, value, strict? },
  tags[],
  quant,
  context,
  sort,
  gpuPreference,
  memoryUtilization,
  tensorParallelism
}

Rules:
- "input" → restate the user’s intent in full sentences, describing what they want and why.
- "families" → detect all relevant model families (case-insensitive fuzzy match; 1–4 max). Use only from this known list:
  ${model_families.join(" | ")}
- "params" → extract numeric size or range (e.g. ">=70e9" means 70B+). If not mentioned, leave null.
- "quant" → extract quantization type like "fp16", "q4_K_M", etc.
- "tags" → describe task type like "coder", "reasoning", "vision".
- "context" → extract context size if mentioned (e.g., "128K").
- "sort" → detect temporal or ranking intent:
    • If the user mentions "latest", "newest", "updated", or "recent", set "sort": "latest".
    • If the user mentions "popular", "most used", or "trending", set "sort": "popular".
    • Otherwise set null.
- "gpuPreference" → map words like:
    • "cheap", "budget" → "balance"
    • "medium", "normal" → "medium"
    • "high-end", "expensive", "A100", "H100" → "expensive"
  If none implied, set null.
- "memoryUtilization" → map words like:
    • "high performance", "max", "heavy" → "high"
    • "medium", "balanced" → "mid"
    • "lightweight", "small", "efficient" → "low"
  If not stated, set null.
- "tensorParallelism" → true if the user implies multi-GPU, distributed, or parallel execution; false if single GPU; otherwise null.
- If no model families are provided, infer them automatically based on the user’s intent. 
Analyze the request (e.g., “heavy”, “optimized”, “lightweight”) and choose 1–54 popular model families that best fit the requirement. 
For “heavy” or large-scale tasks, prefer families known for high-capacity models (e.g., Llama, Falcon, Yi, Mixtral). 
For “optimized” or efficiency-focused tasks, select families offering lighter or quantized models (e.g., Mistral, Gemma, Qwen, Phi). 
When uncertain, default to well-known, versatile families.
- if user dont specify then consider sort as latest most of time


Examples:
User: "deepseek 14B+ coder model"
→ {
  "input": "User is looking for a DeepSeek model for coding tasks with at least 14B parameters.",
  "families": ["deepseek-r1"],
  "params": { "op": ">=", "value": 14e9 },
  "tags": ["coder"],
  "sort" : "latest"
}

User: "qwen models heavy"
→ {
  "input": "User wants a large Qwen model for heavy reasoning or computation.",
  "families": ["qwen", "qwen2", "qwen3"],
  "params": { "op": ">=", "value": 8e9 },
  "memoryUtilization": "high",
  "sort" : "latest"
}

User: "run a 200B+ qwen on A100 GPUs"
→ {
  "input": "User wants a 200B+ parameter Qwen-family model running on A100 GPUs.",
  "families": ["qwen3", "qwen2.5", "qwen2", "qwen"],
  "params": { "op": ">=", "value": 200e9 },
  "gpuPreference": "expensive",
  "tensorParallelism": true,
  "sort" : "latest"
}

User: "use the latest qwen model"
→ {
  "input": "User wants the most recent Qwen-family model available.",
  "families": ["qwen3", "qwen2.5", "qwen2", "qwen"],
  "sort": "latest"
}

User query: "${userQuery}"
`;
}