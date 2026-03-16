# Nosana AI Agent Skill

A skill for AI agents to interact with Nosana's decentralized GPU computing platform.

## Installation

### Using the Skills CLI

```bash
npx skills add nosana-ai/nosana
```

Or install to a specific agent:

```bash
# For Claude Code
npx skills add nosana-ai/nosana -a claude-code

# For OpenCode
npx skills add nosana-ai/nosana -a opencode

# For Cursor
npx skills add nosana-ai/nosana -a cursor

# For Cline
npx skills add nosana-ai/nosana -a cline
```

### Manual Installation

1. Clone this repository
2. Copy the `skills/nosana` folder to your agent's skills directory:
   - Claude Code: `.claude/skills/`
   - OpenCode: `.agents/skills/`
   - Cursor: `.agents/skills/`
   - Cline: `.agents/skills/`
   - Windsurf: `.windsurf/skills/`

## What This Skill Enables

With this skill, AI agents can:

- **Deploy AI Models**: Create inference jobs for LLMs (Llama, Qwen, DeepSeek, etc.) and other AI models
- **Manage Jobs**: Stop, extend runtime, check status of running jobs
- **Check Balances**: View SOL/NOS wallet balances or API key credits
- **Explore Markets**: Browse available GPU markets, check pricing
- **Estimate Costs**: Calculate job costs before deployment
- **Get Recommendations**: AI-powered model and market suggestions

## Authentication Modes

The skill supports two authentication methods:

1. **Wallet Mode**: Connect a Solana wallet for on-chain payments
2. **API Key Mode**: Use Nosana API keys for credit-based payments

## Available Tools

| Category        | Tools                                                            |
| --------------- | ---------------------------------------------------------------- |
| Job Management  | createJob, stopJob, extendJobRuntime, getJob, getAllJobs         |
| Wallet/Credits  | getWalletBalance, getCreditBalance                               |
| Market/Pricing  | listGpuMarkets, getMarket, estimateJobCost, suggest_model_market |
| Model Discovery | getModels, getModels_from_tags                                   |

## Usage Examples

### Deploy an LLM

```
User: Deploy Llama 3.1 8B on Nosana

Agent: I'll help you deploy Llama 3.1 8B. Let me check available markets and estimate the cost.
```

### Check Balance

```
User: What's my NOS balance?

Agent: Let me check your wallet balance.
```

### Stop a Job

```
User: Stop job 12345

Agent: I'll stop that job for you.
```

## Documentation

See [SKILL.md](./skills/nosana/SKILL.md) for complete documentation.

## Resources

- [Nosana Dashboard](https://deploy.nosana.com)
- [Nosana Documentation](https://docs.nosana.io)
- [Skills Directory](https://skills.sh)
