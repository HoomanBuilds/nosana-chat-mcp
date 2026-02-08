import { kv } from "@vercel/kv";

export const CREDIT_CONFIG = {
  DAILY_LIMIT: 10,
  WALLET_BONUS: 300,
  TTL_SECONDS: 60 * 60 * 24,

  MODELS: {
    "qwen3:0.6b": 0,
    "llama-3.8b": 0,
    "deepseek-r1:7b": 0,
    "mistral-7b": 0,
    "qwen3:4b": 0,
  },
};

function getDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeKey(identifier: string): string {
  return `credits:${identifier}:${getDateKey()}`;
}

function getBaseCredits(wallet?: string): number {
  return CREDIT_CONFIG.DAILY_LIMIT + (wallet ? CREDIT_CONFIG.WALLET_BONUS : 0);
}

export async function getCredits(ip: string, wallet?: string): Promise<number> {
  const id = wallet || ip;
  if (!id) throw new Error("Missing IP or wallet identifier");

  const key = makeKey(id);
  let credits = await kv.get<number>(key);

  if (credits == null) {
    credits = getBaseCredits(wallet);
    await kv.set(key, credits, { ex: CREDIT_CONFIG.TTL_SECONDS });
  }

  return credits;
}

export async function checkCredits(
  ip: string,
  model: string,
  wallet?: string
): Promise<{ ok: boolean; remaining: number }> {
  const remaining = await getCredits(ip, wallet);
  const cost = CREDIT_CONFIG.MODELS[model as keyof typeof CREDIT_CONFIG.MODELS] ?? 0;
  return { ok: remaining >= cost, remaining };
}

export async function deductCredits(
  ip: string,
  model: string,
  wallet?: string
): Promise<number> {
  const id = wallet || ip;
  if (!id) throw new Error("Missing IP or wallet identifier");

  const key = makeKey(id);
  const cost = CREDIT_CONFIG.MODELS[model as keyof typeof CREDIT_CONFIG.MODELS] ?? 0;
  const current = await getCredits(ip, wallet);

  if (cost === 0) return current;

  if (current < cost) throw new Error("Insufficient credits");

  const newBalance = current - cost;
  await kv.set(key, newBalance, { ex: CREDIT_CONFIG.TTL_SECONDS });
  return newBalance;
}

export async function resetCredits(ip: string, wallet?: string): Promise<void> {
  const id = wallet || ip;
  const key = makeKey(id);
  await kv.set(key, getBaseCredits(wallet), { ex: CREDIT_CONFIG.TTL_SECONDS });
}

export async function addCredits(
  ip: string,
  amount: number,
  wallet?: string
): Promise<number> {
  const id = wallet || ip;
  const key = makeKey(id);
  const current = await getCredits(ip, wallet);
  const updated = current + amount;
  await kv.set(key, updated, { ex: CREDIT_CONFIG.TTL_SECONDS });
  return updated;
}
