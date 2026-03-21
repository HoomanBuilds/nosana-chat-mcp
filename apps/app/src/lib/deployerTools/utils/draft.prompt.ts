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