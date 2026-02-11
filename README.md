# [Nosana Chat MCP](https://nosanachat.inferia.ai/ask?tool=deployer): chat and deploy anything on Nosana using natural language.

### [Watch the video](https://vimeo.com/1132617956)

<br>

<img width="3452" height="1996" alt="image" src="https://github.com/user-attachments/assets/293094c0-bbd2-4e16-92b7-91c93fc348fc" />

Nosana Chat is a unified AI platform that combines conversational AI capabilities with GPU deployment management. It enables users to interact with multiple language models and deploy AI workloads to decentralized infrastructure using natural language commands.

---

## Overview

Nosana Chat operates through two integrated modes:

- **Chat Mode** provides access to multiple language models including DeepSeek, Llama, Qwen, and custom models through the [Inferia.ai](https://inferia.ai) platform. Users benefit from a streamlined chat interface with real-time streaming, reasoning (thinking) process, and web search integration.

- **Nosana Deployer** streamlines GPU deployment by converting natural language descriptions into optimized job configurations. Users can deploy AI models to decentralized infrastructure with one click, using either on-chain wallet transactions (SOL/NOS) or credits-based API keys.

---

## Features

### 1. Chat Mode

The Chat Mode provides a flexible conversational interface with the following capabilities:

- **Multi-Model Access**: Interact with various AI models including Google Gemini, Qwen3, DeepSeek, and Llama powered by Inferia.ai.
- **Reasoning Process**: Real-time visualization of the model's "thinking" process (reasoning) before delivering the final answer.
- **Web Search Integration**: Integrated Tavily API to incorporate real-time web information into model responses with source citations.
- **Local Privacy**: All conversations and settings are stored locally using IndexedDB, ensuring privacy and fast access.
- **Advanced Context Management**: Intelligent context cutting ensures long conversations remain efficient and within model token limits.

### 2. Nosana Deployer

The Deployer mode simplifies GPU deployment through an agentic workflow:

- **Dual Authentication**:
  - **Wallet Mode**: Deploy using Solana/Nosana tokens directly from your connected wallet.
  - **API Key Mode**: Use Nosana API keys (credits-based) for a seamless, transaction-free deployment experience.
- **Natural Language Configuration**: Describe your deployment requirements (e.g., "Deploy a Llama 3 instance for 2 hours") and the AI will handle the market selection and job definition.
- **One-Click Deployment**: Approve and deploy configured jobs directly from the chat interface.
- **Management Tools**: List, monitor, extend, or stop your deployments using simple commands.
- **Cost Estimation**: Get precise job costs in SOL, NOS, and USD before deploying.

---

## Nosana Deployer MCP Tools

The platform includes a suite of **powerful Nosana MCP tools** for intelligent deployments:

| Category        | Tools                                                                              | Purpose                                                          |
| --------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Deployment**  | `create_job`, `create_job_api`, `validate_job_definition`                          | Create, start, or validate Nosana jobs across different modes.   |
| **Monitoring**  | `get_job`, `get_all_jobs`, `list_jobs`, `get_job_api`                              | Track deployment status, details, and history.                   |
| **Market Info** | `list_gpu_markets`, `get_market`, `suggest_model_market`, `get_models_from_tags`   | Discover available GPUs, pricing, and get model recommendations. |
| **Financials**  | `estimate_job_cost`, `get_exact_value`, `get_wallet_balance`, `get_credit_balance` | Calculate costs and check balances (Wallet/Credits).             |
| **Operations**  | `stop_job`, `stop_job_api`, `extend_job_runtime`                                   | Manage active deployments by stopping or extending them.         |

---

### How It Works

**Deployment Example:**

> User: "I want to deploy DeepSeek R1 on a GPU for 1 hour"

```
AI will:
1. Analyze requirements & suggest the best GPU market
2. Check your wallet or credit balance
3. Create an optimized job definition
4. Provide a cost estimate (USD/NOS/SOL)
5. Generate a "Deploy" button for one-click execution
6. Return: Job ID, Service URL, and Monitoring links
```

---

## Architecture

```
nosana-chat-mcp/
├── apps/
│   ├── app/              # Next.js 15 chat interface & orchestrator
│   └── nosana_mcp/       # Nosana MCP server with 15 deployment tools
├── packages/
│   ├── ai/               # LLM integration, agents & orchestration logic
│   ├── indexDb/          # Local browser storage layer
│   └── typescript-config/# Shared TS configurations
```

**Tech Stack:**

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS, Zustand, Shadcn/UI
- **AI/LLM:** Vercel AI SDK, OpenAI, Tavily (Search)
- **Blockchain:** Nosana SDK, Solana Web3.js
- **Protocol:** Model Context Protocol (MCP)

---

## Use Cases

- **Decentralized Inference:** Deploy ML models without managing physical servers.
- **On-Demand Compute:** Run compute-intensive workloads like batch processing or data analysis.
- **Prototyping:** Quickly test and prototype AI applications on real GPU hardware.
- **Cost Optimization:** Leverage decentralized markets for more affordable GPU access compared to traditional cloud providers.

---

## Core Technologies

- **[Inferia.ai](https://inferia.ai)**: AI intelligence and model orchestration.
- **[Nosana](https://nosana.io)**: Decentralized GPU infrastructure and resource management.
- **[Solana](https://solana.com)**: Secure, high-speed blockchain for transactions.
- **[Model Context Protocol](https://modelcontextprotocol.io)**: Standardized tool integration for AI models.

---

**Deploy AI through natural language. No infrastructure management required.**
