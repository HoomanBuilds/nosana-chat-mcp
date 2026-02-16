export const JOB_MESSAGE = {
  validation_failed: (errors: string, schemaShape: Record<string, string>) => `
❌ **Job definition validation failed**
${errors}

Please fix these issues and try again.

**Expected format:**
\`\`\`json
${JSON.stringify(schemaShape, null, 2)}
\`\`\`
`,

  job_cost_failed: (market: string, timeout: number, err: any) => `
⚠️ **Failed to fetch job cost**
Market: ${market}
Timeout: ${timeout}s

Error: ${err?.message || "Unknown error"}

You can still deploy, but verify cost manually from your wallet or Nosana dashboard.
`,

  market_not_found: (vram: number, MARKETS: Record<string, any>) => {
    const maxVram = Math.max(...Object.values(MARKETS).map((m) => m.vram_gb));
    const topGpus = Object.entries(MARKETS)
      .sort((a, b) => b[1].vram_gb - a[1].vram_gb)
      .slice(0, 3)
      .map(([name, info]) => `  • ${name}: ${info.vram_gb}GB`)
      .join("\n");

    return `
❌ **No compatible GPU market found** for VRAM requirement: ${vram}GB.

**Max available VRAM:** ${maxVram}GB

**Top GPUs Available:**
${topGpus}

**Suggestions:**
1. Lower required_vram in your job definition
2. Use a smaller model or quantized variant
3. Manually specify a market with \`market\` parameter
4. Try again after verifying available GPUs
`;
  },

  job_processed_error: (err: any) => `
❌ **Job processing failed**
Reason: ${err?.message || "Unknown error"}
Check your job definition or retry with adjusted parameters.
`,

  job_ready_to_deploy: (
    jobDef: any,
    jobImage: string | undefined,
    market: string,
    vram: number | undefined,
    timeout: number,
    cost?: any,
  ) => `
📦 **Validated Job Definition**

| Field | Value |
|-------|-------|
| Type | ${jobDef.type} |
| GPU Market | ${market?.toUpperCase() || "Auto"} |
${jobImage ? `| Image | ${jobImage} |` : ""}
${vram ? `| VRAM | ${vram} GB |` : ""}
| Timeout | ${(timeout / 3600).toFixed(2)} hours |

💰 **Cost Summary**
${
  !cost
    ? "⚠️ Cost not available — check wallet."
    : `GPU: ${cost.NOS} NOS ($${cost.NOS_USD})
SOL: ${cost.SOL} SOL ($${cost.SOL_USD})
Network: ${cost.NETWORK} SOL ($${cost.NETWORK_USD})
Total: $${cost.TOTAL_USD}`
}

🧾 **Job Definition**
\`\`\`json
${JSON.stringify(jobDef, null, 2)}
\`\`\`

✅ Validation passed — ready to deploy.
its not uploaded to nosana waiting for user confirmation
if user want to have any update then  run the tool again with updated job definition
──────────────────────────────
`,
};

export const HOOMAN_IMAGE = "docker.io/hoomanhq/oneclickllm:ollama01";
