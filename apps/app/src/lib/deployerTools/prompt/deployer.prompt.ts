import * as fs from "fs";
import * as path from "path";
import { MarketInfo } from "../utils/types";

let skillCache: string | null = null;

function loadSkill(): string {
  if (skillCache !== null) return skillCache;
  try {
    const skillPath = path.join(process.cwd(), "skills", "nosana", "SKILL.md");
    skillCache = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, "utf-8") : "";
    return skillCache;
  } catch {
    return "";
  }
}

export function getResolverPrompt(
  refinedQuery: string,
  {
    marketDetails,
    modelName,
  }: { marketDetails?: MarketInfo; modelName?: string },
): string {
  const skill = loadSkill();
  return `
You are an expert AI job definition generator for Nosana.
Follow the "Job Definition Generator Rules" section in the skill guide below exactly.
Output ONLY valid JSON — no markdown, no explanation.

${skill}

=== USER REQUEST ===
${refinedQuery}
${marketDetails ? `Market: ${JSON.stringify(marketDetails, null, 2)}` : ""}
${modelName ? `Model: ${modelName}` : ""}
===================
`;
}

export function suggest_model_market_prompt(
  requirements: string,
  MARKETS: Record<string, any>,
): string {
  const skill = loadSkill();
  const marketList = Object.entries(MARKETS)
    .map(([slug, m]) => `- ${slug}: ${m.vram_gb}GB VRAM, $${m.estimated_price_usd_per_hour}/hr, address: ${m.address}`)
    .join("\n");

  return `
You are an expert GPU + AI model recommender for Nosana.
Follow the "Model Market Recommendation Rules" section in the skill guide below.
Output ONLY valid JSON.

${skill}

=== AVAILABLE MARKETS ===
${marketList}

=== USER REQUIREMENTS ===
${requirements}
=========================

Respond with:
{
  "model": [{ "name": string, "reason": string, "recommandation_score": number }],
  "market": [{ "name": string, "reason": string, "price": string, "address": string, "recommandation_score": number }]
}
`;
}
