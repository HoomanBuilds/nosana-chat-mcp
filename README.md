# [Nosana Chat MCP](https://nosanachat.inferia.ai/ask?tool=deployer): chat and deploy anything on Nosana using natural language.

### [Watch the video](https://vimeo.com/1132617956)

<br>

<img width="3452" height="1996" alt="image" src="https://github.com/user-attachments/assets/293094c0-bbd2-4e16-92b7-91c93fc348fc" />

Nosana Chat is a unified AI platform that combines conversational AI capabilities with GPU deployment management. It enables users to interact with multiple language models and deploy AI workloads to decentralized infrastructure using natural language commands.

---

## Overview

Inferia Chat operates through two integrated modes:

- **Chat Mode** provides access to multiple language models including LLlaMA, Qwen3, and custom models through the [Inferia.ai](https://inferia.ai) platform. Users benefit from a streamlined chat interface with real-time responses, customizable model parameters, and web search integration.

- **Nosana Deployer** streamlines GPU deployment by converting natural language descriptions into optimized job configurations. Users can deploy AI models to decentralized infrastructure with one click, paying with NOS tokens on the Solana blockchain.

---

## DEMO VIDEO

## Features

### 1. Chat Mode

The Chat Mode provides a flexible conversational interface with the following capabilities:

- **Model Access**: Interact with multiple AI models including Google Gemini, Qwen3, and custom implementations powered by Inferia.ai.

- **Customizable Parameters**: Fine-tune model behavior through temperature control (randomness), max tokens (response length), nucleus sampling (Top P), and custom system prompts.

- **Web Search Integration**: Enable Tavily API to incorporate real-time web information into model responses.

- **Real-time Streaming**: Receive responses as they are generated for improved user experience.

- **Local Privacy**: All data is stored locally using IndexedDB, ensuring privacy and reducing server dependency.

### 2. Nosana Deployer

The Deployer mode simplifies GPU deployment through an intuitive workflow:

- **Natural Language Configuration**: Describe your deployment requirements in plain language or select from pre-built templates. The system automatically generates optimized Nosana job configurations.

- **One-Click Deployment**: Deploy configured jobs directly to the decentralized GPU network without manual setup.

- **Comprehensive Monitoring**: Track deployments using Job ID for identification, Service URL for model access, and Deployment ID for management reference.

- **Full SDK Integration**: Leverages complete Nosana SDK capabilities for advanced deployment control.

---

## Nosana Deployer MCP Tools

The Deployer mode includes **8 powerful Nosana MCP tools** for intelligent deployments:

| Tool                      | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| **create_job_defination** | Generate optimized Nosana job definitions from user prompts |
| **get_market**            | Fetch GPU market details, pricing, and queue status         |
| **list_gpu_markets**      | Discover available GPU markets with specifications          |
| **estimate_job_cost**     | Calculate precise job costs in multiple currencies          |
| **get_exact_value**       | Get exact SOL/NOS/USD pricing for any duration              |
| **get_job**               | Monitor deployed job status and details                     |
| **get_all_jobs**          | View all your Nosana deployments                            |
| **get_wallet_balance**    | Check SOL and NOS token balances                            |

### How It Works

**Chat Mode Example:**

> User: "I want to deploy Llama 2 on GPU for 1 hour"

```
AI will:
1. Analyze your requirements
2. Browse available GPU markets
3. Create optimized job definition
4. Estimate costs (SOL/NOS/USD)
5. Deploy with one click
6. Return: Job ID, Service URL, Deployment ID, Chat Interface link using inferia.ai
```

**One-Click Deployment:**
After the AI generates the deployment config, click "Deploy" to:

- Pay with your NOS tokens (small amount SOL required for transaction fees)
- Publish job to Nosana network
- Get instant Job ID & Service URL

---

## Architecture

```
inferia-chat/
├── apps/
│   ├── app/              # Next.js chat interface
│   └── nosana_mcp/       # Nosana MCP server with 7 deployment tools
└── packages/
    ├── ai/               # LLM integration & orchestration
    └── indexDb/          # Local storage layer
```

**Tech Stack:** Next.js 15 • TypeScript • Tailwind CSS • Zustand • Solana Web3.js • Nosana SDK

---

## Use Cases

Inferia Chat supports diverse AI deployment scenarios:

Deploy machine learning models to decentralized infrastructure without managing physical servers or data center resources. Run compute-intensive workloads such as batch processing, data analysis, or model training on demand. Test and prototype language model applications before production deployment. Provision temporary compute resources for game servers and other performance-critical applications. Deploy specialized AI models such as Stable Diffusion for image generation or other domain-specific implementations.

---

## Core Technologies

[Inferia.ai](https://inferia.ai) provides AI intelligence and model orchestration.

[Nosana](https://nosana.io) offers decentralized GPU infrastructure and resource management.

[Solana](https://solana.com) serves as the underlying blockchain for secure transactions.

[Next.js](https://nextjs.org) powers the frontend application framework.

[Shadcn/UI](https://ui.shadcn.com) provides the component library for user interface design.

---

**Deploy AI through natural language. No infrastructure management required.**
