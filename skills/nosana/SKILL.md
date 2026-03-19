---
name: nosana
description: Enables AI agents to interact with Nosana's decentralized GPU computing platform. Use this skill when users want to deploy AI models, manage GPU jobs, check wallet/credit balances, or query GPU market information. Supports both wallet-based (on-chain) and API key (credits) authentication modes.
---

# Nosana Skill

This skill enables AI agents to interact with Nosana, a decentralized GPU computing platform for running AI inference workloads.

## When to Use This Skill

Use this skill when the user:

- Wants to deploy AI models (LLMs, image generation, etc.) on decentralized GPU infrastructure
- Asks about running inference jobs on Nosana
- Needs to check wallet balance (SOL/NOS) or credit balance
- Wants to manage existing jobs (stop, extend runtime, check status)
- Asks about GPU market pricing or availability
- Needs model recommendations for specific use cases
- Wants to estimate job costs before deploying

## What is Nosana?

Nosana is a decentralized GPU network that allows anyone to rent GPU compute for AI inference. Key concepts:

- **GPU Markets**: Different GPU providers (NVIDIA A100, H100, etc.) with varying prices and availability
- **Jobs**: Containerized AI inference workloads deployed to the Nosana network
- **Two Auth Modes**:
  - **Wallet Mode**: Connect Solana wallet for on-chain payments (SOL + NOS tokens)
  - **API Key Mode**: Use Nosana API keys for credit-based payments

## Available Tools

### Job Management

| Tool               | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `createJob`        | Deploy a new AI inference job on Nosana                |
| `stopJob`          | Stop a running job before timeout                      |
| `extendJobRuntime` | Extend a job's runtime (max 24 hours additional)       |
| `getJob`           | Get detailed information about a specific job          |
| `getAllJobs`       | List all jobs for a user (with optional status filter) |

### Wallet & Credits

| Tool               | Description                                  |
| ------------------ | -------------------------------------------- |
| `getWalletBalance` | Get SOL and NOS token balances (wallet mode) |
| `getCreditBalance` | Get available credits (API key mode)         |

### Market & Pricing

| Tool                   | Description                                   |
| ---------------------- | --------------------------------------------- |
| `listGpuMarkets`       | List all available GPU markets with prices    |
| `getMarket`            | Get detailed info about a specific GPU market |
| `estimateJobCost`      | Estimate cost for running a job               |
| `suggest_model_market` | AI-powered model and market recommendations   |

### Model Discovery

| Tool                  | Description                        |
| --------------------- | ---------------------------------- |
| `getModels`           | Search HuggingFace models          |
| `getModels_from_tags` | Search models by organization/tags |

## Authentication Modes

### Wallet Mode (On-Chain)

When user connects a Solana wallet:

- Use wallet-based tools
- Payments made in SOL (gas) + NOS (compute)
- Requires SOL for transaction fees and NOS for job payment
- Tools require `userPublicKey` parameter

### API Key Mode (Credits)

When user provides a Nosana API key:

- Use API key-based tools
- Payments deducted from prepaid credits
- Simpler for teams and automated workflows
- Tools use Bearer token authentication

## Creating a Job

### Basic Flow

1. **Get user requirements**: Model name, GPU needs, runtime, any special configurations
2. **Check wallet/credits**: Verify sufficient balance before proceeding
3. **List GPU markets**: Find available markets (`listGpuMarkets`) if user doesn't specify
4. **Estimate cost**: Use `estimateJobCost` to show pricing
5. **Create job**: Use `createJob` with model + requirements
6. **Confirm with user**: Show job details and cost before execution

### Job Creation Parameters

```
createJob({
  model: "meta-llama/Llama-3.1-8B-Instruct",  // HuggingFace model ID
  market: "nvidia-h100",                       // GPU market slug
  requirements: "port: 8000, env: {API_KEY}",  // Additional config
  timeoutSeconds: 3600,                        // Runtime (600s - 7 days)
  userPublicKey: "..."                          // Wallet address (wallet mode)
})
```

### Direct Job Definition

For advanced users who provide complete job JSON:

```
createJob({
  directJobDef: { /* complete Nosana job definition */ },
  timeoutSeconds: 3600,
  userPublicKey: "..."
})
```

### Supported Providers

- **HuggingFace**: Use model ID directly (e.g., `meta-llama/Llama-3.1-8B-Instruct`)
- **Custom Container**: Provide container image URL and configuration

## Managing Jobs

### Check Job Status

```bash
getJob({ jobId: "..." })
getAllJobs({ userPubKey: "...", state: "RUNNING" })
```

### Stop a Job

```bash
stopJob({ jobId: "...", job_owners_pubKey: "..." })
```

### Extend Runtime

```bash
extendJobRuntime({
  jobId: "...",
  extensionSeconds: 3600,  // Max 24 hours
  job_owners_pubKey: "..."
})
```

## VRAM Requirements by Model Size

Use this to pick the right market without asking the user:

| Parameters | Precision | VRAM needed | Recommended Market       |
| ---------- | --------- | ----------- | ------------------------ |
| 1–3B       | fp16      | 4–6 GB      | nvidia-rtx-4090          |
| 7–8B       | fp16      | 14–16 GB    | nvidia-rtx-4090          |
| 7–8B       | int4/GGUF | 5–6 GB      | nvidia-rtx-4090          |
| 13B        | fp16      | 26 GB       | nvidia-rtx-4090 (tight)  |
| 13B        | int4      | 8–10 GB     | nvidia-rtx-4090          |
| 30–34B     | fp16      | 60–70 GB    | nvidia-a100-80gb         |
| 30–34B     | int4      | 18–20 GB    | nvidia-rtx-4090          |
| 70B        | fp16      | 140 GB      | 2× nvidia-a100-80gb      |
| 70B        | int4      | 35–40 GB    | nvidia-a100-40gb         |
| 72B        | int4      | 40 GB       | nvidia-a100-40gb         |

**Rules:**
- Default to fp16 unless user says "quantized", "GGUF", "int4", or "fast/cheap"
- If model name contains `:4b`, `:8b`, `:14b` etc. (Ollama tag) use that as parameter count
- If unsure, run `suggest_model_market` first



### Available Markets

| Market           | VRAM | Best For                 |
| ---------------- | ---- | ------------------------ |
| nvidia-h100      | 80GB | Large models, production |
| nvidia-a100-80gb | 80GB | Large models             |
| nvidia-a100-40gb | 40GB | Medium models            |
| nvidia-rtx-4090  | 24GB | Small models, testing    |
| nvidia-rtx-3090  | 24GB | Small models, testing    |

### Selecting a Market

1. **Check model requirements**: Larger models need more VRAM
2. **Use `suggest_model_market`**: Get AI recommendations
3. **Consider quantization**: INT4/INT8 can reduce VRAM needs
4. **Check pricing**: Markets have different rates

## Cost Estimation

### Using estimateJobCost

```
estimateJobCost({
  gpuMarket: "nvidia-h100",
  durationSeconds: 3600  // 1 hour
})
```

Returns:

- NOS token cost
- USD equivalent
- SOL gas fee
- Network fees

### Tips for Cost Optimization

1. **Use shorter timeouts**: Only pay for what you need
2. **Quantize models**: INT4 uses ~75% less VRAM
3. **Choose appropriate markets**: RTX 4090 is cheaper for small models
4. **Batch requests**: Combine multiple inferences

## Troubleshooting

### "Insufficient balance"

- **Wallet mode**: User needs more SOL (for gas) and NOS (for compute)
- **API key mode**: User needs to add credits at https://deploy.nosana.com

### "No compatible market found"

- Model requires more VRAM than available
- Solutions: Use quantization, try smaller model, use external API

### "Model not found"

- Check HuggingFace model ID format: `org/model-name`
- Verify model is public (not private/gated)

### "Job validation failed"

- Job definition has invalid fields
- Check required fields: type, ops, meta

## Common User Requests

### "Deploy Llama 3.1"

1. Run `createJob` with model: `meta-llama/Llama-3.1-8B-Instruct`
2. Select appropriate market (needs ~16GB VRAM)
3. Estimate cost and confirm with user

### "Check my balance"

- Wallet mode: `getWalletBalance({ userPublicKey: "..." })`
- API key mode: `getCreditBalance()`

### "Stop my running job"

1. Get job ID from `getAllJobs`
2. Run `stopJob({ jobId: "...", job_owners_pubKey: "..." })`

### "How much to run for 2 hours?"

1. Run `estimateJobCost({ gpuMarket: "...", durationSeconds: 7200 })`
2. Present cost breakdown to user

### "Suggest a model for image generation"

1. Run `suggest_model_market({ requirements: "image generation | stable diffusion" })`
2. Present recommended models and markets

## Useful Links

- **Dashboard**: https://deploy.nosana.com
- **Documentation**: https://docs.nosana.io
- **Discord**: https://discord.gg/nosana
- **NOS Token**: https://solscan.io/token/...

## Important Notes

1. **Always confirm costs** with user before creating jobs
2. **Show job definition** to user for verification
3. **Check balance first** to avoid failed transactions
4. **Use appropriate market** based on model VRAM requirements
5. **Handle errors gracefully** - explain what went wrong and suggest solutions
6. **Default timeout is 1 hour** - extend if needed but explain costs

## Choosing the Right Deployment Template

Follow this decision tree when a user asks to deploy a model:

```
User wants to deploy a model
│
├── Is it a Jupyter/notebook/interactive session?
│   └── YES → Use PyTorch Jupyter template
│
├── Does the user say "Ollama" or want a chat UI / simple API?
│   └── YES → Use Ollama template, set MODEL to ollama tag (e.g. llama3.2:3b)
│
├── Does the user want OpenAI-compatible API / vLLM / production inference?
│   └── YES → Use vLLM template, set MODEL to HuggingFace ID
│
└── Does the user provide a raw job JSON?
    └── YES → Use directJobDef, do not modify unless asked
```

**Ollama model tag format:** `<name>:<size>` e.g. `llama3.2:3b`, `gemma3:4b-it-qat`, `mistral:7b`
**vLLM model format:** HuggingFace ID e.g. `meta-llama/Llama-3.1-8B-Instruct`

When using Ollama template, always add health check on `/api/tags`.
When using vLLM template, expose port `8000` and add `--max-model-len` based on available VRAM.



Use these as reference when constructing job definitions.

### PyTorch Jupyter Lab

```json
{
  "ops": [
    {
      "id": "Pytorch",
      "args": {
        "cmd": [
          "jupyter", "lab",
          "--ip=0.0.0.0", "--port=8888",
          "--no-browser", "--allow-root",
          "--ServerApp.token=''", "--ServerApp.password=''"
        ],
        "gpu": true,
        "image": "docker.io/nosana/pytorch-jupyter:2.0.0",
        "expose": 8888
      },
      "type": "container/run"
    }
  ],
  "meta": { "trigger": "dashboard", "system_requirements": { "required_vram": 4 } },
  "type": "container",
  "version": "0.1"
}
```

### Ollama Model (e.g. Gemma3-4b)

```json
{
  "ops": [
    {
      "id": "Gemma3-4b",
      "args": {
        "gpu": true,
        "image": "docker.io/ollama/ollama:0.15.4",
        "expose": [
          {
            "port": 11434,
            "health_checks": [
              { "path": "/api/tags", "type": "http", "method": "GET", "continuous": false, "expected_status": 200 }
            ]
          }
        ],
        "resources": [{ "type": "Ollama", "model": "%%global.variables.MODEL%%" }]
      },
      "type": "container/run"
    }
  ],
  "meta": { "trigger": "dashboard", "system_requirements": { "required_vram": 5 } },
  "type": "container",
  "global": { "variables": { "MODEL": "gemma3:4b-it-qat" } },
  "version": "0.1"
}
```

Replace `MODEL` and `required_vram` based on the target model. Use this template for any Ollama-compatible model.

### vLLM OpenAI-compatible Server (e.g. Nanonets-OCR2:3B)

```json
{
  "ops": [
    {
      "id": "vllm-model",
      "args": {
        "cmd": [
          "--model", "%%global.variables.MODEL%%",
          "--served-model-name", "%%global.variables.MODEL%%",
          "--port", "8000",
          "--max-model-len", "30000"
        ],
        "gpu": true,
        "image": "docker.io/vllm/vllm-openai:v0.10.2",
        "expose": 8000
      },
      "type": "container/run"
    }
  ],
  "meta": { "trigger": "dashboard", "system_requirements": { "required_vram": 8 } },
  "type": "container",
  "global": { "variables": { "MODEL": "nanonets/Nanonets-OCR2-3B" } },
  "version": "0.1"
}
```

Replace `MODEL` with the HuggingFace model ID and adjust `required_vram` accordingly. Use this template for any vLLM/OpenAI-compatible model deployment.

---

## Job Definition Generator Rules

When `createJob` is called with `model` + `requirements`, an internal resolver converts them into a Nosana job definition JSON. The following rules govern that conversion.

### Provider Selection

- User mentions Docker image / container name → `providerName = "container"`
- User gives a HuggingFace model ID or just says "run model X" → `providerName = "huggingface"`
- User mentions vLLM, TGI, or Ollama image explicitly → `providerName = "container"`
- HuggingFace inference image (e.g. `ghcr.io/huggingface/text-generation-inference`) → `providerName = "huggingface"`
- Custom app (FastAPI, Jupyter, etc.) → `providerName = "container"`

### Image Selection (CRITICAL)

- Ollama (recommended for self-hosted text-gen): `docker.io/ollama/ollama:0.15.4`
- vLLM (OpenAI-compatible API): `docker.io/vllm/vllm-openai:v0.10.2`
- Jupyter: `docker.io/nosana/pytorch-jupyter:2.0.0`
- TGI: `ghcr.io/huggingface/text-generation-inference:1.4`
- **NEVER** use `docker.io/hoomanhq/oneclickllm:ollama01` — deprecated
- **NEVER** generate placeholder images like `user/model:latest`

For `huggingface` provider: omit `image`, `entrypoint`, `commands` — platform selects automatically.

### GPU & VRAM

- `gpu=true` only if image/model uses GPU (vLLM, TGI, Ollama, SDXL)
- `required_vram = 0` when `gpu=false`
- Approx VRAM = (model_size_B × 2) + 2 GB
- Non-ML containers (n8n, Jupyter, APIs) → CPU-only

### Environment Variables

- `env` must be an array: `[{"key":"KEY","value":"VALUE"}]`
- Always include user-specified keys
- Required for LLMs: `PARAMETER_SIZE`, `MAX_MODEL_LEN` (default `"8192"`), `MODEL_ID` (container only)
- Optional (only if explicitly requested): `ENABLE_STREAMING`, `QUANTIZATION`, `GPU_MEMORY_UTILIZATION`, `DTYPE`, `TENSOR_PARALLEL_SIZE`
- Never use placeholder values: `"NAN"`, `"unknown"`, `"false"`, `"0"`, `"0.9"`

### Ollama Template Rules

- image: `docker.io/ollama/ollama:0.15.4`
- expose: port `11434` with health check on `/api/tags`
- resources: `[{ type: "Ollama", model: "<ollama-tag>" }]`
- Ollama tag format: `<name>:<size>` e.g. `llama3.2:3b`, `gemma3:4b-it-qat`, `mistral:7b`

### vLLM Template Rules

- image: `docker.io/vllm/vllm-openai:v0.10.2`
- cmd: `["--model", "<hf-id>", "--served-model-name", "<hf-id>", "--port", "8000", "--max-model-len", "30000"]`
- expose: `8000`

### Output Schema (what the resolver must produce)

```json
{
  "providerName": "huggingface | container",
  "category": "text-generation | text-to-image | development-environment | generic-transformer",
  "modelName": "org/model-name",
  "params": "7B",
  "gpu": true,
  "vRAM_required": 16,
  "image": "(container only)",
  "entrypoint": "(container only)",
  "commands": ["(container only)"],
  "exposedPorts": 8080,
  "env": [{ "key": "KEY", "value": "VALUE" }],
  "resources": [{ "type": "url", "url": "...", "target": "/path" }],
  "apiKey": "(optional)",
  "huggingFaceToken": "(optional)",
  "notes": "...",
  "otherExtra": { "id": "...", "Description": "..." }
}
```

### Model Market Recommendation Rules

When `suggest_model_market` is called, evaluate:
- Model size vs available VRAM per market
- Price efficiency (cheaper for small models)
- Task fit (chat, coding, image generation, etc.)
- Prefer open-source, non-gated HuggingFace models
- Always return full HuggingFace model ID: `org/model-name`
- Include `recommendation_score` (1–10) for each suggestion

### General Constraints

- Output must be production-ready — no mock configs, no placeholders
- If provider is `container`: must set `image`, `entrypoint`, `commands`, `exposedPorts`, `env`
- If provider is `huggingface`: omit all container fields
- Never invent fake URLs or commands
- Preserve all existing fields on updates — only modify what the user explicitly changed
- Default timeout: 1 hour (3600s) unless user specifies otherwise
