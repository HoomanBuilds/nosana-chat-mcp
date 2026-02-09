import { kv } from "@vercel/kv";

export const CREDIT_CONFIG = {
  DAILY_LIMIT: 10,
  WALLET_BONUS: 0,
  MESSAGE_COST: 1,
  TTL_SECONDS: 60 * 60 * 24,
};

export const CREDIT_LIMIT_ERROR_CODE = "CREDIT_LIMIT_REACHED";
export const CREDIT_LIMIT_MESSAGE =
  "You have used all 10 credits. Please deploy your own model using Nosana Deployer to continue.";

function getDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeKey(identifier: string): string {
  return `credits:used:${identifier}:${getDateKey()}`;
}

function getBaseCredits(wallet?: string): number {
  return CREDIT_CONFIG.DAILY_LIMIT + (wallet ? CREDIT_CONFIG.WALLET_BONUS : 0);
}

export async function getCredits(ip: string, wallet?: string): Promise<number> {
  const id = wallet || ip;
  if (!id) throw new Error("Missing IP or wallet identifier");

  const key = makeKey(id);
  const used = (await kv.get<number>(key)) ?? 0;
  const credits = getBaseCredits(wallet) - used;
  return Math.max(0, credits);
}

export async function checkCredits(
  ip: string,
  _model: string,
  wallet?: string
): Promise<{ ok: boolean; remaining: number }> {
  const remaining = await getCredits(ip, wallet);
  const cost = CREDIT_CONFIG.MESSAGE_COST;
  return { ok: remaining >= cost, remaining };
}

export async function deductCredits(
  ip: string,
  _model: string,
  wallet?: string
): Promise<number> {
  const id = wallet || ip;
  if (!id) throw new Error("Missing IP or wallet identifier");

  const key = makeKey(id);
  const cost = CREDIT_CONFIG.MESSAGE_COST;
  const baseCredits = getBaseCredits(wallet);

  // Atomic increment to prevent races from concurrent requests.
  const used = await kv.incrby(key, cost);
  await kv.expire(key, CREDIT_CONFIG.TTL_SECONDS);

  if (used > baseCredits) {
    await kv.decrby(key, cost);
    throw new Error(CREDIT_LIMIT_ERROR_CODE);
  }

  return baseCredits - used;
}

export async function resetCredits(ip: string, wallet?: string): Promise<void> {
  const id = wallet || ip;
  const key = makeKey(id);
  await kv.del(key);
}

export async function addCredits(
  ip: string,
  amount: number,
  wallet?: string
): Promise<number> {
  if (amount <= 0) return getCredits(ip, wallet);

  const id = wallet || ip;
  const key = makeKey(id);
  const used = (await kv.get<number>(key)) ?? 0;
  const nextUsed = Math.max(0, used - amount);

  if (nextUsed === 0) {
    await kv.del(key);
  } else {
    await kv.set(key, nextUsed, { ex: CREDIT_CONFIG.TTL_SECONDS });
  }

  return getBaseCredits(wallet) - nextUsed;
}
