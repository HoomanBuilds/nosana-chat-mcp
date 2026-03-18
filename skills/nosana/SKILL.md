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

## GPU Markets

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

## Job Definition Templates

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
